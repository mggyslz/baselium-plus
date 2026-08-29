# DECISIONS.md

Record of *why*, not just *what*. Add a new entry whenever a meaningful architectural or design choice is made or changed.

---

### D1 — Self-reported check-ins instead of sensors/wearables
**Decision:** Use lightweight self-reported daily check-ins (mood, activity 1–5 scale) instead of ambient/wearable sensors.
**Why:** Sensor-based systems require hardware procurement, in-home installation, and ongoing maintenance — this limits adoption in home-based caregiving. Self-report keeps the system accessible and low-cost, at the trade-off of relying on the elder actually checking in.

### D2 — Rolling statistical baseline instead of machine learning
**Decision:** Anomaly detection uses a fixed 7-day rolling mean/stddev window, not an ML model.
**Why:** Interpretability. Caregivers and family members need to understand *why* something was flagged (explainability objective). A rolling stats model produces auditable thresholds; ML would need training data and be a black box — out of scope for this study.

### D3 — 7-day window size
**Decision:** Baseline computed over a 7-day rolling window.
**Why:** Balances having enough samples for a stable baseline against staying responsive to real behavioral shifts. Shorter windows react faster but are noisier; longer windows are stable but slow to catch real change.

### D4 — Cold-start / conservative default thresholds
**Decision:** Elders with <7 days of check-in history get a conservative default threshold (flag only missed check-ins + extreme values) instead of a computed baseline.
**Why:** A statistical baseline computed on too little data is unreliable and would either over- or under-flag. Falling back to simple rules avoids false confidence in an immature baseline.

### D5 — Severity classification by magnitude + duration
**Decision:** Severity (low/medium/high) is based on both deviation magnitude (in std devs) and duration in consecutive days. High severity requires large + sustained deviation, or any missed check-in >24h.
**Why:** A single bad day shouldn't trigger the same alert as a multi-day decline. Combining magnitude and persistence reduces noise from one-off fluctuations while still catching acute events (missed check-ins) quickly.

### D6 — Family Viewer notified only on high-severity anomalies
**Decision:** Family members get read-only status + high-severity alerts only, never full check-in history or low/medium anomalies.
**Why:** Privacy boundary — family access is meant to keep them informed without duplicating full caregiver privileges. Reduces alert fatigue for a secondary, optional role.

### D7 — Multi-caregiver acknowledgment: ack-once, log all
**Decision:** When an elder has multiple caregivers, one acknowledgment resolves the alert system-wide, but the acknowledging caregiver and timestamp are logged.
**Why:** Avoids duplicate/conflicting responses to the same alert while preserving accountability (who actually responded) for the rest of the care team.

### D8 — Backend: Go over Python/Node
**Decision:** Go (Gin/Echo) + `sqlc` for the backend.
**Why:** The reliability requirement (5-minute alert dispatch, retry logic, checking many elders concurrently) fits Go's goroutine-based concurrency well. Trade-off: no numpy/pandas, so rolling mean/stddev is hand-written — acceptable since it's simple arithmetic (~30-40 lines).

### D9 — Mobile: React Native over Flutter
**Decision:** React Native for the elder check-in app.
**Why:** Shares JS/TS with the web dashboard (also React), so the team isn't context-switching between Dart and JS across the two frontends. Trade-off: Flutter has arguably smoother custom UI out of the box, but that matters less for a deliberately simple check-in screen.

### D10 — PostgreSQL over NoSQL
**Decision:** Relational database (PostgreSQL), not a document store.
**Why:** The domain is inherently relational — accounts→users/caregivers/family, many-to-many elder↔caregiver via `user_caregiver`, and anomalies/notifications that reference baselines and check-ins by FK. Postgres also supports window functions useful for rolling-window queries directly in SQL.

### D11 — One active baseline per elder
**Decision:** `behavioral_baselines.is_active` ensures only one baseline row drives anomaly detection at a time per elder, with historical baselines retained.
**Why:** Keeps anomaly detection deterministic (no ambiguity about which baseline is "current") while preserving a history for later review/audit.

