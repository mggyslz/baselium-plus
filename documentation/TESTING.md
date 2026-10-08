# Testing Baselium+

## Automated checks

From `backend`:

```powershell
go test ./...
```

This covers baseline arithmetic, severity boundaries, frequency severity, and a deterministic quality gate.

**Thresholds (specification, see D18/D5):** z = (x − μ) / max(σ, 0.5); baseline excludes days with |z| ≥ 1.5; anomaly flagged at |z| ≥ 1.5 on 3+ consecutive days; |z| ≥ 2.5 during cold start (<7 days); severity Low 1.5–<2.0, Medium 2.0–<3.0, High ≥3.0, raised one level at 5+ consecutive days.

**Existing regression check:** the deterministic calibration produced 100% recall for 20 injected extreme (1/5) mood deviations and 0% false positives for 100 normal 3-5 samples around a 4/5 baseline. It was calibrated against an earlier threshold set (1.5 SD detection, medium at three consecutive days, high at 2.5 SD sustained for four days), so it **must be re-run after the code is confirmed to match D18**. It is a regression check, not the evaluation protocol below and not a substitute for a real-user study.

## Evaluation protocol (proposal objective 3) — not yet run

See D19 for rationale. Planned procedure:

1. **Dataset:** generate at least 30 synthetic 30-day histories. Each has a normal 7-day initial baseline period, then one seeded deviation: a sustained shift of ≥3.5 SD in mood or activity for ≥5 consecutive days.
2. **Recall:** share of seeded deviations alerted within the seeded window or up to two days after it ends. Target ≥90%.
3. **False-positive rate:** share of histories with an alert raised outside that window. Target <10%.
4. **Sensitivity analysis:** repeat with shifts of 1.5 to <3.5 SD; report separately, not counted toward the targets.
5. **Alert delivery:** use `notification_delivery_attempts` to show dispatch within 5 minutes of detection.
6. **Offline sync reliability:** simulate connectivity interruptions; ≥99% of cached check-ins must sync without loss or duplication. *(Requires the sync protocol in D20.)*
7. **Availability:** automated health-check requests at fixed intervals over ≥7 continuous days; target 99.9%.

Results from the existing synthetic generator (`scripts/seed_synthetic_data`) cannot be reported against these targets until it can produce this dataset design.

## Frontend tests (Vitest + React Testing Library)

From `frontend`:

```powershell
npm test            # run once (vitest run)
npm run test:watch  # watch mode
```

Test files live in `frontend/src/__tests__/` and are included automatically via `vite.config.js`:

- `api.test.ts` — unit tests for the API client (`request` helper): URL/query building, auth header, JSON POST body, 204 → `null`, and error mapping. Uses a mocked `global.fetch`, no network.
- `CaregiverDashboard.test.tsx` — component tests for the `AccessManagement` tab: listing family members, empty state, assign / grant / revoke flows, and the error path. Uses `vi.spyOn` on the `api` module.

Config: `vite.config.js` sets the jsdom environment, a setup file (`src/test/setup.ts`) that registers jest-dom matchers and per-test cleanup, and `globals: false` (tests import from `vitest` explicitly).

## End-to-end database test

Use a disposable PostgreSQL database with the migration already applied:

```powershell
$env:BASELIUM_TEST_DATABASE = "baselium_test"
go test ./internal/checkin -run TestCheckinToAlertToAcknowledgement -v
```

The test creates uniquely named elder/caregiver fixtures, seeds a stable check-in history, submits an outlier through the protected HTTP handler, verifies that a notification is created, acknowledges it, and removes its accounts afterward.

## Synthetic demo data

The generator only inserts data; it never deletes existing records.

```powershell
go run ./scripts/seed_synthetic_data --user-id 1 --scenario normal
go run ./scripts/seed_synthetic_data --user-id 1 --scenario mood-drop
go run ./cmd/worker/main.go
```

Use `--days 14` (the default) to control the history length. The `mood-drop` scenario makes the latest four daily entries 1/5 for both mood and activity.