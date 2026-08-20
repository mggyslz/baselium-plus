package db

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

// Connect opens a connection pool to Postgres using the given DSN parts.
func Connect(host, port, user, password, dbname, sslmode string) (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode,
	)
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening db: %w", err)
	}
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("pinging db: %w", err)
	}
	return conn, nil
}
