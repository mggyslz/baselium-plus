// cmd/worker recomputes every elder's rolling baseline. Run it once (for a
// manual/demo trigger) or on a cron/daily schedule in production — see
// README "Running the daily worker".
package main

import (
	"log"
	"os"

	"baselium/backend/internal/baseline"
	"baselium/backend/internal/db"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	conn, err := db.Connect(
		env("DB_HOST", "localhost"),
		env("DB_PORT", "5432"),
		env("DB_USER", "postgres"),
		env("DB_PASSWORD", "postgres"),
		env("DB_NAME", "baselium"),
		env("DB_SSLMODE", "disable"),
	)
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}
	defer conn.Close()

	rows, err := conn.Query(`SELECT user_id FROM users`)
	if err != nil {
		log.Fatalf("query users failed: %v", err)
	}
	var userIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			userIDs = append(userIDs, id)
		}
	}
	rows.Close()

	for _, uid := range userIDs {
		b, err := baseline.Compute(conn, uid)
		if err != nil {
			log.Printf("user %d: baseline compute failed: %v", uid, err)
			continue
		}
		log.Printf("user %d: baseline recomputed (samples=%d cold_start=%v freq=%.2f)",
			uid, b.SampleSize, b.IsColdStart, b.CheckinFrequency)
	}
	log.Printf("done: %d elders processed", len(userIDs))
}
