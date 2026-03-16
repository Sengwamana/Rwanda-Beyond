# Smart Maize Farming System - New Computer Setup

This guide is for setting up and running the project on a new Windows development machine.

Use this document for first-time setup.  
Use [STARTUP_RUNBOOK.md](/d:/Advanced%20Real%20World%20Project/Pro/docs/STARTUP_RUNBOOK.md) for the normal day-to-day startup order after setup is complete.

## 1. What you need

- Windows with PowerShell
- Node.js 18 or newer
- npm
- Git
- Internet access for npm packages and external services
- Access to the project secrets:
  - Clerk keys
  - Gemini API key
  - Cloudinary keys
  - Africa's Talking keys
  - OpenWeatherMap key

Recommended check:

```powershell
node -v
npm -v
git --version
```

## 2. Clone the project

```powershell
git clone https://github.com/Sengwamana/Rwanda-Beyond.git
cd Rwanda-Beyond
```

If the folder name on your machine is different, use that folder instead of `Rwanda-Beyond`.

## 3. Install dependencies

Open PowerShell in the project root and run:

```powershell
cd Backend
npm install
cd ..\Frontend
npm install
cd ..
```

## 4. Create environment files

### Backend

```powershell
cd Backend
Copy-Item .env.example .env
cd ..
```

Fill `Backend/.env` with real values for:

- `CONVEX_URL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `ADMIN_BOOTSTRAP_EMAILS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `AT_USERNAME`
- `AT_API_KEY`
- `AT_SHORTCODE`
- `AT_SENDER_ID`
- `OPENWEATHERMAP_API_KEY`
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `IOT_DEVICE_SECRET`

### Frontend

```powershell
cd Frontend
Copy-Item .env.example .env
cd ..
```

Fill `Frontend/.env` with at least:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key
```

## 5. Start Convex first

Convex must be running before the backend can fully work.

Open Terminal A:

```powershell
cd Backend
npx convex dev --local --local-force-upgrade
```

Keep this terminal open.

What this does:

- starts the local Convex deployment
- pushes `Backend/convex/schema.ts`
- generates Convex files in `Backend/convex/_generated`
- writes local deployment settings used by the backend

Expected local services:

- Convex runtime: `http://127.0.0.1:3210`
- Convex dashboard: `http://127.0.0.1:6790`

## 6. Start the backend

Open Terminal B:

```powershell
cd Backend
npm run dev
```

Expected backend URLs:

- Health: `http://localhost:3000/health`
- API health: `http://localhost:3000/api/health`
- API base: `http://localhost:3000/api/v1`

## 7. Start the frontend

Open Terminal C:

```powershell
cd Frontend
npm run dev
```

Expected frontend URL:

- `http://localhost:5173`

## 8. Verify everything is healthy

In a new PowerShell window:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/health
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:5173
```

Expected:

- `http://localhost:3000/health` returns `200`
- `http://localhost:3000/api/health` returns `200`
- backend API health includes `"database":"connected"`
- `http://localhost:5173` returns `200`

## 9. Optional demo data

If you want sample districts, farm data, sensors, and test records:

```powershell
cd Backend
npm run seed
```

Only do this if your current environment is meant to use demo data.

## 10. Sign-in and app checks

After startup:

1. Open `http://localhost:5173`
2. Sign in with a valid Clerk account
3. Confirm the dashboard loads
4. Confirm the browser console does not show repeated `503` errors
5. Confirm WebSocket connects successfully

Useful backend checks:

- `GET /api/v1/users/me`
- `GET /api/v1/farms`
- `GET /api/v1/recommendations`

## 11. Common problems

### Backend returns `503 Service Unavailable`

Cause: Convex is not running or the backend cannot reach it.

Fix:

```powershell
cd Backend
npx convex dev --local --local-force-upgrade
```

Then re-check:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health
``` 

### Frontend loads but API calls fail with `401`

Cause:

- invalid Clerk keys
- expired sign-in session
- wrong backend/frontend env values

Fix:

- verify `Frontend/.env` and `Backend/.env`
- sign out and sign in again
- hard refresh the browser

### Pest image upload fails

Check:

- `CLOUDINARY_*` values in `Backend/.env`
- internet access
- backend terminal logs

### SMS or USSD features do not work

Check:

- `AT_*` values in `Backend/.env`
- whether you are using sandbox or production credentials

### AI endpoints fail

Check:

- `GEMINI_API_KEY` in `Backend/.env`
- backend logs for provider errors

## 12. Daily startup after first setup

Once the machine is already configured, normal startup is:

1. Start Convex
2. Start backend
3. Start frontend
4. Check `http://localhost:3000/api/health`

For that flow, use [STARTUP_RUNBOOK.md](/d:/Advanced%20Real%20World%20Project/Pro/docs/STARTUP_RUNBOOK.md).

## 13. Files you should know

- [Backend/.env.example](/d:/Advanced%20Real%20World%20Project/Pro/Backend/.env.example)
- [Frontend/.env.example](/d:/Advanced%20Real%20World%20Project/Pro/Frontend/.env.example)
- [Backend/README.md](/d:/Advanced%20Real%20World%20Project/Pro/Backend/README.md)
- [Backend/docs/DEPLOYMENT.md](/d:/Advanced%20Real%20World%20Project/Pro/Backend/docs/DEPLOYMENT.md)
- [docs/STARTUP_RUNBOOK.md](/d:/Advanced%20Real%20World%20Project/Pro/docs/STARTUP_RUNBOOK.md)
