---
name: URL authorization model (default-allow)
description: Why every sensitive API route in this DRM app needs its own in-handler guard, not the URL-permission middleware.
---

# URL authorization is default-allow — guard every route in-handler

`server/settings.middleware.ts` (`checkUrlPermission`) is NOT a reliable
authorization boundary. It reads `drm.url_permissions`, but that table is empty
and only ever modelled menu segments. For any path with no matching row it
**allows** the request. Only `admin`/`super_admin` (normalized via
`normalizeRole`) bypass; everyone else effectively passes through for most routes.

**Why:** flipping unmatched routes to default-deny would lock every non-admin out
of the entire API until `url_permissions` is fully populated per route+role
(a deliberate, separate effort). So the pragmatic, user-approved stance keeps
default-allow.

**How to apply:** authorization for each sensitive endpoint must live in the
route handler itself — e.g. `isManagerialRole(callerRole(req))` /
`isHodAllowed(...)` for "all records" / approval actions, and ownership checks
(`record.userId === req.user.userId`) for per-resource reads/writes. Never assume
the URL middleware blocked an unauthorized caller. Watch especially for:
- "all records" list endpoints (return every employee's data) — need a role gate.
- create/write endpoints that accept a `userId` in the body — need an IDOR check
  (default to the caller; allow cross-user only for managerial roles).
- self-approval on approve/reject — block when `record.userId === caller` unless
  the caller normalizes to `ROLES.ADMIN`.

Helpers live in `server/utils/role-utils.ts`; `admin` and `super_admin` both
normalize to `ROLES.ADMIN`.
