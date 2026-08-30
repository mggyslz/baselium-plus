package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"baselium/backend/internal/admin"
	"baselium/backend/internal/auth"
	"baselium/backend/internal/checkin"
	"baselium/backend/internal/config"
	"baselium/backend/internal/dashboard"
	"baselium/backend/internal/db"
	"baselium/backend/internal/family"
	"baselium/backend/internal/healthnote"
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
	return "" // unreachable; keeps the compiler aware this function returns.
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func main() {
	if err := config.LoadDotEnv(); err != nil {
		log.Fatalf("load .env: %v", err)
	}
	auth.SetSecret(requiredEnv("JWT_SECRET"))

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
	log.Println("connected to postgres")

	authH := auth.NewHandler(conn)
	checkinH := checkin.NewHandler(conn)
	dashH := dashboard.NewHandler(conn)
	familyH := family.NewHandler(conn)
	healthNoteH := healthnote.NewHandler(conn)
	adminH := admin.NewHandler(conn)
	notifH := notification.NewHandler(conn)
	hub := notification.NewHub()
	notification.SetHub(hub)
	go notification.RunRetryLoop(conn, hub, 15*time.Second)

	mux := http.NewServeMux()

	// public
	mux.HandleFunc("POST /api/auth/signup", authH.Signup)
	mux.HandleFunc("POST /api/auth/login", authH.Login)
	mux.HandleFunc("POST /api/auth/refresh", authH.Refresh)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// elder
	mux.Handle("POST /api/checkins", auth.Require("elder")(http.HandlerFunc(checkinH.Submit)))
	mux.Handle("GET /api/checkins", auth.Require("elder", "caregiver")(http.HandlerFunc(checkinH.History)))
	mux.Handle("GET /api/health-notes", auth.Require("caregiver")(http.HandlerFunc(healthNoteH.List)))
	mux.Handle("POST /api/health-notes", auth.Require("caregiver")(http.HandlerFunc(healthNoteH.Create)))

	// caregiver
	mux.Handle("GET /api/dashboard/triage", auth.Require("caregiver")(http.HandlerFunc(dashH.Triage)))
	mux.Handle("GET /api/dashboard/trend", auth.Require("caregiver", "elder", "admin")(http.HandlerFunc(dashH.Trend)))
	mux.Handle("GET /api/dashboard/alerts", auth.Require("caregiver", "family", "admin")(http.HandlerFunc(dashH.AlertHistory)))
	mux.Handle("GET /api/dashboard/report", auth.Require("caregiver")(http.HandlerFunc(dashH.ExportReport)))
	mux.Handle("POST /api/dashboard/baseline/reset", auth.Require("caregiver")(http.HandlerFunc(dashH.ResetBaseline)))
	mux.Handle("GET /api/notifications", auth.Require("caregiver")(http.HandlerFunc(notifH.List)))
	mux.Handle("POST /api/notifications/ack", auth.Require("caregiver")(http.HandlerFunc(notifH.Ack)))
	mux.Handle("POST /api/notifications/review", auth.Require("caregiver")(http.HandlerFunc(notifH.Review)))
	mux.Handle("GET /api/notifications/live", hub)
	mux.Handle("POST /api/family/revoke", auth.Require("caregiver")(http.HandlerFunc(familyH.Revoke)))
	mux.Handle("POST /api/family/grant", auth.Require("caregiver")(http.HandlerFunc(familyH.Grant)))
	mux.Handle("GET /api/family/members", auth.Require("caregiver")(http.HandlerFunc(familyH.Members)))
	mux.Handle("POST /api/caregiver/assign", auth.Require("caregiver")(http.HandlerFunc(familyH.Assign)))
	mux.Handle("GET /api/caregiver/elders", auth.Require("caregiver", "admin")(http.HandlerFunc(dashH.PaginatedElders)))
	mux.Handle("GET /api/admin/overview", auth.Require("admin")(http.HandlerFunc(adminH.Overview)))
	mux.Handle("GET /api/admin/accounts", auth.Require("admin")(http.HandlerFunc(adminH.Accounts)))
	mux.Handle("GET /api/admin/elders", auth.Require("admin")(http.HandlerFunc(adminH.Elders)))
	mux.Handle("GET /api/admin/audit-logs", auth.Require("admin")(http.HandlerFunc(adminH.AuditLogs)))
	mux.Handle("POST /api/admin/assign", auth.Require("admin")(http.HandlerFunc(adminH.Assign)))

	// family
	mux.Handle("GET /api/family/status", auth.Require("family")(http.HandlerFunc(familyH.Status)))

	addr := ":" + env("PORT", "8080")
	log.Printf("Baselium+ API listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}
