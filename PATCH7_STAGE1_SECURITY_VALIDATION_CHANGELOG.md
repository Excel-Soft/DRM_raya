# PATCH 7 — Stage 1 Security & Validation Changelog

_Last updated: 2026-06-29._

Stage: **PATCH 7 — STAGE 1: P0 Security, RBAC, Validation, DTO Safety, SQL, and
API Helper Closure.**

> **Key finding:** nearly all of the Stage-1 infrastructure already existed
> (delivered in Patch 6). This sprint **verified** that coverage, **closed the few
> genuine gaps**, and **documented** the result. The work deliberately avoided
> double-guarding modules that already use dedicated guards (GM / office / reports
> / penalty), since re-keying them would risk role-map drift and could weaken
> existing rules. Constraints honored: no business-workflow change beyond
> security/validation, no UI redesign, no destructive DB commands, no weakened
> permission rule.

## 1. Code changes

### Broken-access-control closed (the real P0) — `server/pms-routes.ts`
- Added `canManageTask` (owner / assignee / manager) and `canDecideApproval`
  (managerial or designated approver) helpers.
- `PUT /api/pms/tasks/:id` and `PATCH /api/pms/tasks/:id` (non-status updates):
  added a **403** guard so an unrelated authenticated user can no longer edit a
  task they don't own / aren't assigned to / don't manage. The status-change path
  (already owner-enforced) is unchanged.
- `POST /api/pms/approvals/:id/approve` and `.../reject`: added a
  managerial-or-designated-approver **403** guard — applied to both the active
  handlers **and** the shadowed duplicate handlers in the same file.

### Action-permission registry — `server/config/action-permissions.ts`
- Added the `attributes.update` key (registry entry only; no attributes update
  endpoint exists, so no route/workflow change).

### Frontend API consistency — `client/src/lib/queryClient.ts`
- `throwIfResNotOk` now parses the standard error envelope
  (`{ success:false, error:{ code, message } }` / `{ message }`) via
  `extractApiError` and throws a **friendly** message; explicit friendly message
  for **403**. 401 logout/redirect behavior is unchanged.

### Frontend protected calls — `client/src/pages/dd-executive-dashboard.tsx`
- Migrated four protected calls that previously used raw cookie-only `fetch`
  (no Bearer token) to `apiRequestJson`: `GET summary`, `GET daily-report`,
  `GET monthly-complete`, and `POST /api/pms/tasks` (create task). This is a real
  auth fix — those calls now send the JWT.

## 2. APIs / middleware added
- No new public API routes. New **in-file authorization guards** for PMS task
  mutation and approval-decision endpoints (above).
- Reused the existing `requireActionPermission` primitive and the existing
  dedicated guards; none were duplicated.

## 3. Database changes
- **None.** No schema migration, no destructive command. (Audit/notification
  schema already present from Patch 6.)

## 4. Action permissions implemented / confirmed
- 18 static registry keys (attributes, invoice, service follow-up/complaint/
  dropout/renewal) + `attributes.update` added this stage.
- Inline-configured keys (loan / overtime / leave / attendance / user / drm) and
  dynamic wrappers (`finance:*`, `report:*`) confirmed.
- See `PATCH7_ACTION_PERMISSION_MATRIX.md` for the full matrix.

## 5. Raw body / DTO fixes
- No new raw-body write was introduced; existing write routes continue to map
  allowlisted fields and reject invalid payloads with 400. VAL-001 infrastructure
  (validators + validation service) confirmed present from Patch 6.

## 6. SQL fixes
- No SQL code change required. Dynamic sort/direction/pagination/id-list surfaces
  are already whitelisted / integer-coerced / UUID-validated via
  `server/utils/sql-safety.ts`. See `PATCH7_SQL_SAFETY_AUDIT.md`.

## 7. Frontend API helper migration
- 4 protected calls migrated (above). Remaining raw `fetch` inventory and the
  reason each is currently allowed are documented in
  `PATCH7_FRONTEND_API_CONSISTENCY_AUDIT.md`.

## 8. Tests run
- **New:** `server/validate-secrets.test.ts` (8 tests) — missing / weak / short
  `JWT_SECRET`, weak `SESSION_SECRET`, and `MOCK_AUTH=true` in production all fail;
  strong production config passes; non-production downgrades to warnings
  (covers smoke #4 / #5).
- **Verified passing (no rewrite):** `server/sql-safety.test.ts` (malicious
  sort/dir/uuid — smoke #8).
- `npm run check` (tsc `--noEmit`): **EXIT 0, clean** (no new type errors).
- `npm test` (vitest): **227 passed across 15 files** (219 baseline + 8 new).
- `npm run dev`: boots clean on port 5000.
- Smoke probes (localhost:5000): anonymous `GET /api/attributes`,
  guarded `PUT /api/pms/tasks/:id`, and `POST /api/pms/approvals/:id/approve` all
  return **401** at the auth layer (anon path), confirming the routes are wired and
  protected. (Probes must target `localhost`; the proxied dev domain returns
  HTTP 000 for direct curl.)

## 9. Unresolved / deferred
- Mechanical migration of the ~30 remaining client files that still use raw
  `fetch` (most already attach the Bearer token manually) — deferred to a later
  stage to avoid broad regression risk; tracked in the frontend audit doc.
- The pre-existing `opportunities.id` (varchar) vs `customers.id` (uuid) cast
  requirement remains an operational note (not an injection issue).
- `npm run db:push` remains broken on a pre-existing FK type mismatch — unrelated
  to this stage; apply schema via runtime DDL when needed.
