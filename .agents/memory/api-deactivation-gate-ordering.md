---
name: API deactivation gate must precede global auth
description: To return 404 (not 401) for a disabled /api module, mount its gate at the top of registerRoutes, before the global /api auth middleware.
---

# Deactivating an /api surface in WebExcels DRM

`server/routes.ts` `registerRoutes()` enforces auth **globally** with
`app.use("/api", authMiddleware)` (plus `checkAllowedIp` and
`checkUrlPermission`) **before** the per-module `registerXxxRoutes(app)` calls.

**Rule:** To fully block/deactivate an `/api/<module>/*` surface so it returns
`404` (module not even revealed) regardless of authentication, mount the gate at
the **very top of `registerRoutes`**, before the global auth/IP/permission
middleware. A gate placed inside `registerXxxRoutes` runs *after* global auth, so
unauthenticated calls get `401` (which reveals the route exists) instead of the
intended `404`.

**Why:** First attempt placed the Support deactivation gate inside
`registerSupportRoutes`; unauthenticated `/api/support/*` returned `401` from the
global auth middleware, not `404`. Moving the gate above global auth fixed it.

**How to apply:** Feature-flag/disable any module's API by adding, at the top of
`registerRoutes`:
`app.use("/api/<module>", (_req, res, next) => flagOff ? res.status(404).json({ error: "Not Found" }) : next())`.
