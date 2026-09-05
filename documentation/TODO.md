# TODO.md

> Planned work by phase. Checked = implemented in the current working state (last updated after the caregiver
> **Access management** tab shipped).

## Phase 1 — Requirements & System Design ✅ (mostly done via proposal)

- [x] Objectives, functional/non-functional requirements
- [x] Functional Diagram, DFD, Context Diagram, Architectural Diagram, ERD
- [x] Finalize ERD into actual Postgres migration files

## Phase 2 — Core Module Development

- [x] Set up Go project skeleton (`cmd/api`, `internal/*`)
- [x] Set up Postgres + run initial migration from ERD
- [ ] `sqlc` config + generate types from `accounts`, `users`, `caregivers`, `family_access`, `user_caregiver`
      (not adopted — DB access uses a `db` helper + raw SQL; either adopt sqlc or consciously close this item)
- [x] Auth: signup/login, JWT issuing, role middleware
- [x] Check-in submission endpoint (mood, activity, context note)
- [x] Caregiver dashboard shell (React) — role-routed with triage, elder detail (trend chart + alert history), notifications tab

## Phase 3 — Behavioral Intelligence Development

- [x] `internal/baseline`: rolling mean/stddev computation over 7-day window
- [x] `internal/baseline`: compute `checkin_frequency` (fraction of expected check-ins submitted over the window)
- [x] Cold-start handling (<7 days history → conservative thresholds)
- [x] `internal/anomaly`: deviation detection logic
- [x] `internal/anomaly`: `frequency_deviation` detection (sustained drop in checkin_frequency vs. baseline)
- [x] Severity classification (magnitude in stddevs + duration in days)
- [x] Scheduled worker to recompute baselines daily

## Phase 4 — Notification Development

- [x] WebSocket live alerts (`internal/notification/websocket.go`) — hub keyed by `caregiver_id`,
      JWT-authenticated on connect, pushed inline from `internal/anomaly` and the missed-check-in
      worker (see D13; FCM intentionally not adopted for now)
- [x] Retry logic for undelivered notifications
- [x] Multi-caregiver acknowledgment logic (ack-once, log who/when)
- [x] Family viewer: high-severity-only notify
- [x] Caregiver **Access** tab — assign elders to self, grant family access, revoke access, list granted family
      (backend `GET /api/family/members` + `POST /api/caregiver/assign`; UI in `CaregiverDashboard.jsx`)

## Phase 5 — Integration & Testing

- [x] Synthetic check-in data generator (`scripts/seed_synthetic_data.go`)
- [x] Inject known anomalies at controlled rate/magnitude
- [x] Measure recall (target ≥90%) and false-positive rate (target <10%)
- [x] Tune deviation thresholds against test results
- [x] End-to-end test: check-in → baseline update → anomaly → alert → ack
- [x] Protect elder records with caregiver/family assignment checks; prevent unauthorized alert acknowledgements
- [x] Detect and dispatch missed-check-in alerts from the scheduled worker (one open alert per lapse)
- [x] Suppress duplicate notifications for an existing anomaly

## Phase 6 — Evaluation & Refinement

- [x] Review against functional/non-functional requirements — see `EVALUATION.md`.
- [x] Refine thresholds based on deterministic synthetic test data — 100% recall for 20 injected
      extreme deviations and 0% false positives for 100 normal samples; real-user validation remains a limitation.
- [x] Polish dashboard — trend charts, triage view, and caregiver-authorized Excel activity reports.
- [x] Audit log review for Data Privacy Act compliance — access, check-in, alert, health-note, report,
      and admin-view actions are logged; deployment security requirements are documented in `EVALUATION.md`.
- [x] Prep for final defense — evidence and demonstration checklist are in `EVALUATION.md`.

## Bugs

- [x] Elder check-in heading no longer renders an empty name.

## Backlog / Nice-to-have

- [x] Downloadable Excel (.xlsx) activity reports — caregiver-authorized server-side export with
      check-in history, alert log, and summary sheet (see D14 — PDF/CSV not adopted)
