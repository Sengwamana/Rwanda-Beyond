# Smart Maize Farming System - Developer Guide

## System overview
This repository contains a full-stack smart farming platform:
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express (ES modules)
- Data layer: Convex (server data access through `Backend/src/database/convex.js`)
- Auth: Clerk JWT verification
- Realtime: WebSocket (`/ws`)
- External services: Cloudinary, OpenWeatherMap, Africa's Talking, Gemini

## High-level architecture
1. Frontend requests data through Axios clients in `Frontend/services/`.
2. Backend routes in `Backend/src/routes/` validate/authenticate requests and call services.
3. Services call Convex via `db` methods in `Backend/src/database/convex.js`.
4. WebSocket manager broadcasts sensor/alert/recommendation events to connected clients.

## Frontend structure
- App entry: `Frontend/index.tsx`, `Frontend/App.tsx`
- Global stores: `Frontend/store/index.ts` (Zustand)
- API layer: `Frontend/services/api.ts`, `Frontend/services/apiClient.ts`
- Domain services: `Frontend/services/*.ts`
- Realtime client: `Frontend/services/websocket.ts`
- Hooks: `Frontend/hooks/*`
- UI and pages: `Frontend/components/*`

## Backend structure
- App entry: `Backend/src/index.js`
- Config: `Backend/src/config/index.js`
- Middleware: auth, validation, errors, rate limits
- Routes: users, farms, sensors, weather, analytics, admin, ussd, ai
- Services: business logic per domain
- Database adapter: `Backend/src/database/convex.js`
- Convex functions/schema: `Backend/convex/*`

## Request and auth flow
1. User authenticates with Clerk on frontend.
2. Frontend includes bearer token in API requests.
3. Backend verifies token in `Backend/src/middleware/auth.js`.
4. Backend resolves/creates local user and applies role checks.

## Realtime flow
1. Frontend connects to `ws://<host>/ws` with token.
2. Backend authenticates socket and tracks subscriptions.
3. Services emit farm/user/system events through `wsManager`.
4. Frontend updates UI/store from socket events.

## Local development
### Backend
1. `cd Backend`
2. `npm install`
3. Copy `.env.example` to `.env` and fill values
4. `npm run dev`

### Frontend
1. `cd Frontend`
2. `npm install`
3. Copy `.env.example` to `.env` and set Vite env values
4. `npm run dev`

## Important scripts
### Backend
- `npm run dev`
- `npm start`
- `npm test`
- `npm run migrate`
- `npm run seed`

### Frontend
- `npm run dev`
- `npm run build`
- `npm run preview`

## Current known risks in this codebase
- Frontend TypeScript build currently fails due export/type mismatches.
- Backend tests currently fail because Jest setup is not ESM-safe.
- Security cleanup is required for hardcoded secrets in `Backend/src/i.js`.
- Documentation drift exists (some docs still mention Supabase while code uses Convex).

## Recommended stabilization order
1. Remove secrets and rotate exposed credentials.
2. Fix frontend compile errors and normalize API client usage.
3. Fix backend Jest setup and make server startup test-safe.
4. Add/repair lint configuration for both apps.
5. Update docs to match Convex-based architecture.

## Debugging tips
- Verify env vars first (`Backend/.env`, `Frontend/.env`).
- Use `/health` and `/api/health` endpoints for backend checks.
- Validate WebSocket connection and auth state in browser devtools.
- Use focused domain tests after each module change.
