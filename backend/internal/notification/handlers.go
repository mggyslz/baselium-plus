package notification

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"baselium/backend/internal/access"
	"baselium/backend/internal/auth"
)

type Handler struct{ DB *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{DB: db} }

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	items, err := ListForCaregiver(h.DB, claims.ProfileID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

type ackRequest struct {
	AnomalyID int `json:"anomaly_id"`
}

func (h *Handler) Ack(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	var req ackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	if req.AnomalyID < 1 {
		http.Error(w, `{"error":"valid anomaly_id required"}`, http.StatusBadRequest)
		return
	}
	allowed, err := access.CaregiverHasAnomaly(h.DB, claims.ProfileID, req.AnomalyID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	if !allowed {
		http.Error(w, `{"error":"anomaly is not assigned to you"}`, http.StatusForbidden)
		return
	}
	if err := Acknowledge(h.DB, req.AnomalyID, claims.ProfileID); err != nil {
		http.Error(w, `{"error":"could not acknowledge"}`, http.StatusInternalServerError)
		return
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1,'acknowledge_alert','anomaly',$2)`,
		claims.AccountID, req.AnomalyID)
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

var _ = sql.ErrNoRows