### D12 — Added `checkin_frequency` field to `behavioral_baselines`
**Decision:** Added a `checkin_frequency` float (fraction of expected check-ins actually submitted over `period_days`) to `behavioral_baselines`, and a `frequency_deviation` value to `anomalies.anomaly_type`.
**Why:** The proposal and `PROJECT_CONTEXT.md` describe the baseline as covering "mean, standard deviation, and frequency patterns," but the original schema only tracked mood/activity mean and stddev — frequency wasn't actually storable or detectable as its own anomaly type. This closes that gap so the schema matches what the proposal claims the system does. Note this is distinct from `missed_checkin`, which flags a single missed check-in event; `frequency_deviation` flags a sustained drop in check-in rate over the window.

### D13 — Real-time delivery: WebSocket over FCM
**Decision:** Live in-app alerts are delivered via a WebSocket connection (`internal/notification/websocket.go`), not Firebase Cloud Messaging.
**Why:** The proposal's real-time requirement is caregivers seeing alerts while actively using the dashboard, which is exactly what a persistent WebSocket connection is for — the server pushes the instant an anomaly is flagged, with no external dependency. FCM's value is reaching a caregiver when the app is closed (lock-screen/background push), which is a real feature but isn't what the proposal commits to, and it adds real setup cost (Firebase project, device token management, platform-specific config) that isn't justified yet. FCM remains a reasonable future-work item if background push becomes a requirement. Trade-off: a caregiver who has fully closed the app gets no alert until they reopen it; this is acceptable for the current scope since the 5-minute SLA is measured against active dashboard sessions.

### D14 — Report export: Excel only, no PDF/CSV
**Decision:** Downloadable activity reports are exported as standards-compliant `.xlsx` workbooks generated server-side, not PDF or CSV.
**Why:** Excel is more useful to caregivers than CSV (native formatting, multiple sheets, no separate viewer needed) and is simpler to generate correctly than PDF for tabular trend/alert data (no layout/pagination work). Generating server-side reuses the same trend and alert-history queries already powering the dashboard, so this is a new renderer, not new data modeling. Trade-off: a caregiver who wants a single print-ready page (e.g., to hand to a doctor) doesn't get one — PDF export is left as a possible future addition if that need comes up.

### D15 — Audit-log viewing is logged
**Decision:** Viewing the audit-log viewer and admin elder statistics writes an audit entry.
**Why:** These screens expose personal and security-relevant operational data. Recording their access provides a clear accountability trail for the final privacy review. The viewer filters its own `view_audit_logs` entry from the returned list to avoid confusing the administrator with a recursive-looking event.

### D16 — Caregiver "false positive" feedback deferred, not adopted as threshold-adjusting
**Decision:** The backlog item allowing caregivers to mark an alert as a false positive, with that feedback nudging the elder's detection threshold over time, is deferred and will **not** feed back into baseline/threshold computation if implemented.
**Why:** D2 commits to explainable, auditable rolling-statistics detection specifically to avoid a black-box model. Letting caregiver feedback silently reweight thresholds would reintroduce exactly that opacity — the detection logic would start depending on an unaudited, per-elder-tuned history that isn't visible in the stats themselves. If this feature is built, it will be scoped as caregiver annotation only (marking an alert reviewed/dismissed for their own triage view), stored and displayed but never fed back into `internal/baseline` or `internal/anomaly` computation, preserving D2's explainable-only stance.

### D17 — Emergency escalation deferred pending consent and a delivery provider
**Decision:** Missed-check-in escalation stops at caregiver WebSocket/in-app notification for now; no emergency contact is pinged automatically.
**Why:** Emergency outreach requires an explicit consent record, verified contact details, escalation policy, delivery provider, and handling for failed delivery. Creating an external contact action without those safeguards would be unsafe. The existing missed-check-in worker remains the foundation for a future tiered implementation.
