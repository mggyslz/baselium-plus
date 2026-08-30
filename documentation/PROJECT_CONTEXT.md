# PROJECT_CONTEXT.md

## Project Name
**Baselium+** — A Behavioral Monitoring System for the Elderly with Statistical Anomaly Detection

## Project Goals
- Let elders submit a simple daily check-in (mood, activity, optional context note) from a mobile app.
- Build a **per-elder statistical baseline** (rolling mean + stddev over a 7-day window) instead of generic pass/fail check-ins.
- Automatically detect **deviations** from that baseline and classify them by severity (low/medium/high).
- Push **real-time in-app alerts** to caregivers, each with an explainable reason (metric, magnitude, duration) — not just a generic notification.
- Give caregivers a **dashboard**: trend visualization, alert history, downloadable reports, and a severity-sorted **triage view** for caregivers managing multiple elders.
- Support **read-only Family Viewer** access, notified only on high-severity anomalies.
- Comply with the **Data Privacy Act of 2012 (RA 10173)**: encryption in transit/at rest, role-restricted access, audit logging.
- Stay **hardware-free** — no wearables/sensors, no ML model. Just self-reported check-ins + rolling statistics.
- Offline-ready synchronization is planned; the current responsive web client requires a connection.

## Architecture
**4-layer architecture** (per the proposal's Architectural Diagram):

1. **Presentation Layer**
   - Check-In Interface (mobile, React Native) — Elder
   - Caregiver Dashboard (web, React) — Caregiver
   - Family Viewer (web, read-only) — Family
2. **Application/Service Layer**
   - Check-in handling, authentication, reporting logic (Go backend)
3. **Intelligence & Notification Layer**
   - Behavioral Intelligence Engine — rolling baseline computation, anomaly detection
   - Notification Engine — turns anomalies into alerts/reminders
4. **Data Layer**
   - PostgreSQL — check-ins, baselines, anomalies, notifications, audit logs

**Tech stack**
| Layer | Choice |
|---|---|
| Elder client (current) | Responsive React web check-in screen; React Native mobile client deferred |
| Web | React |
| Backend | Go (Gin/Echo) + sqlc |
| Database | PostgreSQL |
| Auth | JWT, role-based (elder / caregiver / family) |
| Push notifications | WebSockets for active dashboard sessions; FCM deferred (see D13) |
| Live updates | WebSockets (gorilla/websocket) |

**Actors:** Elder, Caregiver, Family Viewer (see `family_access` and `user_caregiver` tables — many-to-many between elders and caregivers).

## Coding Rules
- Backend folder structure mirrors the 5 functional modules (checkin, baseline, anomaly, notification, dashboard) — see `README.md` for the tree.
- All DB access goes through `sqlc`-generated code — never hand-write raw SQL calls outside `internal/db/queries/*.sql`.
- Every account-level action that touches check-ins, reports, or alerts must write to `audit_logs` (Data Privacy Act compliance).
- Anomaly logic lives only in `internal/anomaly` and `internal/baseline` — no anomaly-detection math inline in handlers.
- Roles are enforced via middleware, not per-handler checks — new endpoints must declare which role(s) can access them.
- No ML models. Anomaly detection = rolling mean/stddev only, on purpose (explainability requirement).

## Important Constraints
- **7-day rolling window** for baseline (mean, stddev, and check-in frequency — stored as `checkin_frequency` on `behavioral_baselines`, the fraction of expected check-ins actually submitted). Chosen to balance stability vs. responsiveness.
- **Cold-start rule:** fewer than 7 days of check-in history → use conservative default thresholds (flag only missed check-ins + extreme values), not the full statistical model.
- **Severity classification:** based on deviation magnitude (in std devs) *and* duration in consecutive days. High severity = large + sustained, or any missed check-in > 24 hrs.
- **Multi-caregiver ack rule:** if an elder has multiple caregivers, one acknowledgment marks the alert acknowledged system-wide, but the log records *who* and *when*.
- **Family Viewer** only gets notified on high-severity anomalies; never sees detailed check-in history.
- **Reliability target:** alerts dispatched within 5 minutes of detection; failed pushes retried, surfaced as in-app badge on reconnect.
- **Testing target (provisional):** ≥90% recall on injected anomalies, <10% false-positive rate on normal simulated data.
- Only one `behavioral_baselines` row per elder should be `is_active = true` at a time.

## Current Implementation
- [x] Database schema (see `DECISIONS.md` for ERD source of truth)
- [x] Auth (JWT + roles)
- [x] Check-in submission endpoint
- [x] Baseline computation worker
- [x] Anomaly detector
- [x] Notification dispatch (WebSocket; FCM intentionally deferred per D13)
- [x] Caregiver dashboard (React), including Excel report export
- [x] Family viewer read-only view
- [ ] Mobile React Native check-in app (the responsive web check-in screen is available instead)

## Known Problems
> Log issues here as they come up during development.
- None yet — pre-implementation stage.
