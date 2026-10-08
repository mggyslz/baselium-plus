# Phase 6 Evaluation and Final Defense Evidence

## Functional requirements review

| Requirement | Evidence | Status |
|---|---|---|
| Elder daily check-in | Protected check-in form and `POST /api/checkins` | Complete |
| Explainable behavioral baseline | 7-day rolling mean, standard deviation, frequency, and cold-start rules (specified in D18; code alignment with the proposal's thresholds pending) | Implemented — alignment to verify |
| Anomaly alerting | Severity/duration logic, stored notifications, WebSocket delivery, retries | Complete for active dashboard sessions |
| Caregiver dashboard | Triage, charts, alert acknowledgement, health notes, Excel export | Complete |
| Family privacy boundary | Read-only high-severity status only | Complete |
| Accountability | Audit entries for key data actions and admin views | Complete |
| Alert refinement | Trend direction, caregiver review annotation, elder context notes, baseline reset | Complete |
| Admin interface | Account overview, caregiver–elder assignment, audit-log viewer, elder statistics | Complete |
| Mobile app | No React Native client; responsive web check-in screen used instead | Deferred (D9, D20) |
| Offline-first sync | Basic web-client offline queue only; no one-check-in-per-day constraint, last-write-wins or clock check; reliability (≥99%) not measured | Partial / not evaluated (D20) |
| Smartwatch conceptual prototype | Not started | Not started (D20) |
| Availability (99.9% over ≥7 days) | No health-check run yet | Not evaluated (D19) |

## Test evidence

- Backend: `go test ./...`
- Frontend: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`
- Calibration (regression only): deterministic synthetic data gave 100% recall for 20 injected extreme deviations and 0% false positives for 100 normal samples, using an earlier threshold set. It is not a clinical or real-user validation study and is **not** the evaluation described in the proposal.
- Proposal evaluation (D19; see `TESTING.md`): ≥30 synthetic 30-day histories with a ≥3.5 SD shift for 5+ days, recall/false-positive definitions per history, a separate 1.5–<3.5 SD sensitivity analysis, offline-sync reliability and 7-day availability. **Not yet run.**

## Privacy and deployment review

The application enforces JWT roles and caregiver/family assignment checks, and records core data access/actions in `audit_logs`. Access JWTs expire after 15 minutes; refresh tokens are opaque, stored only as hashes, and rotated/revoked on every refresh. Five failed login attempts in 15 minutes per email or source address are throttled. Each live-notification attempt is retained in `notification_delivery_attempts`, including its time, result, and failure reason, providing evidence for the five-minute dispatch SLA. Copy `backend/.env.example` to the ignored `backend/.env` for local configuration; process environment values take precedence. For deployment, set a strong `JWT_SECRET`, enable HTTPS/WSS through a reverse proxy, set `DB_SSLMODE=require` (or stronger), restrict CORS to the production frontend origin, secure database backups/storage, and define retention/incident-response procedures. The development defaults must not be used in production.

## Suggested defense flow

1. Log in as an elder and submit a normal check-in, then show the history.
2. Use the seeded mood-drop scenario to demonstrate baseline, anomaly reason, and severity.
3. Show the connected caregiver dashboard receiving the alert, triage ordering, acknowledgement, health note, and Excel export.
4. Show family’s restricted high-severity-only view and the administrator audit trail.
5. State limitations: no background FCM push, no React Native app or full offline-first sync, no smartwatch prototype, the proposal's 30-history evaluation and availability test not yet run, and no real-user validation.

## Limitations and proposal alignment

The proposal (see the Baselium+ paper) is the reference for scope and success criteria. Items below are open and must be presented as limitations or future work, not as delivered:

| Proposal item | Current state |
|---|---|
| Offline-first mobile app, local cache, auto-sync | Responsive web client with a basic offline queue only |
| One check-in per day, last-write-wins, 24h clock clamp, 11:59 PM lock | Not implemented; schema has `sync_status` but no `checkin_date` / `synced_at` |
| Real-time in-app alerts | In-app (WebSocket) |
| Local, on-device reminders | Not implemented (server-side reminders are a separate, deferred feature, D17) |
| Smartwatch conceptual prototype | Not started |
| Evaluation per objective 3 (30 histories, sensitivity analysis, sync, availability) | Not run; only a regression check exists |
| Anomaly thresholds per Fig. 5a (σ_min, exclusion, 3-day rule, severity bands) | Documented in D18; code verification and test re-run pending |
