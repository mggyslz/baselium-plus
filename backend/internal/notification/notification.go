// Package notification persists caregiver alerts and delivers them in-app.
package notification

import (
	"database/sql"
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

var defaultHub *Hub

// SetHub installs the API process's live-delivery hub.
func SetHub(h *Hub) { defaultHub = h }

// DispatchForAnomaly persists and immediately attempts delivery for each caregiver.
func DispatchForAnomaly(db *sql.DB, anomalyID, userID int, severity, anomalyType, reason string) error {
	rows, err := db.Query(`SELECT caregiver_id FROM user_caregiver WHERE user_id = $1 AND is_active = TRUE`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()
	message := "[" + severity + "] " + anomalyType + " alert: " + reason
	for rows.Next() {
		var caregiverID, notificationID int
		if err := rows.Scan(&caregiverID); err != nil {
			return err
		}
		err := db.QueryRow(`INSERT INTO notifications (anomaly_id, caregiver_id, message) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE anomaly_id = $1 AND caregiver_id = $2) RETURNING notification_id`, anomalyID, caregiverID, message).Scan(&notificationID)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return err
		}
		attemptDelivery(db, defaultHub, Notification{NotificationID: notificationID, AnomalyID: anomalyID, CaregiverID: caregiverID, Message: message, SentAt: time.Now()})
	}
	return rows.Err()
}

func attemptDelivery(db *sql.DB, hub *Hub, n Notification) {
	delivered := hub != nil && hub.Publish(n.CaregiverID, LiveAlert{Type: "notification", NotificationID: n.NotificationID, AnomalyID: n.AnomalyID, Message: n.Message, SentAt: n.SentAt})
	if delivered {
		_, _ = db.Exec(`UPDATE notifications SET delivery_attempts = delivery_attempts + 1, delivered_at = now() WHERE notification_id = $1`, n.NotificationID)
		return
	}
	// Exponential retry capped at five minutes; REST remains the durable source.
	_, _ = db.Exec(`UPDATE notifications SET delivery_attempts = delivery_attempts + 1, next_delivery_at = now() + (LEAST(300, 5 * power(2, delivery_attempts)) * interval '1 second') WHERE notification_id = $1`, n.NotificationID)
}

// RetryPending is run by the API process, which owns WebSocket connections.
func RetryPending(db *sql.DB, hub *Hub) error {
	rows, err := db.Query(`SELECT notification_id, anomaly_id, caregiver_id, message, sent_at, is_read, acknowledged_at, acknowledged_by FROM notifications WHERE delivered_at IS NULL AND next_delivery_at <= now() ORDER BY next_delivery_at LIMIT 100`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.NotificationID, &n.AnomalyID, &n.CaregiverID, &n.Message, &n.SentAt, &n.IsRead, &n.AcknowledgedAt, &n.AcknowledgedBy); err == nil {
			attemptDelivery(db, hub, n)
		}
	}
	return rows.Err()
}
func RunRetryLoop(db *sql.DB, hub *Hub, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		_ = RetryPending(db, hub)
	}
}

func Acknowledge(db *sql.DB, anomalyID, ackingCaregiverID int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE anomalies SET is_resolved = TRUE WHERE anomaly_id = $1`, anomalyID); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE notifications SET is_read = TRUE, acknowledged_at = now(), acknowledged_by = $2 WHERE anomaly_id = $1`, anomalyID, ackingCaregiverID); err != nil {
		return err
	}
	return tx.Commit()
}
func ListForCaregiver(db *sql.DB, caregiverID int) ([]Notification, error) {
	rows, err := db.Query(`SELECT notification_id, anomaly_id, caregiver_id, message, sent_at, is_read, acknowledged_at, acknowledged_by FROM notifications WHERE caregiver_id = $1 ORDER BY sent_at DESC LIMIT 100`, caregiverID)
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
	return out, rows.Err()
}
