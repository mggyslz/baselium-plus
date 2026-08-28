package main

import (
	"baselium/backend/internal/config"
	"baselium/backend/internal/db"
	"flag"
	"fmt"
	"log"
	"math/rand/v2"
	"os"
	"time"
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
	userID := flag.Int("user-id", 1, "elder users.user_id to seed")
	days := flag.Int("days", 14, "number of daily check-ins to add")
	scenario := flag.String("scenario", "normal", "normal or mood-drop")
	flag.Parse()
	if *userID < 1 || *days < 7 || (*scenario != "normal" && *scenario != "mood-drop") {
		log.Fatal("use a positive user-id, at least 7 days, and scenario normal or mood-drop")
	}
	conn, err := db.Connect(env("DB_HOST", "localhost"), env("DB_PORT", "5432"), requiredEnv("DB_USER"), requiredEnv("DB_PASSWORD"), env("DB_NAME", "baselium"), env("DB_SSLMODE", "disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	for day := *days; day >= 1; day-- {
		mood, activity := 4, 4
		if *scenario == "normal" {
			mood += rand.IntN(3) - 1
			activity += rand.IntN(3) - 1
		} else if day <= 4 {
			mood, activity = 1, 1
		}
		if _, err := conn.Exec(`INSERT INTO check_ins (user_id,checkin_time,mood,activity_level,notes) VALUES($1,$2,$3,$4,$5)`, *userID, time.Now().AddDate(0, 0, -day), mood, activity, "synthetic "+*scenario+" check-in"); err != nil {
			log.Fatal(err)
		}
	}
	fmt.Printf("Added %d %s check-ins for elder %d. Run the worker next.\n", *days, *scenario, *userID)
}
