---
name: HR feature module pattern (Increment / Penalty)
description: How new DRM HR modules (increment, penalty) are wired so a future module follows the same proven shape.
---

# HR feature module pattern

New DRM HR modules (Increment, Penalty) all follow the same shape. Reuse it for
the next one (e.g. bonuses, warnings) instead of reinventing.

- **Routes mount AFTER auth + checkAllowedIp + checkUrlPermission** in `server/routes.ts`.
  `/api/<feature>` has no `drm.url_permissions` row, and `checkUrlPermission`
  **default-allows** paths with no matching rule — so the route is reachable, and
  real authorization MUST be enforced inside the route handlers, never relied on
  from the middleware or client.
- **Access scoping helper**: copy the increment-routes `getAllowedUserIds`/
  `getAllowedEmployeeIds` shape — full-access roles (`admin`, `super_hod`; note
  `super_admin` normalizes to `admin`) → null (all); `hod`/managerial → own
  department + self (query `drm.users.department`); everyone else → `[self]`.
  Use `normalizeRole` + `isManagerialRole` from `server/utils/role-utils.ts`.
- **Reuse `server/services/increment.service.ts`** `fetchUsers` / `groupUsersByRole`
  / `fetchUserById` for the employee dropdown — consistent naming/grouping across HR features.
- **DB changes apply to the LIVE DB via an explicit `migrations/*.sql`** run through
  the code_execution `executeSql` callback. Do NOT `db:push` — `shared/schema.ts`
  is intentionally out of sync with the live DB; add the Drizzle table there for
  typing only.
- **Postgres param typing gotcha**: don't reuse the same `$n` placeholder in both a
  column-value position and a CASE expression — Postgres throws "inconsistent types
  deduced for parameter $n". Pass a separate param and cast (`$12::uuid`).
- **tsc baseline**: the project has a stable set of pre-existing unrelated tsc errors;
  success = no NEW errors in your files, not zero total.
- **Notifications**: `NotificationService.notify({userId, message, type, targetUrl})`
  writes to `drm.notifications`; wrap in try/catch so it never blocks the action.
- **Frontend**: `apiRequest(method,url,data)` returns a `Response` and does NOT throw —
  check `res.ok` and read `res.json()` yourself. Theme green `#00a65a`. All shadcn UI
  components exist under `client/src/components/ui`.
