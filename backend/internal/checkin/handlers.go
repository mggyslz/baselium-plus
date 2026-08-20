package checkin

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"baselium/backend/internal/anomaly"
	"baselium/backend/internal/auth"
	"baselium/backend/internal/notification"
)

type Handler struct {
	DB *sql.DB
}

func NewHandler(db *sql.DB) *Handler { return &Handler{DB: db} }

type submitRequest struct {
	Mood         int    `json:"mood"`
	ActivityLevel int   `json:"activity_level"`
	Notes        string `json:"notes,omitempty"`
	ContextNote  string `json:"context_note,omitempty"`
}

// Submit records a daily check-in for the authenticated elder, then runs
// anomaly detection against the elder's current baseline in the background
// of the same request (kept synchronous for simplicity in this template —
// see README for how to move this to a queue/worker for scale).
func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	if claims.Role != "elder" {
		http.Error(w, `{"error":"only elders submit check-ins"}`, http.StatusForbidden)
		return
	}
	var req submitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.Mood < 1 || req.Mood > 5 || req.ActivityLevel < 1 || req.ActivityLevel > 5 {
		http.Error(w, `{"error":"mood and activity_level must be 1-5"}`, http.StatusBadRequest)
		return
	}

	var checkinID int
	err := h.DB.QueryRow(
		`INSERT INTO check_ins (user_id, mood, activity_level, notes, context_note)
		 VALUES ($1, $2, $3, $4, $5) RETURNING checkin_id`,
		claims.ProfileID, req.Mood, req.ActivityLevel, req.Notes, req.ContextNote,
	).Scan(&checkinID)
	if err != nil {
		http.Error(w, `{"error":"could not save check-in"}`, http.StatusInternalServerError)
		return
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1, 'submit_checkin', 'checkin', $2)`,
		claims.AccountID, checkinID)

	// Run detection against whatever baseline currently exists (may recompute
	// a fresh one first — see internal/baseline).
	detected, err := anomaly.DetectForCheckin(h.DB, claims.ProfileID, checkinID)
	if err != nil {
		// Don't fail the check-in submission if detection has a hiccup;
		// log it as a known-problem style response for the demo.
		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"checkin_id":     checkinID,
			"detection_note": "check-in saved, anomaly detection failed: " + err.Error(),
		})
		return
	}

	for _, a := range detected {
		if err := notification.DispatchForAnomaly(h.DB, a.AnomalyID, claims.ProfileID, a.Severity, a.AnomalyType, a.Reason); err != nil {
			// non-fatal for the check-in response
			continue
		}
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"checkin_id":       checkinID,
		"checkin_time":     time.Now(),
		"anomalies_raised": detected,
	})
}

// History returns the elder's own check-ins (elder) or, for a caregiver, a
// given elder's check-ins (D6: never exposed to family viewers).
func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	userID := claims.ProfileID
	if claims.Role == "caregiver" {
		q := r.URL.Query().Get("user_id")
		if q == "" {
			http.Error(w, `{"error":"user_id query param required for caregiver"}`, http.StatusBadRequest)
			return
		}
		id, err := strconv.Atoi(q)
		if err != nil {
			http.Error(w, `{"error":"invalid user_id"}`, http.StatusBadRequest)
			return
		}
		userID = id
		h.DB.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1, 'view_checkin', 'user', $2)`,
			claims.AccountID, userID)
	} else if claims.Role != "elder" {
		http.Error(w, `{"error":"family viewers cannot view check-in history"}`, http.StatusForbidden) // D6
		return
	}

	rows, err := h.DB.Query(
		`SELECT checkin_id, checkin_time, mood, activity_level, notes, context_note, is_missed
		 FROM check_ins WHERE user_id = $1 ORDER BY checkin_time DESC LIMIT 60`, userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type row struct {
		CheckinID    int       `json:"checkin_id"`
		CheckinTime  time.Time `json:"checkin_time"`
		Mood         int       `json:"mood"`
		ActivityLevel int      `json:"activity_level"`
		Notes        *string   `json:"notes"`
		ContextNote  *string   `json:"context_note"`
		IsMissed     bool      `json:"is_missed"`
	}
	var out []row
	for rows.Next() {
		var rr row
		if err := rows.Scan(&rr.CheckinID, &rr.CheckinTime, &rr.Mood, &rr.ActivityLevel, &rr.Notes, &rr.ContextNote, &rr.IsMissed); err != nil {
			continue
		}
		out = append(out, rr)
	}
	writeJSON(w, http.StatusOK, out)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}


