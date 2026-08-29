package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	AccountID int    `json:"account_id"`
	Role      string `json:"role"`
	// ProfileID is the users.user_id / caregivers.caregiver_id / family_access.family_id
	// row matching this account, resolved at login for convenience.
	ProfileID int `json:"profile_id"`
	jwt.RegisteredClaims
}

var jwtSecret []byte

const AccessTokenLifetime = 15 * time.Minute

func SetSecret(secret string) { jwtSecret = []byte(secret) }

func IssueToken(accountID, profileID int, role string) (string, error) {
	claims := Claims{
		AccountID: accountID,
		Role:      role,
		ProfileID: profileID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenLifetime)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ParseToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
