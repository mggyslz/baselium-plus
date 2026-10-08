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
- Provide an **Admin** interface for account management, caregiver–elder assignment, and audit-log review.
- Offline-first check-in capture with local caching and automatic sync is a proposal commitment; only a basic web-client offline queue exists today (D20).

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
| Backend | Go (stdlib `net/http`); `sqlc` not adopted (see D8) |
| Database | PostgreSQL |
| Auth | JWT access tokens (15 min) + rotating refresh tokens, role-based (elder / caregiver / family / admin) |
| Push notifications | WebSockets for active dashboard sessions; FCM deferred (see D13) |
| Live updates | WebSockets (gorilla/websocket) |

**Actors:** Elder, Caregiver, Family Viewer, Admin (see `family_access` and `user_caregiver` tables — many-to-many between elders and caregivers).

## Coding Rules
- Backend folder structure mirrors the 5 functional modules (checkin, baseline, anomaly, notification, dashboard) — see `README.md` for the tree.
- All DB access goes through the `db` helper in the backend. `sqlc` was planned but not adopted (see D8); keep SQL out of handlers where practical.
- Every account-level action that touches check-ins, reports, or alerts must write to `audit_logs` (Data Privacy Act compliance).
- Anomaly logic lives only in `internal/anomaly` and `internal/baseline` — no anomaly-detection math inline in handlers.
- Roles are enforced via middleware, not per-handler checks — new endpoints must declare which role(s) can access them.
- No ML models. Anomaly detection = rolling mean/stddev only, on purpose (explainability requirement).

## Important Constraints
- **7-day rolling window** for baseline (mean, stddev, and check-in frequency — stored as `checkin_frequency` on `behavioral_baselines`, the fraction of expected check-ins actually submitted). Chosen to balance stability vs. responsiveness.
- **Scoring and detection (D18):** z = (x − μ) / max(σ, σ_min) with σ_min = 0.5; baseline excludes days with |z| ≥ 1.5; an anomaly is flagged at |z| ≥ 1.5 on 3 or more consecutive days. Frequency deviations are scored the same way.
- **Cold-start rule:** fewer than 7 days of check-in history → use the conservative threshold |z| ≥ 2.5 (flag only missed check-ins + extreme values), not the full statistical model.
- **Severity classification (D5):** from the largest |z| in the run — Low 1.5–<2.0, Medium 2.0–<3.0, High ≥3.0 — raised one level when the deviation persists for 5+ consecutive days. Any missed check-in > 24 hrs is High.
- **Multi-caregiver ack rule:** if an elder has multiple caregivers, one acknowledgment marks the alert acknowledged system-wide, but the log records *who* and *when*.
- **Family Viewer** only gets notified on high-severity anomalies; never sees detailed check-in history.
- **Reliability target:** alerts dispatched within 5 minutes of detection; failed pushes retried, surfaced as in-app badge on reconnect.
- **Testing targets (D19):** on ≥30 synthetic 30-day histories each seeded with a ≥3.5 SD shift for 5+ days: ≥90% recall (alert within the window or up to 2 days after) and <10% false-positive rate (share of histories with an alert outside the window); milder 1.5–<3.5 SD shifts reported separately as sensitivity analysis. Also: alert dispatch ≤5 min, ≥99% offline-sync reliability, 99.9% availability over ≥7 days.
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
- [x] Admin dashboard (account overview, caregiver–elder assignment, audit-log viewer, elder statistics)
- [x] Refresh-token rotation, login throttling, notification delivery-attempt log
- [ ] Mobile React Native check-in app (the responsive web check-in screen is available instead)
- [ ] Offline-first sync protocol per proposal (one check-in/day constraint, last-write-wins, clock sanity check, 11:59 PM lock) — only a basic web offline queue exists
- [ ] Smartwatch conceptual prototype
- [ ] Evaluation run per D19 (30 histories, sync reliability, 7-day availability)
- [ ] Verify `internal/baseline` / `internal/anomaly` against D18 and re-run tests

## Known Problems
> Log issues here as they come up during development.
- Threshold values documented in earlier `TESTING.md` (medium at 3 days, high at 2.5 SD for 4 days) differed from the proposal's rules; docs now follow the proposal (D18) but the code has not been re-verified.
- Schema lacks the proposal's `check_ins.checkin_date` / `synced_at` and `health_notes.anomaly_id` (see README note).
- Caregivers can self-assign elders (`POST /api/caregiver/assign`), whereas the proposal assigns caregivers to elders through the Admin only. Decision pending.
