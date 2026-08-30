# Baselium+

A behavioral monitoring system for the elderly that builds a **per-elder statistical baseline** from daily self-reported check-ins, and alerts caregivers in real time when behavior deviates from that baseline — with an explainable reason attached, not just a generic notification.

## What it does
- Elders check in daily via a mobile app (mood, activity, optional note).
- The system learns a rolling 7-day statistical baseline per elder.
- Deviations from that baseline are detected, classified by severity, and pushed to caregivers as in-app alerts.
- Caregivers get a dashboard with trends, alert history, downloadable reports, and (if managing multiple elders) a severity-sorted triage view.
- Family members can be granted read-only access, and are notified only on high-severity anomalies.

## Who it's for
| Role | Access |
|---|---|
| **Elder** | Submits daily check-ins, receives reminders |
| **Caregiver** | Full dashboard, alerts, reports, manages elder/family access |
| **Family Viewer** | Read-only status view, high-severity alerts only |

## Tech stack
- **Elder client (current):** responsive React web check-in screen (React Native deferred)
- **Web:** React
- **Backend:** Go (Gin/Echo) + sqlc
- **Database:** PostgreSQL
- **Notifications:** WebSockets for active dashboards (FCM deferred; see D13)
- **Auth:** JWT, role-based

## Repo layout (backend)
```
internal/
├── auth/          # JWT, role middleware
├── checkin/       # daily check-in capture
├── baseline/      # rolling mean/stddev/frequency computation
├── anomaly/       # deviation detection + severity classification
├── notification/  # FCM, WebSocket, retry logic
├── dashboard/     # trends, triage view, reports
├── family/        # read-only access grant/revoke
└── audit/         # audit_logs (Data Privacy Act compliance)
```

## Entity-Relationship Diagram

> Editable Mermaid ERD — matches the DBML schema this project is built from. Edit this block directly (add/remove fields or tables) and it re-renders anywhere Mermaid is supported (GitHub, most Markdown editors, VS Code with a Mermaid extension).

```mermaid
erDiagram
    ACCOUNTS ||--o| USERS : "has profile"
    ACCOUNTS ||--o| CAREGIVERS : "has profile"
    ACCOUNTS ||--o| FAMILY_ACCESS : "has profile"
    USERS ||--o{ FAMILY_ACCESS : "grants access to"
    CAREGIVERS ||--o{ FAMILY_ACCESS : "granted by"
    USERS ||--o{ USER_CAREGIVER : "assigned"
    CAREGIVERS ||--o{ USER_CAREGIVER : "assigned"
    USERS ||--o{ CHECK_INS : "submits"
    USERS ||--o{ BEHAVIORAL_BASELINES : "has"
    USERS ||--o{ ANOMALIES : "flagged for"
    BEHAVIORAL_BASELINES ||--o{ ANOMALIES : "compared against"
    CHECK_INS ||--o| ANOMALIES : "may trigger"
    ANOMALIES ||--o{ NOTIFICATIONS : "generates"
    CAREGIVERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ HEALTH_NOTES : "documented in"
    CAREGIVERS ||--o{ HEALTH_NOTES : "authors"
    ACCOUNTS ||--o{ AUDIT_LOGS : "performs"

    ACCOUNTS {
        int account_id PK
        varchar email UK
        varchar password_hash
        varchar role "caregiver, elder, family"
        boolean is_active
        timestamp created_at
        timestamp last_login
    }

    USERS {
        int user_id PK
        int account_id FK
        varchar full_name
        date date_of_birth
        varchar gender
        text address
        varchar contact_number
        timestamp created_at
    }

    CAREGIVERS {
        int caregiver_id PK
        int account_id FK
        varchar full_name
        varchar contact_number
        varchar relationship
        timestamp created_at
    }

    FAMILY_ACCESS {
        int family_id PK
        int account_id FK
        int user_id FK "elder being viewed"
        varchar full_name
        varchar relationship
        int granted_by FK "caregiver"
        boolean is_active
        timestamp created_at
    }

    USER_CAREGIVER {
        int id PK
        int user_id FK
        int caregiver_id FK
        timestamp assigned_at
        boolean is_active
    }

    CHECK_INS {
        int checkin_id PK
        int user_id FK
        timestamp checkin_time
        int mood "1-5"
        int activity_level "1-5"
        text notes
        text context_note
        boolean is_missed
        timestamp created_at
    }

    BEHAVIORAL_BASELINES {
        int baseline_id PK
        int user_id FK
        float avg_mood_score
        float avg_activity_level
        float stddev_mood
        float stddev_activity
        float checkin_frequency "fraction of expected checkins submitted"
        int sample_size
        int period_days
        boolean is_active
        timestamp computed_at
    }

    ANOMALIES {
        int anomaly_id PK
        int user_id FK
        int baseline_id FK
        int checkin_id FK "nullable, missed checkin"
        varchar anomaly_type "mood_deviation, activity_deviation, frequency_deviation, missed_checkin"
        varchar severity "low, medium, high"
        varchar deviation_metric
        float deviation_magnitude "in stddevs"
        int duration_days
        timestamp detected_at
        boolean is_resolved
    }

    NOTIFICATIONS {
        int notification_id PK
        int anomaly_id FK
        int caregiver_id FK
        text message
        timestamp sent_at
        boolean is_read
        timestamp acknowledged_at
    }

    HEALTH_NOTES {
        int note_id PK
        int user_id FK
        int caregiver_id FK
        text note_text
        timestamp created_at
    }

    AUDIT_LOGS {
        int log_id PK
        int account_id FK
        varchar action "view_checkin, export_report, acknowledge_alert"
        varchar target_type
        int target_id
        timestamp created_at
    }
```

The raw source of truth for this schema (DBML format, used to generate the actual Postgres migrations) lives in `schema.dbml` — edit that file if you're going to run migrations, and update this Mermaid block to match so the docs don't drift.

## Docs
- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — goals, architecture, coding rules, constraints, implementation status
- [`TODO.md`](./TODO.md) — current tasks by phase
- [`DECISIONS.md`](./DECISIONS.md) — why key architectural decisions were made
