# Baselium+

> **An AI-Powered Behavioral Monitoring System for the Elderly**

Baselium+ monitors the daily behavioral patterns of elderly individuals and detects anomalies that may indicate health or safety concerns. By leveraging AI for behavioral baseline analysis, it enables caregivers to remotely track elder wellbeing through automated check-ins, pattern recognition, and real-time alert notifications.

---

## Features

- **Daily Check-Ins** — Elders log their mood and activity level through a simple interface; missed check-ins are automatically flagged.
- **AI Behavioral Baselines** — Individualized baseline profiles are computed per elder and updated dynamically over time.
- **Anomaly Detection** — Deviations from established behavioral patterns are detected and classified by severity (low → critical).
- **Multi-Channel Alerts** — Real-time notifications dispatched to caregivers via SMS, email, and in-app channels.
- **Escalation Engine** — Configurable rules auto-escalate unacknowledged alerts and loop in emergency contacts when needed.
- **Wellness Scores** — Daily composite health scores (0–100) derived from mood, activity, check-in timeliness, and anomaly presence.
- **Check-In Streaks** — Consistency tracking that rewards elders for consecutive on-time check-ins.
- **Caregiver Dashboard** — Centralized view of behavioral trends, anomaly records, and downloadable activity reports.
- **Family Access** — Read-only access granted by caregivers for designated family members.
- **Audit Logs** — Full action trail for data privacy compliance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | React + Vite (TypeScript) |
| Mobile App | React Native + Expo |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| AI/ML | Python — `backend/app/ml/` |
| State Management | Zustand |

---

## Project Structure

```
baselium-plus/
│
├── apps/
│   │
│   ├── web/                               ← React (Vite)
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/                    ← Images, icons, fonts
│   │   │   ├── components/
│   │   │   │   ├── common/
│   │   │   │   ├── forms/
│   │   │   │   └── charts/
│   │   │   │
│   │   │   ├── features/                  ← Feature-based modules
│   │   │   │   ├── auth/
│   │   │   │   ├── patient/
│   │   │   │   ├── dashboard/
│   │   │   │   └── wellness/
│   │   │   │
│   │   │   ├── hooks/
│   │   │   ├── layouts/
│   │   │   ├── pages/
│   │   │   ├── routes/
│   │   │   ├── services/                  ← API calls
│   │   │   ├── store/                     ← Zustand
│   │   │   ├── utils/
│   │   │   ├── constants/
│   │   │   └── main.tsx
│   │   │
│   │   ├── tests/
│   │   ├── .env
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── mobile/                            ← React Native + Expo
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── screens/
│       │   ├── hooks/
│       │   ├── services/
│       │   ├── navigation/
│       │   ├── store/
│       │   └── utils/
│       │
│       ├── assets/
│       ├── tests/
│       ├── package.json
│       └── app.json
│
│
├── packages/                              ← Shared reusable code
│   │
│   ├── ui/                                ← Shared components
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── Card/
│   │
│   ├── types/                             ← Shared TS types
│   │   ├── user.ts
│   │   ├── wellness.ts
│   │   └── patient.ts
│   │
│   ├── utils/
│   │   ├── validators.ts
│   │   └── dateHelpers.ts
│   │
│   └── api-client/                        ← Shared API SDK
│
│
├── backend/
│   │
│   ├── app/
│   │   │
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── patients.py
│   │   │       └── wellness.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   │
│   │   ├── models/
│   │   ├── schemas/                       ← Pydantic schemas
│   │   ├── services/
│   │   ├── repositories/                  ← Database access layer
│   │   ├── middleware/
│   │   ├── ml/
│   │   │   ├── baseline/
│   │   │   ├── anomaly_detection/
│   │   │   └── prediction/
│   │   │
│   │   └── utils/
│   │
│   ├── tests/
│   ├── alembic/                           ← DB migrations
│   ├── .env
│   ├── requirements.txt
│   └── main.py
│
│
├── infrastructure/                        ← DevOps
│   ├── docker/
│   │   ├── frontend.Dockerfile
│   │   ├── backend.Dockerfile
│   │   └── docker-compose.yml
│   │
│   ├── nginx/
│   └── deployment/
│
│
├── scripts/
│   ├── seed_db.py
│   ├── reset_db.py
│   └── create_admin.py
│
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── setup.md
│   ├── erd.md
│   └── deployment.md
│
│
├── .github/
│   └── workflows/
│       ├── frontend-ci.yml
│       ├── backend-ci.yml
│       └── deploy.yml
│
│
├── .gitignore
├── README.md
├── package.json
├── turbo.json                             ← Monorepo task runner
├── tsconfig.base.json
└── pnpm-workspace.yaml
```

---

## Database Schema (Overview)

The relational database is organized around these core entities:

| Table | Description |
|---|---|
| `accounts` | Centralized auth; roles: `elder`, `caregiver`, `family` |
| `users` | Elder profile data |
| `caregivers` | Caregiver profile data |
| `family_access` | Family member access grants (granted by caregivers) |
| `user_caregiver` | Many-to-many elder–caregiver assignment |
| `check_ins` | Daily check-in records (mood 1–5, activity 1–5) |
| `behavioral_baselines` | AI-computed baseline profiles per elder |
| `anomalies` | Detected deviations with severity classification |
| `notifications` | Alert dispatch records (SMS / email / in-app) |
| `wellness_scores` | Daily composite health scores (0–100) |
| `checkin_streaks` | Consecutive on-time check-in tracking |
| `escalation_rules` | Configurable alert escalation settings per elder |
| `audit_logs` | Full action trail for data privacy compliance |
| `health_notes` | Caregiver-written notes (conditions, medications, etc.) |
| `emergency_contacts` | Fallback contacts notified on unacknowledged alerts |
| `caregiver_schedules` | Shift scheduling for on-duty routing |
| `discharge_summaries` | End-of-care summary reports |
| `messages` | In-system messaging between accounts |
| `checkin_templates` | Custom check-in question sets per elder |
| `checkin_questions` | Individual questions within a template |
| `checkin_responses` | Elder responses to custom check-in questions |

For the full ERD and DBML schema, see [`docs/`](./docs/).

---

## Getting Started

See [`docs/setup.md`](./docs/setup.md) for full setup instructions.

### Quick Start

**Install all dependencies (from root)**
```bash
pnpm install
```

**Run all apps via Turborepo**
```bash
pnpm turbo dev
```

**Or run individually:**
```bash
# Web
cd apps/web && pnpm dev

# Mobile
cd apps/mobile && npx expo start

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## API Reference

See [`docs/api.md`](./docs/api.md) for full endpoint documentation.

---

## System Objectives

1. Collect and process daily check-in data to build individualized behavioral baseline profiles using AI-driven pattern recognition.
2. Automatically identify deviations from established behavioral patterns that may signal physical or cognitive health concerns.
3. Deliver real-time multi-channel alerts to caregivers via SMS, email, and in-app notifications upon detection of anomalies or missed check-ins.
4. Provide caregivers with a centralized dashboard for monitoring behavioral trends, reviewing alert histories, and generating downloadable activity reports.
5. Ensure secure storage and retrieval of personal health data in compliance with data privacy standards.
6. Promote elder autonomy through a non-intrusive monitoring solution that reduces the need for physical supervision.

---