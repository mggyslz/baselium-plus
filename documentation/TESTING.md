# Testing Baselium+

## Automated checks

From `backend`:

```powershell
go test ./...
```

This covers baseline arithmetic, severity boundaries, frequency severity, and a deterministic quality gate. The current calibration uses the documented thresholds: a 1.5-standard-deviation detection threshold, medium at three consecutive days, and high at 2.5 standard deviations sustained for four days.

The deterministic calibration data produced 100% recall for 20 injected extreme (1/5) mood deviations and a 0% false-positive rate for 100 normal 3-5 samples around a 4/5 baseline. This meets the current provisional targets (at least 90% recall and below 10% false positives). It is a regression check, not a substitute for a larger real-user study.

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
