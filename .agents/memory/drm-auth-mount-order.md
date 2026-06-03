---
name: DRM auth middleware mount order
description: Why some /api routers in this app are unauthenticated, and how to lock an endpoint down correctly.
---

In `server/routes.ts`, the global `app.use("/api", authMiddleware)` is registered
**after** several feature routers are already mounted (e.g. `app.use("/api/drm",
drmRoutes)`). Express runs middleware in registration order, so any router mounted
*before* that line is **not** covered by the global auth middleware and is publicly
reachable.

**Why:** This is the root cause of broken-access-control findings in this app —
e.g. `/api/drm/permissions*` CRUD is anonymous even though most of `/api` is
protected. It is easy to "fix" one sub-route (add local `authMiddleware` to just
`/permissions/debug`) and miss the sibling write endpoints.

**How to apply:** To secure an endpoint on an early-mounted router, either
(a) add `authMiddleware` (+ an explicit role check) directly on each route/router
locally, or (b) move the router mount to *after* the global
`app.use("/api", authMiddleware)`. When hardening one route in such a router,
check every sibling route in the same file for the same gap.
