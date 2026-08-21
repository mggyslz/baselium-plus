package checkin

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"baselium/backend/internal/auth"
	"baselium/backend/internal/baseline"
	"baselium/backend/internal/db"
	"baselium/backend/internal/notification"
)

// TestCheckinToAlertToAcknowledgement exercises the critical user flow against
// a real PostgreSQL database. Set BASELIUM_TEST_DATABASE to opt in; use a
// disposable database because this test creates and removes fixture accounts.
func TestCheckinToAlertToAcknowledgement(t *testing.T) {
	databaseName := os.Getenv("BASELIUM_TEST_DATABASE")
	if databaseName == "" {
		t.Skip("set BASELIUM_TEST_DATABASE to run PostgreSQL end-to-end tests")
	}
	conn, err := db.Connect(env("DB_HOST", "localhost"), env("DB_PORT", "5432"), env("DB_USER", "postgres"), env("DB_PASSWORD", "postgres"), databaseName, env("DB_SSLMODE", "disable"))
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	defer conn.Close()

	stamp := time.Now().UnixNano()
	elderAccountID, elderID := createElder(t, conn, stamp)
	caregiverAccountID, caregiverID := createCaregiver(t, conn, stamp)
	t.Cleanup(func() {
		conn.Exec(`DELETE FROM accounts WHERE account_id IN ($1, $2)`, elderAccountID, caregiverAccountID)
	})
	if _, err := conn.Exec(`INSERT INTO user_caregiver (user_id, caregiver_id) VALUES ($1, $2)`, elderID, caregiverID); err != nil {
		t.Fatalf("assign caregiver: %v", err)
	}

	// A stable history makes a 1/5 submission an obvious deviation. The oldest
	// sample is over 7 days old, so the baseline is no longer cold-start.
	for day := 8; day >= 2; day-- {
		mood := 3 + day%2
		if _, err := conn.Exec(`INSERT INTO check_ins (user_id, checkin_time, mood, activity_level) VALUES ($1, $2, $3, $3)`, elderID, time.Now().AddDate(0, 0, -day), mood); err != nil {
			t.Fatalf("seed history: %v", err)
		}
	}
	if _, err := baseline.Compute(conn, elderID); err != nil {
		t.Fatalf("compute baseline: %v", err)
	}

	auth.SetSecret("test-secret")
	token, err := auth.IssueToken(elderAccountID, elderID, "elder")
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/checkins", bytes.NewBufferString(`{"mood":1,"activity_level":1,"notes":"integration test"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	auth.Require("elder")(http.HandlerFunc(NewHandler(conn).Submit)).ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("submit status = %d: %s", rec.Code, rec.Body.String())
	}
	var response struct {
		Anomalies []struct {
			AnomalyID int `json:"AnomalyID"`
		} `json:"anomalies_raised"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(response.Anomalies) == 0 {
		t.Fatalf("expected an anomaly after outlier check-in: %s", rec.Body.String())
	}

	anomalyID := response.Anomalies[0].AnomalyID
	var notificationCount int
	if err := conn.QueryRow(`SELECT COUNT(*) FROM notifications WHERE anomaly_id = $1 AND caregiver_id = $2`, anomalyID, caregiverID).Scan(&notificationCount); err != nil || notificationCount != 1 {
		t.Fatalf("notification count = %d, err = %v; want 1", notificationCount, err)
	}
	if err := notification.Acknowledge(conn, anomalyID, caregiverID); err != nil {
		t.Fatalf("acknowledge: %v", err)
	}
	var resolved, read bool
	if err := conn.QueryRow(`SELECT a.is_resolved, n.is_read FROM anomalies a JOIN notifications n ON n.anomaly_id = a.anomaly_id WHERE a.anomaly_id = $1`, anomalyID).Scan(&resolved, &read); err != nil {
		t.Fatalf("read acknowledgement: %v", err)
	}
	if !resolved || !read {
		t.Fatalf("acknowledgement state resolved=%v read=%v, want true/true", resolved, read)
	}
}

func createElder(t *testing.T, conn *sql.DB, stamp int64) (int, int) {
	t.Helper()
	var accountID, userID int
	if err := conn.QueryRow(`INSERT INTO accounts (email, password_hash, role) VALUES ($1, 'test', 'elder') RETURNING account_id`, "e2e-elder-"+itoa(stamp)+"@test.invalid").Scan(&accountID); err != nil {
		t.Fatalf("create elder account: %v", err)
	}
	if err := conn.QueryRow(`INSERT INTO users (account_id, full_name) VALUES ($1, 'E2E Elder') RETURNING user_id`, accountID).Scan(&userID); err != nil {
		t.Fatalf("create elder profile: %v", err)
	}
	return accountID, userID
}

func createCaregiver(t *testing.T, conn *sql.DB, stamp int64) (int, int) {
	t.Helper()
	var accountID, caregiverID int
	if err := conn.QueryRow(`INSERT INTO accounts (email, password_hash, role) VALUES ($1, 'test', 'caregiver') RETURNING account_id`, "e2e-caregiver-"+itoa(stamp)+"@test.invalid").Scan(&accountID); err != nil {
		t.Fatalf("create caregiver account: %v", err)
	}
	if err := conn.QueryRow(`INSERT INTO caregivers (account_id, full_name) VALUES ($1, 'E2E Caregiver') RETURNING caregiver_id`, accountID).Scan(&caregiverID); err != nil {
		t.Fatalf("create caregiver profile: %v", err)
	}
	return accountID, caregiverID
}

func itoa(value int64) string {
	return strconv.FormatInt(value, 10)
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