- [x] Health notes UI: caregiver note composer and chronological note history in elder detail
- [x] Health notes API: caregivers can create and list notes for assigned elders (`GET`/`POST /api/health-notes`)
- [x] Audit log viewer for admins (read-only recent actions, search, refresh, and access audit trail)
- [x] Admin Elder View: seven-day check-in statistics, open-alert counts, and active caregiver partnerships

### Behavioral intelligence / alerting enhancements
- [x] Trend-aware severity: track whether a deviation is worsening, stable, or
      improving across consecutive days, not just a single-day flag
- [x] Caregiver feedback loop: let a caregiver mark an alert as false positive/reviewed
      (annotation only — display and triage use, does not feed back into baseline or
      threshold computation; see D16, resolved to preserve D2's explainable-only stance)
- [ ] Missed check-in escalation tiers: day 1 = reminder, day 2-3 = caregiver
      notified, beyond that = optional emergency contact ping (builds on the existing
      missed-check-in worker logic from Phase 5, not new from scratch)
- [x] Surface elder-submitted `notes`/`context_note` alongside the related anomaly alert,
      so caregivers see the elder's own explanation, not just a severity score
- [x] Baseline reset action for caregivers — lets them manually invalidate a stale
      baseline (e.g. after a hospital stay) instead of waiting for false anomalies to age out

### Elder-facing UX
- [x] Elder-side input alternatives: emoji-scale and voice note options alongside
      the numeric 1-5 mood/activity input

### Recommended next focus (UI/UX first)

The core backend flow is complete enough for the current scope. Prioritize a polished,
accessible experience before adding broad new backend modules:

- [x] Simplify elder check-ins with vector SVG icon scales, large touch targets, plain language,
      optional voice input, and clear submit confirmation.
- [x] Make alert cards immediately actionable: severity, what changed, onset date,
      elder context note, and acknowledge/review controls in one place.
- [x] Add helpful dashboard empty, loading, and failure states, including clear
      check-in and acknowledgement feedback.
- [x] Improve accessibility and mobile use: high contrast, larger text, visible focus
      states, keyboard navigation, and responsive layouts.
- [ ] Implement missed-check-in escalation tiers: day 1 elder reminder; days 2-3
      caregiver notification; later optional emergency-contact escalation. This is the
      next backend feature with the strongest connection to the monitoring objective.

### Caregiver-facing UX
- [ ] Caregiver alert digest: batch low-severity alerts into a daily summary
      instead of real-time push for everything
- [ ] Scheduled report emailing: auto-generate and email a weekly PDF report
      to caregivers instead of manual download

### Frontend follow-up (priority order)
- [x] Make Family Viewer access invitation-only: remove or restrict public family signup so
      a caregiver grant is the sole supported access path, preserving the D6 privacy boundary.
- [x] Add offline-ready elder check-ins: queue a completed check-in locally when offline,
      show its pending state clearly, and synchronize it automatically after reconnecting.
- [x] Expand frontend tests for elder check-in submission and errors, Family Viewer's restricted
      view, caregiver triage/acknowledgement/report download, and WebSocket-driven updates.
- [x] Replace `frontend/README.md`'s default Vite content with frontend setup, environment
      variables, role routes, test commands, and API configuration; reconcile the main docs'
      React Native and offline-ready statements with the delivered responsive web app.
- [x] Code-split role dashboards with lazy-loaded routes to reduce the production JavaScript
      bundle (currently above Vite's 500 kB warning threshold).

### Security / reliability (RA 10173 + 5-minute alert SLA)
- [x] JWT refresh/rotation instead of a flat ~24h expiry with no refresh token
- [x] Login rate limiting / attempt throttling
- [x] Audit log the viewing of audit logs by admins (see D15)
- [x] Log failed notification delivery attempts to a table (not just silent retry),
      so the 5-minute alert SLA can be demonstrated with real data during the defense
