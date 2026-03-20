# Admin Analytics Data Flow

This document maps each analytics section in the admin dashboard to:

- the frontend component that renders it
- the React Query hook that loads it
- the frontend service method
- the backend route
- the main backend data source
- any important frontend-derived calculations

## Main Entry Point

- Admin analytics tab UI: `Frontend/components/ConnectedAdminDashboard.tsx`
- Panel component: `AdminAnalyticsPanel`

The analytics tab is **not** loaded from one large API response. It is composed from several live endpoints and then lightly summarized in the frontend with `useMemo`.

## Card And Panel Mapping

| Dashboard section | Frontend hook | Frontend service | Backend route | Main backend data source | Frontend-derived logic |
|---|---|---|---|---|---|
| Analytics Export | `useExportAnalyticsData()` | `analyticsService.exportData()` | `GET /api/v1/analytics/export` | `db.farms.list`, `db.users.list`, `db.sensorData.list`, `db.recommendations.list` | Only file download handling and export form state |
| System-Wide Analytics | `useSystemAnalytics()` | `analyticsService.getSystemOverview()` | `GET /api/v1/analytics/system/overview` | `db.users.listAll`, `db.farms.listActive`, `db.sensors.listAllStats`, `db.recommendations.getStats`, `db.pestDetections.getStats` | UI reads counts like `userCount` / `totalUsers` defensively |
| Recommendation Response Overview | `useRecommendationStatistics()` | `recommendationService.getStatistics()` | `GET /api/v1/recommendations/stats` | recommendation stats service / recommendation records | Rate and average response time are displayed directly; badges are simple object iteration |
| Pest Outbreak Watch | `usePestOutbreakMap()` | `pestDetectionService.getOutbreakMap()` | `GET /api/v1/pest-detection/outbreak-map` | `db.pestDetections.getOutbreakMap` | `outbreakSummary` computes `affectedDistricts`, `topDistrict`, and `severeSignals` from `byDistrict` |
| Pest Control Operations | `useRecentActivityAnalytics({ type: 'pest_control' })` | `analyticsService.getRecentActivity()` | `GET /api/v1/analytics/system/activity` | `buildSystemActivityPayload()` in analytics route, including pest-control schedules/activity | `pestControlSummary` counts scheduled vs executed from returned activity rows |
| Alert Statistics | `useAlertStatistics()` | `adminService.getAlertStatistics()` | `GET /api/v1/admin/alerts/statistics` | `db.pestDetections.getStats`, `db.recommendations.getStats` | Frontend only renders totals and breakdown maps |
| Farm Issue Oversight | `useAllFarmIssues()`, `useFarmIssue()` | farm issue service via hook layer | farm issue routes, not analytics routes | farm issue records plus single-issue fetch | `issueSummary` computes visible totals by status and severity; search filters issues before summary |
| District Breakdown | `useAllDistrictsAnalytics()` | `analyticsService.getAllDistrictsAnalytics()` | `GET /api/v1/analytics/districts` | `db.districts.list`, `db.farms.list`, `db.pestDetections.getOutbreakMap`, `db.recommendations.list` | Search filters district rows before rendering |
| Analytics Snapshot (right rail) | no extra request; derived locally | none | none | uses results from the other analytics queries | `analyticsSnapshot` combines system totals, open issues, severe signals, and district row count |

## Supporting Queries Used Inside The Analytics Tab

These are not the main analytics cards, but they support the tab:

| Purpose | Hook | Backend source |
|---|---|---|
| Expert assignment options for farm issues | `useUsers({ role: 'expert', status: 'active' })` | users route / user records |
| District names for issue assignment matching | `useDistricts()` | districts route |
| Issue status filter and paging | `useAllFarmIssues({ page, limit, status })` | farm issue list route |
| Selected issue detail | `useFarmIssue(selectedIssueId)` | single farm issue route |

## Backend Route Responsibilities

### `GET /api/v1/analytics/system/overview`

This route builds a system overview for expert/admin users by combining:

- users
- active farms
- sensor fleet stats
- recent recommendations
- recent pest detections

It returns grouped totals and breakdowns, which the admin analytics page uses in the `System-Wide Analytics` card.

### `GET /api/v1/analytics/system/activity`

This route builds recent cross-system activity. It includes:

- new users
- new farms
- recommendation activity
- pest detections
- pest-control operations
- sensor-reading summary activity

The admin analytics page uses this route specifically for the `Pest Control Operations` card by passing `type: 'pest_control'`.

### `GET /api/v1/analytics/districts`

This route builds per-district analytics by joining:

- district records
- farms
- outbreak map detections
- recommendations

It returns a district array used by the `District Breakdown` card.

### `GET /api/v1/admin/alerts/statistics`

This route is admin-scoped and currently builds alert statistics from:

- pest detection stats
- recommendation stats

It returns grouped values that the admin analytics tab renders under `Alert Statistics`.

### `GET /api/v1/recommendations/stats`

This route provides system-wide recommendation-response analytics such as:

- total recommendations
- response rate
- acceptance rate
- average response time
- by status / priority / type / channel

It drives the `Recommendation Response Overview` card.

### `GET /api/v1/pest-detection/outbreak-map`

This route returns:

- raw detection rows
- grouped district outbreak data
- severity distribution by district

The admin analytics page derives the high-level outbreak summary from that payload.

## Important Frontend-Derived Summaries

The following values are **not** directly returned by a single backend field. They are computed in the UI from live backend results:

- `outbreakSummary.totalDetections`
- `outbreakSummary.affectedDistricts`
- `outbreakSummary.topDistrict`
- `outbreakSummary.severeSignals`
- `pestControlSummary.total`
- `pestControlSummary.scheduled`
- `pestControlSummary.executed`
- `issueSummary.total`
- `issueSummary.byStatus`
- `issueSummary.bySeverity`
- `analyticsSnapshot.*`
- analytics search chips / filtered counts

These are still dynamic because they are derived from live query data, not hardcoded values.

## Search Behavior In The Analytics Tab

The admin analytics search does not trigger new backend analytics endpoints by itself. Instead, it filters already-fetched results client-side for:

- district rows
- farm issue rows
- outbreak district rows

Then it updates:

- visible card rows
- summary chips
- analytics snapshot counts that depend on filtered rows

## Quick Trace Example

If you want to trace one card end to end, here is `Pest Outbreak Watch`:

1. `AdminAnalyticsPanel` calls `usePestOutbreakMap({ days: 30 })`
2. `usePestOutbreakMap` calls `pestDetectionService.getOutbreakMap(...)`
3. The service calls `GET /api/v1/pest-detection/outbreak-map`
4. Backend route queries `db.pestDetections.getOutbreakMap(...)`
5. Backend groups results by district and severity
6. Frontend computes `outbreakSummary`
7. The card renders totals plus the top district rows

## Key Takeaway

The admin analytics tab is a **live multi-source analytics surface**. The numbers mostly come from backend aggregation routes, while the frontend is responsible for:

- local search filtering
- compact summary cards
- small derived counts
- export form handling
- issue assignment workflow embedded in the analytics page
