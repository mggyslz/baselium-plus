// Package notification turns anomalies into caregiver/family alerts.
// D6: family viewers only see high-severity anomalies.
// D7: multi-caregiver ack-once, log all.
// FCM/WebSocket push are stubbed as logged sends in this template — swap in
// real integrations in internal/notification/fcm.go and websocket.go.
package notification

import (
	"database/sql"
	"fmt"
	"time"
)

type Notification struct {
	NotificationID int
	AnomalyID      int
	CaregiverID    int
	Message        string
	SentAt         time.Time
	IsRead         bool
	AcknowledgedAt *time.Time
	AcknowledgedBy *int
}

// DispatchForAnomaly creates one notification per active caregiver assigned
// to the elder (reliability target: dispatched immediately; retry logic
// would live in fcm.go for real push failures).
func DispatchForAnomaly(db *sql.DB, anomalyID, userID int, severity, anomalyType, reason string) error {
	rows, err := db.Query(
		`SELECT caregiver_id FROM user_caregiver WHERE user_id = $1 AND is_active = TRUE`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	message := fmt.Sprintf("[%s] %s alert: %s", severity, anomalyType, reason)

	var caregiverIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			caregiverIDs = append(caregiverIDs, id)
		}
	}
	for _, cgID := range caregiverIDs {
		result, err := db.Exec(
			`INSERT INTO notifications (anomaly_id, caregiver_id, message)
			 SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE anomaly_id = $1 AND caregiver_id = $2)`,
			anomalyID, cgID, message,
		)
		if err != nil {
			return err
		}
		created, _ := result.RowsAffected()
		if created == 0 {
			continue
		}
		// stub push — see fcm.go / websocket.go
		fmt.Printf("[push-stub] caregiver=%d anomaly=%d msg=%q\n", cgID, anomalyID, message)
	}

	// D6: family viewers only notified on high severity, and only get a
	// generic status ping (not the detailed reason/message).
	if severity == "high" {
		frows, err := db.Query(`SELECT family_id FROM family_access WHERE user_id = $1 AND is_active = TRUE`, userID)
		if err == nil {
			defer frows.Close()
			for frows.Next() {
				var fid int
				frows.Scan(&fid)
				fmt.Printf("[push-stub] family=%d anomaly=%d msg=%q\n", fid, anomalyID, "A high-priority status alert was raised for your family member.")
			}
		}
	}
	return nil
}

// Acknowledge implements D7: one ack resolves the alert for every caregiver
// on the elder (marks the underlying anomaly resolved), but logs which
// caregiver actually clicked and when.
func Acknowledge(db *sql.DB, anomalyID, ackingCaregiverID int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE anomalies SET is_resolved = TRUE WHERE anomaly_id = $1`, anomalyID); err != nil {
		return err
	}
	// Every caregiver's notification row for this anomaly gets marked
	// acknowledged (system-wide resolution)...
	if _, err := tx.Exec(
		`UPDATE notifications SET is_read = TRUE, acknowledged_at = now(), acknowledged_by = $2 WHERE anomaly_id = $1`,
		anomalyID, ackingCaregiverID,
	); err != nil {
		return err
	}
	return tx.Commit()
}

func ListForCaregiver(db *sql.DB, caregiverID int) ([]Notification, error) {
	rows, err := db.Query(
		`SELECT notification_id, anomaly_id, caregiver_id, message, sent_at, is_read, acknowledged_at, acknowledged_by
		 FROM notifications WHERE caregiver_id = $1 ORDER BY sent_at DESC LIMIT 100`, caregiverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.NotificationID, &n.AnomalyID, &n.CaregiverID, &n.Message, &n.SentAt, &n.IsRead, &n.AcknowledgedAt, &n.AcknowledgedBy); err == nil {
			out = append(out, n)
		}
	}
	return out, nil
}
