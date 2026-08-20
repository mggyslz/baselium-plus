// Package baseline implements the rolling-window statistical baseline
// described in DECISIONS.md D2/D3/D4/D12. No ML — plain arithmetic, on
// purpose, for explainability (PROJECT_CONTEXT.md "Coding Rules").
package baseline

import (
	"database/sql"
	"math"
	"time"
)

const WindowDays = 7 // D3

type Baseline struct {
	BaselineID        int
	UserID            int
	AvgMood           float64
	AvgActivity       float64
	StddevMood        float64
	StddevActivity    float64
	CheckinFrequency  float64 // D12: fraction of expected check-ins actually submitted
	SampleSize        int
	PeriodDays        int
	IsColdStart       bool // D4
	ComputedAt        time.Time
}

type checkinSample struct {
	Mood, Activity float64
	Day            time.Time
}

// Compute recomputes the elder's baseline from the last WindowDays of
// check-ins and persists it as the new active baseline (D11: only one active
// baseline per elder — old ones are deactivated, not deleted, for audit).
func Compute(db *sql.DB, userID int) (*Baseline, error) {
	since := time.Now().AddDate(0, 0, -WindowDays)

	rows, err := db.Query(
		`SELECT mood, activity_level, checkin_time FROM check_ins
		 WHERE user_id = $1 AND checkin_time >= $2 AND is_missed = FALSE
		 ORDER BY checkin_time`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []checkinSample
	for rows.Next() {
		var mood, activity int
		var t time.Time
		if err := rows.Scan(&mood, &activity, &t); err != nil {
			continue
		}
		samples = append(samples, checkinSample{Mood: float64(mood), Activity: float64(activity), Day: t})
	}

	// D4: cold-start — fewer than 7 days of *history* (not 7 samples; a
	// brand-new elder with 3 days of check-ins is still cold-start even if
	// they never missed a day).
	var firstCheckinTime time.Time
	err = db.QueryRow(`SELECT MIN(checkin_time) FROM check_ins WHERE user_id = $1`, userID).Scan(&firstCheckinTime)
	isColdStart := err != nil || firstCheckinTime.IsZero() || time.Since(firstCheckinTime) < WindowDays*24*time.Hour

	b := &Baseline{
		UserID:      userID,
		PeriodDays:  WindowDays,
		SampleSize:  len(samples),
		IsColdStart: isColdStart,
		ComputedAt:  time.Now(),
	}

	if len(samples) > 0 {
		b.AvgMood, b.StddevMood = meanStddev(pluck(samples, func(s checkinSample) float64 { return s.Mood }))
		b.AvgActivity, b.StddevActivity = meanStddev(pluck(samples, func(s checkinSample) float64 { return s.Activity }))
	}

	// D12: checkin_frequency = fraction of expected check-ins actually
	// submitted over period_days (one expected check-in per day).
	expected := WindowDays
	b.CheckinFrequency = float64(len(samples)) / float64(expected)
	if b.CheckinFrequency > 1 {
		b.CheckinFrequency = 1
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// D11: deactivate any current active baseline, then insert the new one.
	if _, err := tx.Exec(`UPDATE behavioral_baselines SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE`, userID); err != nil {
		return nil, err
	}
	err = tx.QueryRow(
		`INSERT INTO behavioral_baselines
		 (user_id, avg_mood_score, avg_activity_level, stddev_mood, stddev_activity,
		  checkin_frequency, sample_size, period_days, is_cold_start, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE) RETURNING baseline_id`,
		userID, b.AvgMood, b.AvgActivity, b.StddevMood, b.StddevActivity,
		b.CheckinFrequency, b.SampleSize, b.PeriodDays, b.IsColdStart,
	).Scan(&b.BaselineID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return b, nil
}

// GetActive returns the elder's current active baseline, if any.
func GetActive(db *sql.DB, userID int) (*Baseline, error) {
	b := &Baseline{}
	err := db.QueryRow(
		`SELECT baseline_id, user_id, avg_mood_score, avg_activity_level, stddev_mood, stddev_activity,
		        checkin_frequency, sample_size, period_days, is_cold_start, computed_at
		 FROM behavioral_baselines WHERE user_id = $1 AND is_active = TRUE`, userID,
	).Scan(&b.BaselineID, &b.UserID, &b.AvgMood, &b.AvgActivity, &b.StddevMood, &b.StddevActivity,
		&b.CheckinFrequency, &b.SampleSize, &b.PeriodDays, &b.IsColdStart, &b.ComputedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return b, err
}

func meanStddev(values []float64) (mean, stddev float64) {
	n := float64(len(values))
	if n == 0 {
		return 0, 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	mean = sum / n
	if n < 2 {
		return mean, 0
	}
	var sq float64
	for _, v := range values {
		sq += (v - mean) * (v - mean)
	}
	stddev = math.Sqrt(sq / (n - 1)) // sample stddev
	return mean, stddev
}

func pluck(samples []checkinSample, f func(checkinSample) float64) []float64 {
	out := make([]float64, len(samples))
	for i, s := range samples {
		out[i] = f(s)
	}
	return out
}
