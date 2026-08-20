# TEST_CREDENTIALS.md

> Login accounts created for manual testing of Baselium+.
> These are local/dev credentials only — never use in a production deployment.

## Accounts

All accounts share the same password: **`secret123`** (meets the 8-char minimum).

| Role | Email | Password | Profile |
|---|---|---|---|
| Elder | `elder1@test.com` | `secret123` | user_id 1 — "Test Elder" |
| Caregiver | `caregiver1@test.com` | `secret123` | caregiver_id 1 — "Test Caregiver" (nurse) |
| Family Viewer | `family1@test.com` | `secret123` | family_id 1 — "Test Family" (daughter) |

## How they're linked (important)

- The **caregiver** is assigned the **elder** via the `user_caregiver` join,
  so the caregiver's triage view shows "Test Elder".
- The **family viewer** is linked to the elder via `family_access.user_id = 1`,
  granted by the caregiver (`granted_by = caregiver_id 1`), which lets them see
  the read-only status page.

These links were set up directly in the database. There is currently **no UI**
to create them — see `APPLICATION_STATUS.md` "Known gaps".

## How to log in

1. Ensure both servers are running:
   - Backend: `cd backend; go run cmd/api/main.go`
   - Frontend: `cd frontend; npm run dev`
2. Open `http://localhost:5173`.
3. Enter one of the emails above with password `secret123`.
   - Elder → check-in page
   - Caregiver → caregiver dashboard
   - Family Viewer → read-only status page

## Demo flow (see it all work)

1. Log in as the **elder** and submit a daily check-in (mood/activity 1–5).
2. Run the baseline worker: `cd backend; go run cmd/worker/main.go`
3. Log in as the **caregiver** → see the elder in triage + trend/alert history.
4. Submit a low check-in (e.g. mood=1, activity=1) as the elder to trigger an
   anomaly → the caregiver sees the alert and can acknowledge it; the **family
   viewer** sees a rising "Open high-priority alerts" count.

## Note
- PostgreSQL superuser is `postgres` / password `postgres` (local dev), database
  `baselium`. See `APPLICATION_STATUS.md` for details.
- If accounts are missing from the app, re-run setup in the README / migration,
  then recreate them via signup (or direct SQL).