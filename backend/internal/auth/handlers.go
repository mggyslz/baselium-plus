package auth

import (
	"database/sql"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"
)

type Handler struct {
	DB *sql.DB
}

func NewHandler(db *sql.DB) *Handler { return &Handler{DB: db} }

type signupRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	Role         string `json:"role"` // elder | caregiver | family
	FullName     string `json:"full_name"`
	Relationship string `json:"relationship,omitempty"` // for caregiver/family
	// family-only: which elder's user_id they're viewing, and which caregiver granted it
	ElderUserID *int `json:"elder_user_id,omitempty"`
	GrantedByID *int `json:"granted_by_caregiver_id,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// Signup creates an account + role-specific profile row in one transaction.
func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.FullName == "" {
		writeErr(w, http.StatusBadRequest, "email, password, and full_name are required")
		return
	}
	if req.Role != "elder" && req.Role != "caregiver" && req.Role != "family" {
		writeErr(w, http.StatusBadRequest, "role must be elder, caregiver, or family; admin accounts are provisioned separately")
		return
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not hash password")
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "db error")
		return
	}
	defer tx.Rollback()

	var accountID int
	err = tx.QueryRow(
		`INSERT INTO accounts (email, password_hash, role) VALUES ($1, $2, $3) RETURNING account_id`,
		req.Email, hash, req.Role,
	).Scan(&accountID)
	if err != nil {
		writeErr(w, http.StatusConflict, "email already registered or invalid: "+err.Error())
		return
	}

	var profileID int
	switch req.Role {
	case "elder":
		err = tx.QueryRow(
			`INSERT INTO users (account_id, full_name) VALUES ($1, $2) RETURNING user_id`,
			accountID, req.FullName,
		).Scan(&profileID)
	case "caregiver":
		err = tx.QueryRow(
			`INSERT INTO caregivers (account_id, full_name, relationship) VALUES ($1, $2, $3) RETURNING caregiver_id`,
			accountID, req.FullName, req.Relationship,
		).Scan(&profileID)
	case "family":
		if req.ElderUserID == nil {
			writeErr(w, http.StatusBadRequest, "family signup requires elder_user_id")
			return
		}
		err = tx.QueryRow(
			`INSERT INTO family_access (account_id, user_id, full_name, relationship, granted_by)
			 VALUES ($1, $2, $3, $4, $5) RETURNING family_id`,
			accountID, *req.ElderUserID, req.FullName, req.Relationship, req.GrantedByID,
		).Scan(&profileID)
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create profile: "+err.Error())
		return
	}

	if _, err := tx.Exec(
		`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1, 'signup', $2, $3)`,
		accountID, req.Role, profileID,
	); err != nil {
		writeErr(w, http.StatusInternalServerError, "audit log failed")
		return
	}

	token, refreshToken, err := CreateSession(tx, accountID, profileID, req.Role)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create session")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "commit failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"account_id":        accountID,
		"profile_id":        profileID,
		"role":              req.Role,
		"token":             token,
		"refresh_token":     refreshToken,
		"access_expires_at": time.Now().Add(AccessTokenLifetime),
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	remoteAddr := clientAddress(r)
	if h.isThrottled(req.Email, remoteAddr) {
		writeErr(w, http.StatusTooManyRequests, "too many login attempts; try again in 15 minutes")
		return
	}
	var accountID int
	var passwordHash, role string
	var isActive bool
	err := h.DB.QueryRow(
		`SELECT account_id, password_hash, role, is_active FROM accounts WHERE email = $1`,
		req.Email,
	).Scan(&accountID, &passwordHash, &role, &isActive)
	if err == sql.ErrNoRows {
		h.recordFailure(req.Email, remoteAddr)
		writeErr(w, http.StatusUnauthorized, "invalid email or password")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "db error")
		return
	}
	if !isActive {
		writeErr(w, http.StatusForbidden, "account is deactivated")
		return
	}
	if !VerifyPassword(req.Password, passwordHash) {
		h.recordFailure(req.Email, remoteAddr)
		writeErr(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	profileID, err := resolveProfileID(h.DB, accountID, role)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not resolve profile")
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "db error")
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE accounts SET last_login = now() WHERE account_id = $1`, accountID); err != nil {
		writeErr(w, http.StatusInternalServerError, "db error")
		return
	}
	tx.Exec(`DELETE FROM login_failures WHERE email=$1`, req.Email)
	tx.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1, 'login', 'account', $1)`, accountID)
	token, refreshToken, err := CreateSession(tx, accountID, profileID, role)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create session")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "commit failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"account_id":        accountID,
		"profile_id":        profileID,
		"role":              role,
		"token":             token,
		"refresh_token":     refreshToken,
		"access_expires_at": time.Now().Add(AccessTokenLifetime),
	})
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		writeErr(w, http.StatusBadRequest, "refresh_token is required")
		return
	}
	accountID, profileID, role, token, refresh, err := RotateRefreshToken(h.DB, req.RefreshToken)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1, 'refresh_session', 'account', $1)`, accountID)
	writeJSON(w, http.StatusOK, map[string]interface{}{"account_id": accountID, "profile_id": profileID, "role": role, "token": token, "refresh_token": refresh, "access_expires_at": time.Now().Add(AccessTokenLifetime)})
}

func (h *Handler) isThrottled(email, addr string) bool {
	var n int
	if h.DB.QueryRow(`SELECT COUNT(*) FROM login_failures WHERE attempted_at > now() - interval '15 minutes' AND (email=$1 OR remote_addr=$2)`, email, addr).Scan(&n) != nil {
		return false
	}
	return n >= 5
}
func (h *Handler) recordFailure(email, addr string) {
	_, _ = h.DB.Exec(`INSERT INTO login_failures (email, remote_addr) VALUES ($1,$2)`, email, addr)
}
func clientAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func resolveProfileID(db *sql.DB, accountID int, role string) (int, error) {
	var id int
	var err error
	switch role {
	case "elder":
		err = db.QueryRow(`SELECT user_id FROM users WHERE account_id = $1`, accountID).Scan(&id)
	case "caregiver":
		err = db.QueryRow(`SELECT caregiver_id FROM caregivers WHERE account_id = $1`, accountID).Scan(&id)
	case "family":
		err = db.QueryRow(`SELECT family_id FROM family_access WHERE account_id = $1`, accountID).Scan(&id)
	case "admin":
		err = db.QueryRow(`SELECT admin_id FROM admins WHERE account_id = $1`, accountID).Scan(&id)
	}
	return id, err
}
