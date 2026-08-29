package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"time"
)

const RefreshTokenLifetime = 30 * 24 * time.Hour

func newRefreshToken() (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw := hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	return raw, hex.EncodeToString(sum[:]), nil
}

// CreateSession issues a short-lived bearer token and a one-time refresh token.
func CreateSession(tx *sql.Tx, accountID int, profileID int, role string) (string, string, error) {
	access, err := IssueToken(accountID, profileID, role)
	if err != nil {
		return "", "", err
	}
	raw, hash, err := newRefreshToken()
	if err != nil {
		return "", "", err
	}
	_, err = tx.Exec(`INSERT INTO refresh_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 second'))`, accountID, hash, int64(RefreshTokenLifetime.Seconds()))
	return access, raw, err
}

// RotateRefreshToken revokes the presented token and replaces it atomically.
func RotateRefreshToken(db *sql.DB, raw string) (accountID, profileID int, role, access, refresh string, err error) {
	sum := sha256.Sum256([]byte(raw))
	tx, err := db.Begin()
	if err != nil {
		return 0, 0, "", "", "", err
	}
	defer tx.Rollback()
	var refreshID int
	err = tx.QueryRow(`SELECT rt.refresh_token_id, a.account_id, a.role FROM refresh_tokens rt JOIN accounts a ON a.account_id=rt.account_id WHERE rt.token_hash=$1 AND rt.revoked_at IS NULL AND rt.expires_at > now() AND a.is_active=TRUE FOR UPDATE`, hex.EncodeToString(sum[:])).Scan(&refreshID, &accountID, &role)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			err = errors.New("invalid refresh token")
		}
		return
	}
	profileID, err = resolveProfileIDTx(tx, accountID, role)
	if err != nil {
		return
	}
	access, refresh, err = CreateSession(tx, accountID, profileID, role)
	if err != nil {
		return
	}
	var replacementID int
	err = tx.QueryRow(`SELECT refresh_token_id FROM refresh_tokens WHERE token_hash=$1`, hashRefresh(refresh)).Scan(&replacementID)
	if err != nil {
		return
	}
	_, err = tx.Exec(`UPDATE refresh_tokens SET revoked_at=now(), replaced_by=$2 WHERE refresh_token_id=$1`, refreshID, replacementID)
	if err != nil {
		return
	}
	err = tx.Commit()
	return
}

func hashRefresh(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func resolveProfileIDTx(tx *sql.Tx, accountID int, role string) (int, error) {
	var id int
	var err error
	switch role {
	case "elder":
		err = tx.QueryRow(`SELECT user_id FROM users WHERE account_id=$1`, accountID).Scan(&id)
	case "caregiver":
		err = tx.QueryRow(`SELECT caregiver_id FROM caregivers WHERE account_id=$1`, accountID).Scan(&id)
	case "family":
		err = tx.QueryRow(`SELECT family_id FROM family_access WHERE account_id=$1`, accountID).Scan(&id)
	case "admin":
		err = tx.QueryRow(`SELECT admin_id FROM admins WHERE account_id=$1`, accountID).Scan(&id)
	}
	return id, err
}
