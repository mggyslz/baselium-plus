package dashboard

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"baselium/backend/internal/auth"
)

type Handler struct{ DB *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{DB: db} }

type triageRow struct {
	UserID           int        `json:"user_id"`
	FullName         string     `json:"full_name"`
	HighestSeverity  *string    `json:"highest_open_severity"`
	OpenAnomalyCount int        `json:"open_anomaly_count"`
	LastCheckin      *time.Time `json:"last_checkin"`
}

// Triage lists every elder assigned to this caregiver, sorted worst-first
// (severity-sorted triage view per PROJECT_CONTEXT.md goals).
func (h *Handler) Triage(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	rows, err := h.DB.Query(`
		SELECT u.user_id, u.full_name,
		       (SELECT MAX(checkin_time) FROM check_ins c WHERE c.user_id = u.user_id) AS last_checkin,
		       (SELECT COUNT(*) FROM anomalies a WHERE a.user_id = u.user_id AND a.is_resolved = FALSE) AS open_count,
		       (SELECT a.severity FROM anomalies a WHERE a.user_id = u.user_id AND a.is_resolved = FALSE
		          ORDER BY CASE a.severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC LIMIT 1) AS top_sev
		FROM users u
		JOIN user_caregiver uc ON uc.user_id = u.user_id
		WHERE uc.caregiver_id = $1 AND uc.is_active = TRUE
	`, claims.ProfileID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []triageRow
	for rows.Next() {
		var t triageRow
		if err := rows.Scan(&t.UserID, &t.FullName, &t.LastCheckin, &t.OpenAnomalyCount, &t.HighestSeverity); err == nil {
			out = append(out, t)
		}
	}
	// severity-sorted: high > medium > low > none
	rank := map[string]int{"high": 3, "medium": 2, "low": 1}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0; j-- {
			a, b := out[j], out[j-1]
			ra, rb := 0, 0
			if a.HighestSeverity != nil {
				ra = rank[*a.HighestSeverity]
			}
			if b.HighestSeverity != nil {
				rb = rank[*b.HighestSeverity]
			}
			if ra > rb {
				out[j], out[j-1] = out[j-1], out[j]
			} else {
				break
			}
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// Trend returns raw check-in points plus the active baseline for charting.
func (h *Handler) Trend(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if claims.Role == "family" {
		http.Error(w, `{"error":"family viewers cannot view detailed trends"}`, http.StatusForbidden) // D6
		return
	}

	rows, err := h.DB.Query(
		`SELECT checkin_time, mood, activity_level FROM check_ins WHERE user_id = $1 ORDER BY checkin_time DESC LIMIT 30`,
		userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type point struct {
		Time     time.Time `json:"time"`
		Mood     int       `json:"mood"`
		Activity int       `json:"activity"`
	}
	var points []point
	for rows.Next() {
		var p point
		if err := rows.Scan(&p.Time, &p.Mood, &p.Activity); err == nil {
			points = append(points, p)
		}
	}

	var avgMood, avgActivity, stddevMood, stddevActivity sql.NullFloat64
	h.DB.QueryRow(
		`SELECT avg_mood_score, avg_activity_level, stddev_mood, stddev_activity
		 FROM behavioral_baselines WHERE user_id = $1 AND is_active = TRUE`, userID,
	).Scan(&avgMood, &avgActivity, &stddevMood, &stddevActivity)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"points":          points,
		"baseline_mood":   avgMood.Float64,
		"baseline_activity": avgActivity.Float64,
		"stddev_mood":     stddevMood.Float64,
		"stddev_activity": stddevActivity.Float64,
	})
}

// AlertHistory lists anomalies for an elder (caregiver: full detail;
// family: high-severity only, per D6).
func (h *Handler) AlertHistory(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}

	query := `SELECT anomaly_id, anomaly_type, severity, deviation_metric, deviation_magnitude, duration_days, detected_at, is_resolved
	           FROM anomalies WHERE user_id = $1`
	args := []interface{}{userID}
	if claims.Role == "family" {
		query += ` AND severity = 'high'`
	}
	query += ` ORDER BY detected_at DESC LIMIT 50`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type row struct {
		AnomalyID          int       `json:"anomaly_id"`
		AnomalyType        string    `json:"anomaly_type"`
		Severity           string    `json:"severity"`
		DeviationMetric    *string   `json:"deviation_metric"`
		DeviationMagnitude float64   `json:"deviation_magnitude"`
		DurationDays       int       `json:"duration_days"`
		DetectedAt         time.Time `json:"detected_at"`
		IsResolved         bool      `json:"is_resolved"`
	}
	var out []row
	for rows.Next() {
		var rr row
		if err := rows.Scan(&rr.AnomalyID, &rr.AnomalyType, &rr.Severity, &rr.DeviationMetric, &rr.DeviationMagnitude, &rr.DurationDays, &rr.DetectedAt, &rr.IsResolved); err == nil {
			out = append(out, rr)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
