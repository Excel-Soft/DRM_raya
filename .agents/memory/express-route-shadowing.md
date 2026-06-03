---
name: Express route shadowing by /reports/:type
description: Why exact /api/reports/* routes must be mounted before the reports router in server/routes.ts
---

# Reports router shadows exact /api/reports/* paths

`server/reports-routes.ts` registers a parameterized `router.get("/reports/:type", ...)`
(plus `/reports/:type/export`, `/reports/:type/email`). Because Express matches in
registration order, any **new exact** `/api/reports/<something>` route is shadowed by
`/reports/:type` and returns `{"error":"Invalid report type"}` unless it is mounted
**before** `registerReportsRoutes(app)`.

**Why:** adding `/api/reports/projects` after the reports router silently returned the
param route's 400, not the intended handler. Mounting its `register…Routes(app)` call
just before `registerReportsRoutes(app)` fixed it.

**How to apply:** when adding any exact `/api/reports/...` endpoint, register it ahead
of `registerReportsRoutes(app)` in `server/routes.ts` (still after the auth/IP/permission
middleware). Same caution applies to any other router that owns a broad `:param` segment.
