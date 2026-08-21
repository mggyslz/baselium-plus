package admin

import (
	"baselium/backend/internal/auth"
	"database/sql"
	"encoding/json"
	"net/http"
)

type Handler struct{ DB *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{db} }
func writeJSON(w http.ResponseWriter, s int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(s)
	json.NewEncoder(w).Encode(v)
}
func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	counts := map[string]int{}
	for _, role := range []string{"admin", "elder", "caregiver", "family"} {
		var count int
		h.DB.QueryRow(`SELECT COUNT(*) FROM accounts WHERE role=$1 AND is_active`, role).Scan(&count)
		counts[role] = count
	}
	var openAlerts, assignments int
	h.DB.QueryRow(`SELECT COUNT(*) FROM anomalies WHERE is_resolved=FALSE`).Scan(&openAlerts)
	h.DB.QueryRow(`SELECT COUNT(*) FROM user_caregiver WHERE is_active`).Scan(&assignments)
	counts["open_alerts"] = openAlerts
	counts["assignments"] = assignments
	writeJSON(w, 200, counts)
}
func (h *Handler) Accounts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`SELECT account_id,email,role,is_active,created_at FROM accounts ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	defer rows.Close()
	type row struct {
		AccountID   int `json:"account_id"`
		Email, Role string
		Active      bool   `json:"active"`
		CreatedAt   string `json:"created_at"`
	}
	out := []row{}
	for rows.Next() {
		var x row
		if rows.Scan(&x.AccountID, &x.Email, &x.Role, &x.Active, &x.CreatedAt) == nil {
			out = append(out, x)
		}
	}
	writeJSON(w, 200, out)
}
func (h *Handler) Assign(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ElderUserID int `json:"elder_user_id"`
		CaregiverID int `json:"caregiver_id"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil || req.ElderUserID < 1 || req.CaregiverID < 1 {
		http.Error(w, `{"error":"elder_user_id and caregiver_id required"}`, 400)
		return
	}
	_, err := h.DB.Exec(`INSERT INTO user_caregiver (user_id,caregiver_id) VALUES ($1,$2) ON CONFLICT (user_id,caregiver_id) DO UPDATE SET is_active=TRUE`, req.ElderUserID, req.CaregiverID)
	if err != nil {
		http.Error(w, `{"error":"could not create assignment"}`, 400)
		return
	}
	claims := auth.FromContext(r.Context())
	h.DB.Exec(`INSERT INTO audit_logs(account_id,action,target_type,target_id) VALUES($1,'admin_assign_caregiver','user',$2)`, claims.AccountID, req.ElderUserID)
	w.WriteHeader(204)
}
