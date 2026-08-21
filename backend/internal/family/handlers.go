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

type assignRequest struct {
	ElderUserID int `json:"elder_user_id"`
}
type grantRequest struct {
	ElderUserID  int    `json:"elder_user_id"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	FullName     string `json:"full_name"`
	Relationship string `json:"relationship"`
}

// Assign links the authenticated caregiver to an existing elder.
func (h *Handler) Assign(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	var req assignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ElderUserID < 1 {
		http.Error(w, `{"error":"valid elder_user_id required"}`, http.StatusBadRequest)
		return
	}
	_, err := h.DB.Exec(`INSERT INTO user_caregiver (user_id, caregiver_id) VALUES ($1,$2) ON CONFLICT (user_id, caregiver_id) DO UPDATE SET is_active = TRUE`, req.ElderUserID, claims.ProfileID)
	if err != nil {
		http.Error(w, `{"error":"could not assign elder"}`, http.StatusBadRequest)
		return
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1,'assign_elder','user',$2)`, claims.AccountID, req.ElderUserID)
	w.WriteHeader(http.StatusNoContent)
}

// Grant creates a family account and grants it read-only access to an elder
// managed by the authenticated caregiver.
func (h *Handler) Grant(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	var req grantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ElderUserID < 1 || req.Email == "" || len(req.Password) < 8 || req.FullName == "" {
		http.Error(w, `{"error":"elder_user_id, email, full_name, and an 8-character password are required"}`, http.StatusBadRequest)
		return
	}
	var allowed bool
	if err := h.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM user_caregiver WHERE user_id=$1 AND caregiver_id=$2 AND is_active)`, req.ElderUserID, claims.ProfileID).Scan(&allowed); err != nil || !allowed {
		http.Error(w, `{"error":"elder is not assigned to you"}`, http.StatusForbidden)
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, `{"error":"could not secure password"}`, 500)
		return
	}
	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	defer tx.Rollback()
	var accountID, familyID int
	if err = tx.QueryRow(`INSERT INTO accounts (email,password_hash,role) VALUES ($1,$2,'family') RETURNING account_id`, req.Email, hash).Scan(&accountID); err != nil {
		http.Error(w, `{"error":"email already registered"}`, http.StatusConflict)
		return
	}
	if err = tx.QueryRow(`INSERT INTO family_access (account_id,user_id,full_name,relationship,granted_by) VALUES ($1,$2,$3,$4,$5) RETURNING family_id`, accountID, req.ElderUserID, req.FullName, req.Relationship, claims.ProfileID).Scan(&familyID); err != nil {
		http.Error(w, `{"error":"could not grant access"}`, 500)
		return
	}
	tx.Exec(`INSERT INTO audit_logs (account_id,action,target_type,target_id) VALUES ($1,'grant_family_access','family_access',$2)`, claims.AccountID, familyID)
	if err = tx.Commit(); err != nil {
		http.Error(w, `{"error":"could not grant access"}`, 500)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int{"family_id": familyID, "account_id": accountID})
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
		"elder_name":                elderName,
		"last_checkin":              lastCheckin.String,
		"open_high_severity_alerts": openHighSeverity,
	})
}

type membersRow struct {
	ID           int    `json:"id"`
	FullName     string `json:"full_name"`
	Relationship string `json:"relationship"`
	Email        string `json:"email"`
	IsActive     bool   `json:"is_active"`
}

// Members lists the family accounts this caller has granted access to.
func (h *Handler) Members(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	rows, err := h.DB.Query(`
		SELECT fa.family_id, fa.full_name, fa.relationship, a.email, fa.is_active
		FROM family_access fa
		JOIN accounts a ON a.account_id = fa.account_id
		WHERE fa.granted_by = $1
		ORDER BY fa.created_at DESC
	`, claims.ProfileID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []membersRow
	for rows.Next() {
		var m membersRow
		if rows.Scan(&m.ID, &m.FullName, &m.Relationship, &m.Email, &m.IsActive) == nil {
			out = append(out, m)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
