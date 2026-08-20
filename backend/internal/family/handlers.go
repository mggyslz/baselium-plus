package family

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"baselium/backend/internal/auth"
)

type Handler struct{ DB *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{DB: db} }

type revokeRequest struct {
	FamilyID int `json:"family_id"`
}

// Revoke lets a caregiver turn off a family member's access.
func (h *Handler) Revoke(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	var req revokeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	res, err := h.DB.Exec(
		`UPDATE family_access SET is_active = FALSE WHERE family_id = $1 AND granted_by = $2`,
		req.FamilyID, claims.ProfileID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, `{"error":"not found or not granted by you"}`, http.StatusNotFound)
		return
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1,'revoke_family_access','family_access',$2)`,
		claims.AccountID, req.FamilyID)
	w.WriteHeader(http.StatusNoContent)
}

// Status is what a family viewer sees: a coarse status, not full history (D6).
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	var elderUserID int
	var elderName string
	err := h.DB.QueryRow(
		`SELECT u.user_id, u.full_name FROM family_access fa
		 JOIN users u ON u.user_id = fa.user_id
		 WHERE fa.family_id = $1 AND fa.is_active = TRUE`, claims.ProfileID,
	).Scan(&elderUserID, &elderName)
	if err != nil {
		http.Error(w, `{"error":"access not found or revoked"}`, http.StatusNotFound)
		return
	}

	var lastCheckin sql.NullString
	h.DB.QueryRow(`SELECT MAX(checkin_time)::text FROM check_ins WHERE user_id = $1`, elderUserID).Scan(&lastCheckin)

	var openHighSeverity int
	h.DB.QueryRow(
		`SELECT COUNT(*) FROM anomalies WHERE user_id = $1 AND severity = 'high' AND is_resolved = FALSE`,
		elderUserID).Scan(&openHighSeverity)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"elder_name":              elderName,
		"last_checkin":            lastCheckin.String,
		"open_high_severity_alerts": openHighSeverity,
	})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
