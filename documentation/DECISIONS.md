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
