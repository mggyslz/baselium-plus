package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strings"
)

// NOTE: For a production system, use bcrypt/argon2 (golang.org/x/crypto).
// This template uses salted SHA-256 with many iterations to avoid pulling in
// golang.org/x/* dependencies, which are unreachable from this sandbox's
// network allowlist. Swap in bcrypt once you run this outside the sandbox —
// see README "Hardening before production".
const iterations = 100_000

func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := deriveKey(password, salt)
	return fmt.Sprintf("%s$%s", hex.EncodeToString(salt), hex.EncodeToString(hash)), nil
}

func VerifyPassword(password, stored string) bool {
	parts := strings.SplitN(stored, "$", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return false
	}
	saltHex, hashHex := parts[0], parts[1]
	salt, err := hex.DecodeString(saltHex)
	if err != nil {
		return false
	}
	expected, err := hex.DecodeString(hashHex)
	if err != nil {
		return false
	}
	actual := deriveKey(password, salt)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func deriveKey(password string, salt []byte) []byte {
	h := sha256.New()
	h.Write(salt)
	h.Write([]byte(password))
	sum := h.Sum(nil)
	for i := 0; i < iterations; i++ {
		h.Reset()
		h.Write(sum)
		sum = h.Sum(nil)
	}
	return sum
}
