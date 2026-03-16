# Backend to Frontend Coverage Matrix

Last audited: 2026-03-15

## Status

Current result: no missing user-facing backend modules were found in the frontend after the latest audit pass.

The last gaps closed during this audit thread were:
- admin service now exercises the direct `GET /admin/users/:userId` route for single-user retrieval
- admin service now exercises the direct `GET /admin/users/statistics` route
- admin service now exercises the direct `GET /admin/farms/statistics` route
- admin device token generation now exercises `POST /admin/devices/token`
- admin overview now exercises the exact `GET /admin/users` route
- farmer overview now exercises the primary farm-scoped `GET /pest-detection/farm/:farmId` route
- farmer overview now exercises the primary farm-scoped `GET /recommendations/farm/:farmId` route
- admin overview now exercises the primary unscoped `GET /recommendations/active` route
- farmer sensor management now exercises the primary `/sensors/data/farm/:farmId/latest` route
- sensor trend services now exercise the primary `/sensors/data/farm/:farmId/aggregates` route instead of the `/daily` alias
- admin overview now exercises the primary `GET /analytics/dashboard` system summary route
- admin overview now exercises the primary unscoped `recommendations` and `pest-detection` list routes
- pest and recommendation analytics now exercise the direct `stats` module routes instead of the `statistics` aliases
- analytics views now exercise the direct `system/overview`, `system/activity`, `system/activity/export`, and `farm/:farmId/recommendation-history` routes
- admin statistics cards now exercise the direct `users/stats` and `farms/stats` module routes
- authenticated pest scan alias routes are now surfaced in the farmer pest-history flow
- admin sensor fleet health in the admin monitoring view
- expert-facing sensor health watch for the core sensors module
- route correction for sensor health from the wrong admin path to the sensors module path
- route-backed farm summary surfaced in the farmer overview
- outbreak-map surfaced in expert and admin analytics
- farm image metadata save surfaced in the farmer AI image workflow
- farmer analytics now uses the dedicated farm dashboard route
- dedicated farm growth-stage update surfaced in the farmer profile flow
- pest reanalysis surfaced in expert review actions
- admin user management now exercises the direct `users` routes for list/detail/role/activate state

## Covered Modules

### `ai`
- Backend routes: `Backend/src/routes/ai.js`
- Frontend coverage:
  - farmer AI advice and chat in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - voice assistant in `Frontend/components/VoiceAssistant.tsx`
  - AI image analysis, translation, and capabilities in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - AI health monitoring in `Frontend/components/ConnectedAdminDashboard.tsx`

### `analytics`
- Backend routes: `Backend/src/routes/analytics.js`
- Frontend coverage:
  - farm dashboard, sensor trends, direct recommendation-history, and farm activity in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - district analytics and farm activity export in `Frontend/components/ConnectedExpertDashboard.tsx`
  - direct system overview, direct dashboard summary, direct system activity, direct system activity export, filtered export, and analytics export in `Frontend/components/ConnectedAdminDashboard.tsx`

### `admin`
- Backend routes: `Backend/src/routes/admin.js`
- Frontend coverage:
  - exact admin user directory route, users, user detail, farms, audit logs, devices, config, monitoring, reports, broadcast, analytics, content, and USSD in `Frontend/components/ConnectedAdminDashboard.tsx`
  - shared admin navigation in `Frontend/components/Dashboard.tsx`

### `content`
- Backend routes: `Backend/src/routes/content.js`
- Frontend coverage:
  - landing newsletter subscription in `Frontend/components/LandingPage.tsx`
  - careers in `Frontend/components/Careers.tsx`
  - about in `Frontend/components/About.tsx`
  - features in `Frontend/components/Features.tsx`
  - pricing in `Frontend/components/Pricing.tsx`
  - consultation request in `Frontend/components/Consultation.tsx`
  - admin content visibility panel in `Frontend/components/ConnectedAdminDashboard.tsx`

### `farm-issues`
- Backend routes: `Backend/src/routes/farm-issues.js`
- Frontend coverage:
  - farmer issue reporting and issue history in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - expert issue triage in `Frontend/components/ConnectedExpertDashboard.tsx`
  - admin oversight, assignment, and selected-issue detail in `Frontend/components/ConnectedAdminDashboard.tsx`

### `farms`
- Backend routes: `Backend/src/routes/farms.js`
- Frontend coverage:
  - farm listing, selected farm detail, farm summary, growth-stage update, image metadata save, create, update, and delete in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - irrigation scheduling, postponement, and execution in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - fertilization scheduling and execution in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - pest-control scheduling and execution in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - admin-wide farm management tab and farm statistics cards in `Frontend/components/ConnectedAdminDashboard.tsx`

### `messages`
- Backend routes: `Backend/src/routes/messages.js`
- Frontend coverage:
  - notification center for farmer, expert, and admin in `Frontend/components/Dashboard.tsx`

