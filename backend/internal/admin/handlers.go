package admin

import (
	"baselium/backend/internal/auth"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type Handler struct{ DB *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{db} }
func writeJSON(w http.ResponseWriter, s int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(s)
	json.NewEncoder(w).Encode(v)
}

// AuditLogs returns recent security-relevant account actions for administrators.
// The viewer is deliberately read-only and records its own access for compliance.
func (h *Handler) AuditLogs(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT al.log_id, al.account_id, COALESCE(a.email, ''), al.action,
		       COALESCE(al.target_type, ''), al.target_id, al.created_at
		FROM audit_logs al
		LEFT JOIN accounts a ON a.account_id = al.account_id
		ORDER BY al.created_at DESC
		LIMIT 200`)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type row struct {
		LogID        int       `json:"log_id"`
		AccountID    *int      `json:"account_id"`
		AccountEmail string    `json:"account_email"`
		Action       string    `json:"action"`
		TargetType   string    `json:"target_type"`
		TargetID     *int      `json:"target_id"`
		CreatedAt    time.Time `json:"created_at"`
	}
	out := []row{}
	for rows.Next() {
		var item row
		if err := rows.Scan(&item.LogID, &item.AccountID, &item.AccountEmail, &item.Action, &item.TargetType, &item.TargetID, &item.CreatedAt); err == nil {
			out = append(out, item)
		}
	}
	claims := auth.FromContext(r.Context())
	h.DB.Exec(`INSERT INTO audit_logs(account_id,action,target_type) VALUES($1,'view_audit_logs','audit_log')`, claims.AccountID)
	writeJSON(w, http.StatusOK, out)
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

// Elders returns an administrative, read-only overview of each elder's
// current check-in statistics and active caregiver partnerships.
func (h *Handler) Elders(w http.ResponseWriter, r *http.Request) {
	type caregiver struct {
		CaregiverID int    `json:"caregiver_id"`
		FullName    string `json:"full_name"`
	}
	type elder struct {
		UserID               int         `json:"user_id"`
		FullName             string      `json:"full_name"`
		LastCheckin          *time.Time  `json:"last_checkin"`
		TotalCheckins        int         `json:"total_checkins"`
		CheckinsLast7Days    int         `json:"checkins_last_7_days"`
		AvgMoodLast7Days     *float64    `json:"avg_mood_last_7_days"`
		AvgActivityLast7Days *float64    `json:"avg_activity_last_7_days"`
		OpenAlertCount       int         `json:"open_alert_count"`
		Caregivers           []caregiver `json:"caregivers"`
	}
	rows, err := h.DB.Query(`
		SELECT u.user_id, u.full_name,
		       (SELECT MAX(checkin_time) FROM check_ins ci WHERE ci.user_id = u.user_id),
		       (SELECT COUNT(*) FROM check_ins ci WHERE ci.user_id = u.user_id),
		       (SELECT COUNT(*) FROM check_ins ci WHERE ci.user_id = u.user_id AND ci.checkin_time >= now() - interval '7 days'),
		       (SELECT AVG(mood) FROM check_ins ci WHERE ci.user_id = u.user_id AND ci.checkin_time >= now() - interval '7 days'),
		       (SELECT AVG(activity_level) FROM check_ins ci WHERE ci.user_id = u.user_id AND ci.checkin_time >= now() - interval '7 days'),
		       (SELECT COUNT(*) FROM anomalies a WHERE a.user_id = u.user_id AND a.is_resolved = FALSE)
		FROM users u ORDER BY u.full_name`)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	out := []elder{}
	byUserID := map[int]int{}
	for rows.Next() {
		var item elder
		var lastCheckin sql.NullTime
		var avgMood, avgActivity sql.NullFloat64
		if err := rows.Scan(&item.UserID, &item.FullName, &lastCheckin, &item.TotalCheckins, &item.CheckinsLast7Days, &avgMood, &avgActivity, &item.OpenAlertCount); err != nil {
			continue
		}
		if lastCheckin.Valid {
			item.LastCheckin = &lastCheckin.Time
		}
		if avgMood.Valid {
			item.AvgMoodLast7Days = &avgMood.Float64
		}
		if avgActivity.Valid {
			item.AvgActivityLast7Days = &avgActivity.Float64
		}
		byUserID[item.UserID] = len(out)
		out = append(out, item)
	}
	partners, err := h.DB.Query(`SELECT uc.user_id, c.caregiver_id, c.full_name FROM user_caregiver uc JOIN caregivers c ON c.caregiver_id = uc.caregiver_id WHERE uc.is_active = TRUE ORDER BY c.full_name`)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer partners.Close()
	for partners.Next() {
		var userID int
		var item caregiver
		if err := partners.Scan(&userID, &item.CaregiverID, &item.FullName); err == nil {
			if index, ok := byUserID[userID]; ok {
				out[index].Caregivers = append(out[index].Caregivers, item)
			}
		}
	}
	claims := auth.FromContext(r.Context())
	h.DB.Exec(`INSERT INTO audit_logs(account_id,action,target_type) VALUES($1,'view_elder_statistics','elder')`, claims.AccountID)
	writeJSON(w, http.StatusOK, out)
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
