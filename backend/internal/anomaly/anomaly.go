// Package anomaly implements deviation detection and severity classification
// per DECISIONS.md D5. Lives separately from internal/baseline per the
// coding rule "anomaly logic lives only in internal/anomaly and
// internal/baseline — no anomaly-detection math inline in handlers."
package anomaly

import (
	"database/sql"
	"fmt"
	"math"
	"time"

	"baselium/backend/internal/baseline"
)

// Thresholds are intentionally simple constants (not tunable via ML) so
// they stay explainable — see PROJECT_CONTEXT.md "No ML models."
const (
	deviationThresholdStddevs = 1.5 // magnitude beyond which a check-in counts as deviating
	sustainedDays             = 3   // consecutive deviating days needed for "medium"+ severity
	highDeviationStddevs      = 2.5
	highSustainedDays         = 4
	frequencyDropThreshold    = 0.5 // checkin_frequency below this vs. prior baseline = flagged
	missedCheckinHighHours    = 24  // D5: any missed check-in >24h is auto-high
)

type Anomaly struct {
	AnomalyID          int
	UserID             int
	BaselineID         int
	CheckinID          *int
	AnomalyType        string // mood_deviation, activity_deviation, frequency_deviation, missed_checkin
	Severity           string // low, medium, high
	DeviationMetric    string
	DeviationMagnitude float64
	DurationDays       int
	Reason             string // human-readable explainable reason
}

// DetectForCheckin recomputes the baseline (if the elder has enough history
// and it's stale) and evaluates the new check-in against it. Returns any
// anomalies raised (usually 0 or 1, occasionally more if multiple metrics
// deviate at once).
func DetectForCheckin(db *sql.DB, userID, checkinID int) ([]Anomaly, error) {
	bl, err := baseline.GetActive(db, userID)
	if err != nil {
		return nil, err
	}
	if bl == nil {
		bl, err = baseline.Compute(db, userID)
		if err != nil {
			return nil, err
		}
	}

	var mood, activity int
	if err := db.QueryRow(`SELECT mood, activity_level FROM check_ins WHERE checkin_id = $1`, checkinID).
		Scan(&mood, &activity); err != nil {
		return nil, err
	}

	var found []Anomaly

	if bl.IsColdStart {
		// D4: cold-start uses conservative rules — only extreme values and
		// missed check-ins, no computed baseline comparison.
		if mood == 1 || activity == 1 {
			found = append(found, Anomaly{
				UserID: userID, BaselineID: bl.BaselineID, CheckinID: &checkinID,
				AnomalyType: "mood_deviation", Severity: "low",
				DeviationMetric: "cold_start_extreme_value", DurationDays: 1,
				Reason: "Elder has less than 7 days of history (cold-start); an extreme low score (1/5) was flagged as a conservative precaution.",
			})
		}
	} else {
		if a := checkDeviation(userID, bl.BaselineID, checkinID, "mood_deviation", "mood",
			float64(mood), bl.AvgMood, bl.StddevMood, consecutiveDeviatingDays(db, userID, "mood", bl)); a != nil {
			found = append(found, *a)
		}
		if a := checkDeviation(userID, bl.BaselineID, checkinID, "activity_deviation", "activity_level",
			float64(activity), bl.AvgActivity, bl.StddevActivity, consecutiveDeviatingDays(db, userID, "activity", bl)); a != nil {
			found = append(found, *a)
		}
		if bl.CheckinFrequency < frequencyDropThreshold {
			found = append(found, Anomaly{
				UserID: userID, BaselineID: bl.BaselineID, CheckinID: &checkinID,
				AnomalyType: "frequency_deviation", Severity: severityForFrequency(bl.CheckinFrequency),
				DeviationMetric: "checkin_frequency", DeviationMagnitude: bl.CheckinFrequency, DurationDays: baseline.WindowDays,
				Reason: fmt.Sprintf("Check-in frequency dropped to %.0f%% of expected over the last %d days.", bl.CheckinFrequency*100, baseline.WindowDays),
			})
		}
	}

	for i := range found {
		if err := persist(db, &found[i]); err != nil {
			return found, err
		}
	}
	return found, nil
}

func checkDeviation(userID, baselineID, checkinID int, anomalyType, metric string, value, mean, stddev float64, duration int) *Anomaly {
	if stddev == 0 {
		return nil // not enough variance to judge deviation yet
	}
	magnitude := math.Abs(value-mean) / stddev
	if magnitude < deviationThresholdStddevs {
		return nil
	}
	severity := classifySeverity(magnitude, duration)
	return &Anomaly{
		UserID: userID, BaselineID: baselineID, CheckinID: &checkinID,
		AnomalyType: anomalyType, Severity: severity,
		DeviationMetric: metric, DeviationMagnitude: round2(magnitude), DurationDays: duration,
		Reason: fmt.Sprintf("%s deviated %.1f std devs from the %d-day baseline (mean %.1f), sustained %d day(s).",
			metric, magnitude, baseline.WindowDays, mean, duration),
	}
}

