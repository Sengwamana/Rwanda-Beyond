# Smart Maize Startup Runbook

This file shows the exact order to start the project and verify that every service is healthy.

## 1. Prerequisites

- Node.js 18+ installed
- npm installed
- Ports available:
  - `5173` (Frontend)
  - `3000` (Backend API + WebSocket)
  - `3210` (Convex local backend)

## 2. Environment setup (first time)

### Backend env
1. Open terminal in `Backend/`
2. Copy env template:
   - PowerShell: `Copy-Item .env.example .env`
3. Set required values in `Backend/.env`

### Frontend env
1. Open terminal in `Frontend/`
2. Copy env template:
   - PowerShell: `Copy-Item .env.example .env`
3. Set required values in `Frontend/.env`

Minimum frontend envs:
- `VITE_API_URL=http://localhost:3000/api/v1`
- `VITE_WS_URL=ws://localhost:3000/ws`
- `VITE_CLERK_PUBLISHABLE_KEY=...`

## 3. Install dependencies

### Backend
```powershell
cd Backend
npm install
```

### Frontend
```powershell
cd Frontend
npm install
```

## 4. Start services in correct order

Use 3 terminals.

### Terminal A: Convex (must stay running)
```powershell
cd Backend
npx convex dev --local --local-force-upgrade
```

If Convex is already up to date, this still works.  
Do not use `--once` for normal development.

### Terminal B: Backend API
```powershell
cd Backend
npm run dev
```

### Terminal C: Frontend
```powershell
cd Frontend
npm run dev
```

Open: `http://localhost:5173`

## 5. Health checks (must pass)

Run these after startup:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/health
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health
```

Expected:
- `/health` returns `200`
- `/api/health` returns `200` and includes `"database":"connected"`

If `/api/health` returns `503` or `"database":"unhealthy"`, Convex is not running correctly.

## 6. Runtime verification in browser

1. Sign in.
2. Open DevTools Network tab.
3. Confirm:
   - `GET /api/v1/users/me` -> `200`
   - Dashboard API calls (`/farms`, `/recommendations`, `/pest-detection/statistics`) -> no `500`
4. WebSocket log should show successful connection/auth.

## 7. Common problems and fixes

### A) Many `500` errors on API routes
Cause: Convex is down or disconnected.

Fix:
1. Ensure Terminal A is running:
   - `npx convex dev --local --local-force-upgrade`
2. Re-check `http://localhost:3000/api/health`

### B) `401 Unauthorized` on dashboard endpoints
Cause: missing/expired Clerk token on requests.

Fix:
1. Sign out and sign in again.
2. Hard refresh browser (`Ctrl + F5`).
3. Confirm `VITE_CLERK_PUBLISHABLE_KEY` and backend Clerk keys are valid.

### C) Console errors from `content.js` / extensions
Cause: browser extensions (not app backend).

Fix:
1. Test in incognito with extensions disabled.
2. Ignore extension-only stack traces if app network calls are healthy.

## 8. Daily start shortcut

Every time you start work:

1. Start Convex (Terminal A)
2. Start backend (Terminal B)
3. Start frontend (Terminal C)
4. Check `/api/health` before testing login/dashboard
