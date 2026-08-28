package main

import (
	"baselium/backend/internal/auth"
	"baselium/backend/internal/config"
	"baselium/backend/internal/db"
	"fmt"
	"log"
	"os"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func main() {
	if err := config.LoadDotEnv(); err != nil {
		log.Fatalf("load .env: %v", err)
	}
	conn, err := db.Connect(env("DB_HOST", "localhost"), env("DB_PORT", "5432"), env("DB_USER", "postgres"), env("DB_PASSWORD", "postgres"), env("DB_NAME", "baselium"), env("DB_SSLMODE", "disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	hash, err := auth.HashPassword("secret123")
	if err != nil {
		log.Fatal(err)
	}
	tx, err := conn.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()
	var id int
	err = tx.QueryRow(`INSERT INTO accounts(email,password_hash,role) VALUES('admin1@test.com',$1,'admin') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING account_id`, hash).Scan(&id)
	if err != nil {
		log.Fatal(err)
	}
	_, err = tx.Exec(`INSERT INTO admins(account_id,full_name) VALUES($1,'Test Administrator') ON CONFLICT(account_id) DO NOTHING`, id)
	if err != nil {
		log.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Admin ready: admin1@test.com / secret123")
}
