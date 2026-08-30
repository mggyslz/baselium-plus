# Baselium+ Frontend

React + Vite web client for Baselium+, with role-specific interfaces for elders, caregivers, family viewers, and administrators.

## Setup

```powershell
cd frontend
npm install
npm run dev
```

The development site runs at `http://localhost:5173`. The Go API defaults to `http://localhost:8080`.

Create `frontend/.env.local` when the API is hosted elsewhere:

```dotenv
VITE_API_URL=http://localhost:8080
```

`VITE_API_URL` is also used to derive the caregiver live-notification WebSocket URL.

## Role routes

| Role | Route | Capabilities |
|---|---|---|
| Elder | `/elder` | Daily mood/activity check-in, optional note or voice input, recent history |
| Caregiver | `/caregiver` | Triage, live notifications, trends, alerts, reports, health notes, and access management |
| Family Viewer | `/family` | Read-only elder status and high-severity-alert count only |
| Administrator | `/admin` | System overview, account assignments, elder activity, and audit logs |

Authentication is stored locally for the active browser session. Access tokens refresh automatically when a refresh token is available.

## Quality checks

```powershell
npm run typecheck
npm test
npm run build
npm run lint
```

## Scope notes

This repository currently provides a responsive web check-in interface; it does not include the proposal's separate React Native app. Check-ins also require a network connection: offline queueing and later synchronization are planned frontend work. Live caregiver notifications use WebSockets while the dashboard is open; Firebase/background push is intentionally out of scope for the current implementation.