### `pest-detection`
- Backend routes: `Backend/src/routes/pest-detection.js`
- Frontend coverage:
  - farmer pest scan, primary farm detection ledger, scan alias list/detail, history, treatment guidance, and execution follow-through in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - expert pending review workflow, direct stats, selected detection detail, re-run AI, strategy updates, and outbreak watch in `Frontend/components/ConnectedExpertDashboard.tsx`
  - admin pest analytics, outbreak watch, and unscoped detection ledger in `Frontend/components/ConnectedAdminDashboard.tsx`

### `recommendations`
- Backend routes: `Backend/src/routes/recommendations.js`
- Frontend coverage:
  - farmer recommendation feed, route-backed farm recommendation ledger, and response flow in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - expert manual recommendations, pending recommendation review, direct stats-backed recommendation history feed, and selected recommendation detail in `Frontend/components/ConnectedExpertDashboard.tsx`
  - admin recommendation statistics, bulk generation, unscoped recommendation ledger, and unscoped active recommendation watch in `Frontend/components/ConnectedAdminDashboard.tsx`

### `sensors`
- Backend routes: `Backend/src/routes/sensors.js`
- Frontend coverage:
  - farmer sensor list, selected sensor detail, sensor registration, update, delete, sensor readings, and latest snapshot in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - farmer sensor trend and aggregate views now exercise the primary farm aggregate route in `Frontend/services/farms.ts` and `Frontend/services/sensors.ts`
  - settings summary of farm sensors in `Frontend/components/Settings.tsx`
  - expert sensor health watch in `Frontend/components/ConnectedExpertDashboard.tsx`
  - admin sensor fleet monitoring and device/token management in `Frontend/components/ConnectedAdminDashboard.tsx`

### `users`
- Backend routes: `Backend/src/routes/users.js`
- Frontend coverage:
  - dedicated users module service in `Frontend/services/users.ts`
  - authenticated user profile and profile updates through auth/profile flows in `Frontend/components/AuthProvider.tsx` and `Frontend/components/Settings.tsx`
  - admin user management through the admin dashboard in `Frontend/components/ConnectedAdminDashboard.tsx`

Note:
- `users/me` is used through auth/profile flows
- admin user list/detail/role/deactivate/reactivate are now exercised through the direct `users` module routes while admin-only profile metadata updates still use the admin route
- admin user statistics now exercise `users/stats`

### `ussd`
- Backend routes: `Backend/src/routes/ussd.js`
- Frontend coverage:
  - live USSD health check and callback simulator in `Frontend/components/ConnectedAdminDashboard.tsx`

### `weather`
- Backend routes: `Backend/src/routes/weather.js`
- Frontend coverage:
  - farmer current weather, forecast, alerts, history, farming conditions, and irrigation window in `Frontend/components/ConnectedFarmerDashboard.tsx`
  - expert district weather and coordinate weather lookup in `Frontend/components/ConnectedExpertDashboard.tsx`

## Intentionally API-Only or Utility Endpoints

These backend endpoints are not missing frontend implementation. They are intentionally callback, ingest, alias, or utility routes:

- `Backend/src/routes/sensors.js`
  - `/data/ingest`
  - `/data/batch`
- `Backend/src/routes/ussd.js`
  - `/callback`
  - `/callback/v2`
- `Backend/src/routes/weather.js`

## Audit Notes

- Frontend sensor health now correctly calls the sensors module route instead of the admin route.
- Admin monitoring and expert operations both now expose live sensor health from the backend.
- Coordinate weather lookup is now surfaced in the expert dashboard through the location-based weather route.
- Farmer analytics now calls the dedicated `/analytics/farm/:farmId/dashboard` route instead of only relying on the generic dashboard endpoint.
- Farmer pest history now exercises `/pest-detection/scans` and `/pest-detection/scans/:scanId` through the current dashboard instead of only through legacy upload code.
- Farmer overview now also exercises the primary `/pest-detection/farm/:farmId` route through a route-backed pest ledger.
- Admin statistics cards now use the direct `users/stats` and `farms/stats` module routes instead of only the admin aliases.
- Admin overview now also exercises the exact `GET /admin/users` route through a route-backed user directory snapshot.
- Analytics views now prefer the primary analytics routes instead of the alias endpoints where both exist.
- Pest and recommendation statistics views now prefer the primary `/stats` routes instead of the `/statistics` aliases.
- Admin overview now exercises the primary unscoped `GET /recommendations` and `GET /pest-detection` routes through route-backed ledgers.
- Admin overview now exercises the primary unscoped `GET /recommendations/active` route through a route-backed active queue panel.
- Farmer overview now exercises the primary farm-scoped `GET /recommendations/farm/:farmId` route through a route-backed recommendation ledger.
- Admin overview now exercises the primary `GET /analytics/dashboard` route for the system summary payload.
- Sensor aggregate views now prefer the primary `/aggregates` route instead of the `/daily` alias.
- Farmer sensor management now exercises the primary `/latest` farm sensor snapshot route.
- Admin device token generation now exercises the primary `/admin/devices/token` route.
- If a future backend route is added, update this file at the same time as the frontend screen or hook.
