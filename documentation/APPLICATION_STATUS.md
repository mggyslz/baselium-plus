# APPLICATION_STATUS.md

> What is implemented and running in Baselium+ right now (as of the current working state).
> This file tracks the *live* state of the codebase — update it whenever features ship or change.

## Overview

Baselium+ is a full-stack behavioral monitoring system for the elderly. It runs locally as:

| Component | Stack | Run command | Default URL |
|---|---|---|---|
| Backend API | Go (stdlib net/http) | `go run cmd/api/main.go` (or `.\baselium-api.exe`) | `http://localhost:8080` |
| Baseline worker | Go | `go run cmd/worker/main.go` | — (daily scheduler; `--once` for manual/cron use) |
| Frontend | React + Vite | `npm run dev` | `http://localhost:5173` |
| Database | PostgreSQL 16 | Windows service `postgresql-x64-16` | `localhost:5432` / db `baselium` |

Three roles exist: **Elder**, **Caregiver**, and **Family Viewer**, each with its own routed page.

---

## What's implemented

### Testing (frontend) ✅
- Unit tests for the API client (`src/__tests__/api.test.ts`) and component
  tests for the caregiver **Access** tab (`src/__tests__/CaregiverDashboard.test.tsx`).
- Runner: **Vitest** + React Testing Library, jsdom env, run with `npm test`
  from `frontend/`. See [`TESTING.md`](./TESTING.md).

### Authentication & Accounts ✅
- Signup / login with role selection (`elder`, `caregiver`, `family`).
- JWT-based auth (HMAC-SHA256, role embedded in claims), ~24h expiry.
- Role-guarded middleware (`auth.Require(...)`) on protected endpoints.
- Password hashing with salted SHA-256 + 100k iterations
  (`backend/internal/auth/password.go`).
- Role-specific profile rows: `users` (elder), `caregivers`, `family_access`.
- Audit logging on signup / login / alert acknowledgement (`audit_logs`).

### Elder Check-in ✅
- Daily check-in form: mood (1–5), activity level (1–5), optional note.
- Submits to `POST /api/checkins`.
- Elder sees their own recent check-in history.
- On submit, the API returns whether any anomaly was raised.

### Caregiver Dashboard ✅
- **Triage** view: assigned elders sorted worst-first by open severity
  (high > medium > low).
- Per-elder **detail** view: trend chart (mood + activity with baseline line)
  and alert history.
- **Notifications** tab: recent alerts with unread count.
- Acknowledge alerts (`POST /api/notifications/ack`).
- **Access** tab: assign elders to self (`POST /api/caregiver/assign`),
  grant family-viewer access (`POST /api/family/grant`), revoke access
  (`POST /api/family/revoke`), and list granted family members
  (`GET /api/family/members`).
- Only shows elders linked via the `user_caregiver` join table.

### Family Viewer ✅
- Read-only status card: elder's name, last check-in, count of open
  high-severity alerts.
- Follows design rule **D6**: family sees no detailed check-in history and
  only high-severity alerts.
- `GET /api/family/status`.

### Behavioral Intelligence (partial — backend present)
- `internal/baseline` computes rolling baseline (mean / stddev /
  check-in frequency) over a 7-day window, with cold-start handling for
  <7 days of history.
- `internal/anomaly` implements deviation detection + severity classification.
- `cmd/worker/main.go` recomputes baselines for all elders on a 24-hour
  schedule. Use `--once` for a manual/cron run or `--interval 1h` for local testing.


### Database Schema ✅
All 9 tables from `backend/migrations/0001_init.sql` applied:
`accounts`, `users`, `caregivers`, `family_access`, `user_caregiver`,
`check_ins`, `behavioral_baselines`, `anomalies`, `notifications`,
`health_notes`, `audit_logs`.

---

## Known gaps / not yet done
- Notifications are stored in DB but **WebSocket / FCM push delivery is not wired**.
- Mobile React Native check-in app (from the proposal) not present in this repo.
- Cosmetic bug: elder check-in heading renders an empty name
  (`frontend/src/pages/ElderCheckin.jsx`).

---

## Test credentials
See [`TEST_CREDENTIALS.md`](./TEST_CREDENTIALS.md) for the accounts created
for manual testing.

## Related docs
- [`README.md`](./README.md) — architecture, ERD, roles.
- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — goals, constraints.
- [`DECISIONS.md`](./DECISIONS.md) — why choices were made.
- [`TODO.md`](./TODO.md) — planned work by phase.
