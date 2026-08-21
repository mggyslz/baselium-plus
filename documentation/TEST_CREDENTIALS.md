# Test credentials

Local development accounts only. All passwords are `secret123`.

| Role | Email | Profile |
|---|---|---|
| Elder | `elder1@test.com` | user_id 1 — Test Elder |
| Caregiver | `caregiver1@test.com` | caregiver_id 1 — Test Caregiver |
| Family Viewer | `family1@test.com` | family_id 1 — Test Family |
| Admin | `admin1@test.com` | admin_id 1 — Test Administrator |

The caregiver is assigned to the elder. Family access is linked to that elder.
The administrator has system-wide oversight and creates caregiver–elder assignments.

After applying `backend/migrations/0002_admin_role.sql`, create the admin account once:

```powershell
cd backend
go run ./scripts/seed_admin
```

Log in at `http://localhost:5173`. The admin dashboard provides account counts,
an account list, open-alert and assignment totals, and caregiver assignment.
