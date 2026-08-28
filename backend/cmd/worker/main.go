// cmd/worker recomputes every elder's rolling baseline. Run it once (for a
// manual/demo trigger) or on a cron/daily schedule in production — see
// README "Running the daily worker".
package main

import (
	"flag"
	"log"
	"os"
	"time"

	"baselium/backend/internal/anomaly"
	"baselium/backend/internal/baseline"
	"baselium/backend/internal/config"
	"baselium/backend/internal/db"
	"baselium/backend/internal/notification"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func requiredEnv(key string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	log.Fatalf("%s must be set (copy .env.example to .env for local development)", key)
	return ""
}

func main() {
	if err := config.LoadDotEnv(); err != nil {
		log.Fatalf("load .env: %v", err)
	}
	once := flag.Bool("once", false, "run once and exit (useful for manual runs and cron)")
	interval := flag.Duration("interval", 24*time.Hour, "time between baseline recomputations")
	flag.Parse()
	conn, err := db.Connect(
		env("DB_HOST", "localhost"),
		env("DB_PORT", "5432"),
		requiredEnv("DB_USER"),
		requiredEnv("DB_PASSWORD"),
		env("DB_NAME", "baselium"),
		env("DB_SSLMODE", "disable"),
	)
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}
	defer conn.Close()

	run := func() {
		rows, err := conn.Query(`SELECT user_id FROM users`)
		if err != nil {
			log.Printf("query users failed: %v", err)
			return
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
			var lastCheckin time.Time
			if err := conn.QueryRow(`SELECT MAX(checkin_time) FROM check_ins WHERE user_id = $1`, uid).Scan(&lastCheckin); err != nil || lastCheckin.IsZero() {
				continue // do not alert before an elder has ever checked in
			}
			hoursSince := time.Since(lastCheckin).Hours()
			if hoursSince <= 24 {
				continue
			}
			a, err := anomaly.EnsureMissedCheckin(conn, uid, hoursSince)
			if err != nil {
				log.Printf("user %d: missed-checkin detection failed: %v", uid, err)
				continue
			}
			if a != nil {
				if err := notification.DispatchForAnomaly(conn, a.AnomalyID, uid, a.Severity, a.AnomalyType, a.Reason); err != nil {
					log.Printf("user %d: missed-checkin dispatch failed: %v", uid, err)
				}
			}
		}
		log.Printf("done: %d elders processed", len(userIDs))
	}

	run()
	if *once {
		return
	}
	if *interval <= 0 {
		log.Fatal("interval must be positive")
	}
	log.Printf("baseline scheduler started; interval=%s", *interval)
	ticker := time.NewTicker(*interval)
	defer ticker.Stop()
	for range ticker.C {
		run()
	}
}
