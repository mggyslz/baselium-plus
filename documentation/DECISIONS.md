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
**Decision:** Elders with <7 days of check-in history get a conservative default threshold (flag only missed check-ins and extreme values, i.e. |z| ≥ 2.5 instead of the standard 1.5 — see D18) instead of a fully computed baseline.
**Why:** A statistical baseline computed on too little data is unreliable and would either over- or under-flag. Falling back to simple rules avoids false confidence in an immature baseline.

### D5 — Severity classification by magnitude + duration
**Decision:** Severity (low/medium/high) is based on both deviation magnitude (largest |z| in the run) and duration in consecutive days. Bands: **Low** 1.5 to <2.0, **Medium** 2.0 to <3.0, **High** ≥3.0, raised by one level when the deviation persists for 5 or more consecutive days. Separately, any missed check-in >24h is High (project rule; the proposal's z-score description does not cover missed check-ins).
**Why:** A single bad day shouldn't trigger the same alert as a multi-day decline. Combining magnitude and persistence reduces noise from one-off fluctuations while still catching acute events (missed check-ins) quickly. Bands and the persistence rule follow the proposal (Fig. 5a, process 3.3); they are default parameters that may be tuned during testing.

### D6 — Family Viewer notified only on high-severity anomalies
**Decision:** Family members get read-only status + high-severity alerts only, never full check-in history or low/medium anomalies.
**Why:** Privacy boundary — family access is meant to keep them informed without duplicating full caregiver privileges. Reduces alert fatigue for a secondary, optional role.

### D7 — Multi-caregiver acknowledgment: ack-once, log all
**Decision:** When an elder has multiple caregivers, one acknowledgment resolves the alert system-wide, but the acknowledging caregiver and timestamp are logged.
**Why:** Avoids duplicate/conflicting responses to the same alert while preserving accountability (who actually responded) for the rest of the care team.

### D8 — Backend: Go over Python/Node
**Decision:** Go (Gin/Echo) + `sqlc` for the backend.
**Why:** The reliability requirement (5-minute alert dispatch, retry logic, checking many elders concurrently) fits Go's goroutine-based concurrency well. Trade-off: no numpy/pandas, so rolling mean/stddev is hand-written — acceptable since it's simple arithmetic (~30-40 lines).
**Status update:** the implementation uses the standard library `net/http` with a `db` helper and raw SQL. Gin/Echo and `sqlc` were not adopted (see `TODO.md`, Phase 2).

### D9 — Mobile: React Native over Flutter
**Decision:** React Native for the elder check-in app.
**Why:** Shares JS/TS with the web dashboard (also React), so the team isn't context-switching between Dart and JS across the two frontends. Trade-off: Flutter has arguably smoother custom UI out of the box, but that matters less for a deliberately simple check-in screen.
**Status update:** the React Native client is not built. A responsive React web check-in screen is the current elder client (see D20).

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

### D18 — Z-score scoring and detection rules (aligned to the proposal)
**Decision:** Every metric (mood, activity, and check-in frequency) is scored as a z-score:

`z = (x − μ) / max(σ, σ_min)`

where `x` is the day's value, `μ` and `σ` are the rolling 7-day mean and standard deviation, and `σ_min = 0.5` on the 1–5 scale. Rules:
- **Std-dev floor:** `σ_min = 0.5`, so a nearly constant history does not inflate small changes into large z-scores.
- **Baseline exclusion:** each day's baseline is computed from the preceding seven days and **excludes days with |z| ≥ 1.5**, so a developing deviation does not pull its own baseline toward it.
- **Detection:** an anomaly is flagged when |z| ≥ 1.5 on **three or more consecutive days**.
- **Cold start:** until seven days of history exist, the threshold is |z| ≥ 2.5 (see D4).
- **Severity:** from the largest |z| in the run, Low 1.5–<2.0 / Medium 2.0–<3.0 / High ≥3.0, raised one level at ≥5 consecutive days (see D5).
- **Frequency deviations** (a sustained drop in check-in rate, D12) are scored the same way.
- All values are default parameters and may be tuned during testing.

**Why:** Per-day noise means a shift near 1.5 SD rarely produces three consecutive flagged days, so the 3-day rule suppresses one-off fluctuations (consistent with D5) while the floor and exclusion rules keep the baseline from masking or exaggerating real change. Everything stays explainable rolling statistics (D2).
**Status:** Mood and activity scoring now implement these rules and have focused regression tests. Frequency-deviation scoring remains open because the schema stores only an aggregate frequency, not a historical frequency standard deviation (see `TODO.md`, "Paper alignment").

### D19 — Evaluation protocol follows the proposal's objective 3
**Decision:** Detection accuracy is evaluated on a labeled set of **at least 30 synthetic 30-day check-in histories**, each seeded with one controlled deviation introduced after the initial 7-day baseline period: a sustained shift of ≥3.5 SD in mood or activity for ≥5 consecutive days.
- **Recall** = share of seeded deviations alerted within the seeded window or up to two days after it ends (target ≥90%).
- **False-positive rate** = share of histories with an alert raised *outside* that window (target <10%).
- **Sensitivity analysis:** milder shifts of 1.5 to <3.5 SD are tested and reported separately; they do not count toward the targets.
- **Other targets:** alert dispatch within 5 minutes of detection; ≥99% of offline-cached check-ins synchronized without loss or duplication across simulated connectivity interruptions; 99.9% availability measured by automated health checks at fixed intervals over ≥7 continuous days.

**Why:** These are the success criteria the proposal commits to, so the project is judged against the same definitions it was approved with.
**Status:** Not yet run. The earlier deterministic check (20 injected 1/5 mood values vs. 100 normal samples, counted per sample) is kept only as a regression test; it is not this protocol. The offline-sync and availability tests do not exist yet.

### D20 — Proposal commitments not yet delivered
**Decision:** The following proposal items are recorded as not yet implemented and are listed as limitations in `EVALUATION.md` rather than described as done:
- **Offline-first mobile check-in app** (React Native, device-local cache, automatic sync). Only a basic offline queue in the responsive web client exists (`TODO.md`, Frontend follow-up).
- **Sync rules:** one check-in per elder per day (unique constraint on elder + check-in date), last-write-wins by device timestamp with server receipt time as tiebreaker, device timestamps >24h ahead of the server clock replaced by server time, and a check-in editable until 11:59 PM local time then locked. `schema.dbml` has no `checkin_date`/`synced_at` columns yet.
- **Local reminders:** the proposal schedules daily reminders on the elder's device, not on the server. Any server-side reminder in the escalation plan (D17) is a different feature.
- **Smartwatch check-in prototype:** a non-functional, high-fidelity conceptual prototype, not started.

**Why:** Keeping docs honest about the gap between proposal and build avoids over-claiming at defense; each item is either implemented later or presented as future work.
