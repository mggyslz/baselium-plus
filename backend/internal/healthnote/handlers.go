// Package healthnote provides caregiver-authored notes for assigned elders.
package healthnote

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"baselium/backend/internal/access"
	"baselium/backend/internal/auth"
)

type Handler struct{ DB *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{DB: db} }

type createRequest struct {
	UserID int    `json:"user_id"`
	Note   string `json:"note"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID < 1 || strings.TrimSpace(req.Note) == "" {
		http.Error(w, `{"error":"user_id and note are required"}`, http.StatusBadRequest)
		return
	}
	allowed, err := access.CaregiverHasElder(h.DB, claims.ProfileID, req.UserID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	if !allowed {
		http.Error(w, `{"error":"elder is not assigned to you"}`, http.StatusForbidden)
		return
	}
	var noteID int
	err = h.DB.QueryRow(`INSERT INTO health_notes (user_id, caregiver_id, note_text) VALUES ($1,$2,$3) RETURNING note_id`, req.UserID, claims.ProfileID, strings.TrimSpace(req.Note)).Scan(&noteID)
	if err != nil {
		http.Error(w, `{"error":"could not save health note"}`, http.StatusInternalServerError)
		return
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id,action,target_type,target_id) VALUES ($1,'create_health_note','health_note',$2)`, claims.AccountID, noteID)
	writeJSON(w, http.StatusCreated, map[string]int{"note_id": noteID})
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	userID, err := strconv.Atoi(r.URL.Query().Get("user_id"))
	if err != nil || userID < 1 {
		http.Error(w, `{"error":"valid user_id required"}`, http.StatusBadRequest)
		return
	}
	allowed, err := access.CaregiverHasElder(h.DB, claims.ProfileID, userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	if !allowed {
		http.Error(w, `{"error":"elder is not assigned to you"}`, http.StatusForbidden)
		return
	}
	type note struct {
		NoteID        int       `json:"note_id"`
		NoteText      string    `json:"note_text"`
		CreatedAt     time.Time `json:"created_at"`
		CaregiverName string    `json:"caregiver_name"`
	}
	rows, err := h.DB.Query(`SELECT hn.note_id, hn.note_text, hn.created_at, c.full_name FROM health_notes hn JOIN caregivers c ON c.caregiver_id = hn.caregiver_id WHERE hn.user_id = $1 ORDER BY hn.created_at DESC LIMIT 100`, userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	out := []note{}
	for rows.Next() {
		var n note
		if rows.Scan(&n.NoteID, &n.NoteText, &n.CreatedAt, &n.CaregiverName) == nil {
			out = append(out, n)
		}
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id,action,target_type,target_id) VALUES ($1,'view_health_notes','user',$2)`, claims.AccountID, userID)
	writeJSON(w, http.StatusOK, out)
}

func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}
