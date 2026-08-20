## Phase 1 — Requirements & System Design ✅ (mostly done via proposal)

- [x] Objectives, functional/non-functional requirements
- [x] Functional Diagram, DFD, Context Diagram, Architectural Diagram, ERD
- [x] Finalize ERD into actual Postgres migration files

## Phase 2 — Core Module Development

- [x] Set up Go project skeleton (`cmd/api`, `internal/*`)
- [x] Set up Postgres + run initial migration from ERD
- [ ] `sqlc` config + generate types from `accounts`, `users`, `caregivers`, `family_access`, `user_caregiver`
- [x] Auth: signup/login, JWT issuing, role middleware
- [x] Check-in submission endpoint (mood, activity, context note)
- [x] Basic caregiver dashboard shell (React) — auth + routing only

## Phase 3 — Behavioral Intelligence Development

- [x] `internal/baseline`: rolling mean/stddev computation over 7-day window
- [x] `internal/baseline`: compute `checkin_frequency` (fraction of expected check-ins submitted over the window)
- [x] Cold-start handling (<7 days history → conservative thresholds)
- [x] `internal/anomaly`: deviation detection logic
- [x] `internal/anomaly`: `frequency_deviation` detection (sustained drop in checkin_frequency vs. baseline)
- [x] Severity classification (magnitude in stddevs + duration in days)
- [ ] Scheduled worker to recompute baselines daily

## Phase 4 — Notification Development

- [ ] FCM integration (`internal/notification/fcm.go`)
- [ ] WebSocket live alerts (`internal/notification/websocket.go`)
- [ ] Retry logic for undelivered notifications
- [x] Multi-caregiver acknowledgment logic (ack-once, log who/when)
- [ ] Family viewer: grant/revoke access, high-severity-only notify

## Phase 5 — Integration & Testing

- [ ] Synthetic check-in data generator (`scripts/seed_synthetic_data.go`)
- [ ] Inject known anomalies at controlled rate/magnitude
- [ ] Measure recall (target ≥90%) and false-positive rate (target <10%)
- [ ] Tune deviation thresholds against test results
- [ ] End-to-end test: check-in → baseline update → anomaly → alert → ack

## Phase 6 — Evaluation & Refinement

- [ ] Review against functional/non-functional requirements
- [ ] Refine thresholds based on final test data
- [ ] Polish dashboard (trend charts and triage view are implemented; downloadable reports remain)
- [ ] Audit log review for Data Privacy Act compliance
- [ ] Prep for final defense

## Backlog / Nice-to-have

- [ ] Downloadable PDF/CSV activity reports
- [ ] Health notes UI (caregiver manual entries)
- [ ] Audit log viewer for admins