// classifySeverity implements D5: high requires large + sustained deviation.
func classifySeverity(magnitude float64, durationDays int) string {
	switch {
	case magnitude >= highDeviationStddevs && durationDays >= highSustainedDays:
		return "high"
	case magnitude >= deviationThresholdStddevs && durationDays >= sustainedDays:
		return "medium"
	default:
		return "low"
	}
}

func severityForFrequency(freq float64) string {
	switch {
	case freq < 0.25:
		return "high"
	case freq < frequencyDropThreshold:
		return "medium"
	default:
		return "low"
	}
}

// consecutiveDeviatingDays counts how many of the most recent days (up to
// the window) also deviated on this metric, giving the "duration" half of
// D5's magnitude+duration severity rule.
func consecutiveDeviatingDays(db *sql.DB, userID int, metric string, bl *baseline.Baseline) int {
	col := "mood"
	mean, stddev := bl.AvgMood, bl.StddevMood
	if metric == "activity" {
		col = "activity_level"
		mean, stddev = bl.AvgActivity, bl.StddevActivity
	}
	if stddev == 0 {
		return 1
	}
	rows, err := db.Query(fmt.Sprintf(
		`SELECT %s, checkin_time FROM check_ins WHERE user_id = $1 ORDER BY checkin_time DESC LIMIT $2`, col),
		userID, baseline.WindowDays)
	if err != nil {
		return 1
	}
	defer rows.Close()

	streak := 0
	for rows.Next() {
		var v int
		var t time.Time
		if err := rows.Scan(&v, &t); err != nil {
			break
		}
		if math.Abs(float64(v)-mean)/stddev >= deviationThresholdStddevs {
			streak++
		} else {
			break
		}
	}
	if streak == 0 {
		streak = 1
	}
	return streak
}

// RecordMissedCheckin flags a missed check-in. D5: any missed check-in >24h
// is automatically high severity, regardless of the elder's baseline.
func RecordMissedCheckin(db *sql.DB, userID int, hoursSinceLast float64) (*Anomaly, error) {
	bl, err := baseline.GetActive(db, userID)
	if err != nil {
		return nil, err
	}
	baselineID := 0
	if bl != nil {
		baselineID = bl.BaselineID
	}
	severity := "low"
	if hoursSinceLast > missedCheckinHighHours {
		severity = "high"
	}
	a := &Anomaly{
		UserID: userID, BaselineID: baselineID,
		AnomalyType: "missed_checkin", Severity: severity,
		DeviationMetric: "hours_since_last_checkin", DeviationMagnitude: round2(hoursSinceLast),
		DurationDays: 1,
		Reason:       fmt.Sprintf("No check-in for %.0f hours.", hoursSinceLast),
	}
	if err := persist(db, a); err != nil {
		return nil, err
	}
	return a, nil
}

// EnsureMissedCheckin records one open missed-check-in anomaly per lapse.
// The daily worker can call this safely without sending duplicate alerts.
func EnsureMissedCheckin(db *sql.DB, userID int, hoursSinceLast float64) (*Anomaly, error) {
	var existing int
	err := db.QueryRow(`SELECT anomaly_id FROM anomalies WHERE user_id = $1 AND anomaly_type = 'missed_checkin' AND is_resolved = FALSE ORDER BY detected_at DESC LIMIT 1`, userID).Scan(&existing)
	if err == nil {
		return nil, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	return RecordMissedCheckin(db, userID, hoursSinceLast)
}

func persist(db *sql.DB, a *Anomaly) error {
	// One open anomaly represents one ongoing condition. Updating it preserves
	// its history while preventing repeated worker/check-in executions from
	// creating alert storms.
	var existingID int
	err := db.QueryRow(`SELECT anomaly_id FROM anomalies WHERE user_id = $1 AND anomaly_type = $2 AND is_resolved = FALSE ORDER BY detected_at DESC LIMIT 1`, a.UserID, a.AnomalyType).Scan(&existingID)
	if err == nil {
		_, err = db.Exec(`UPDATE anomalies SET baseline_id=$2, checkin_id=$3, severity=CASE WHEN $4='high' OR (severity='low' AND $4='medium') THEN $4 ELSE severity END, deviation_metric=$5, deviation_magnitude=GREATEST(COALESCE(deviation_magnitude, 0), $6), duration_days=GREATEST(duration_days, $7), detected_at=now() WHERE anomaly_id=$1`, existingID, nullableBaselineID(a.BaselineID), a.CheckinID, a.Severity, a.DeviationMetric, a.DeviationMagnitude, a.DurationDays)
		a.AnomalyID = existingID
		return err
	}
	if err != sql.ErrNoRows {
		return err
	}

	var baselineID interface{}
	if a.BaselineID != 0 {
		baselineID = a.BaselineID
	}
	err = db.QueryRow(
		`INSERT INTO anomalies (user_id, baseline_id, checkin_id, anomaly_type, severity, deviation_metric, deviation_magnitude, duration_days)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING anomaly_id`,
		a.UserID, baselineID, a.CheckinID, a.AnomalyType, a.Severity, a.DeviationMetric, a.DeviationMagnitude, a.DurationDays,
	).Scan(&a.AnomalyID)
	return err
}

func nullableBaselineID(id int) interface{} {
	if id == 0 {
		return nil
	}
	return id
}

func round2(f float64) float64 { return math.Round(f*100) / 100 }
