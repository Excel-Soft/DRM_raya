# Phase 0C — Critical API and authorization readiness audit

**Branch:** `fix/upgrade_frontend_habib`  
**Scope:** Read-only investigation — no Express, DB, or permission changes.

---

## Task 1 — Route matrix validation (actual run)

**Command:** `node frontend-next/scripts/build-route-matrix.mjs`

| Metric | Actual |
|--------|--------|
| Registry entries | 207 |
| App.tsx route declarations | 207 |
| Union unique paths | 207 |
| Sidebar URL entries | 114 |
| Alias / redirect records | 7 |
| Estimated unique business paths | 200 |
| Sidebar pathnames without App route | 1 (`/sales/active-clients`) |
| Backend API mounts sampled | 44 |
| `route-matrix.json` route rows | 207 |
| `migration-routes.json` routes | 207 |
| `route-matrix.csv` | 1 header row + 207 data rows |

**Consistency:** JSON, CSV, and `migration-routes.json` / `migration-tracker.ts` import are aligned on 207 legacy UI paths. Sidebar orphan unchanged from 0B.

---

## Task 2 — `/approvals` (unified inbox)

### UI wiring

| Item | Evidence |
|------|----------|
| Route | `frontend/src/App.tsx` — `<Route path="/approvals" component={Approvals} />` |
| Page | `frontend/src/pages/approvals.tsx` — `Approvals` default export |
| Registry | `route-registry.ts` — internal, `sidebarVisible: false`, not in sidebar |
| Inbound links | **None** — repo search finds no `href`, `setLocation`, or `targetUrl` to `/approvals` (distinct from `/pms/approvals`) |
| Client route guard | **No** `/approvals` entry in `useRouteProtection` `ROUTE_PERMISSIONS` — any authenticated user can open the URL directly |

### API calls from the page

Uses React Query default `queryFn` (`frontend/src/lib/queryClient.ts` — `queryKey.join("/")` as fetch URL):

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/api/approvals/summary` | Module count cards |
| GET | `/api/approvals/pending` | Pending table |
| Dynamic | `item.actions.approve` / `reject` | Per-row module endpoints (only after list loads) |

Comment in `approvals.tsx` references `server/services/approval-visibility.service.ts` — **that file is not present** in this checkout.

### Backend

| Item | Evidence |
|------|----------|
| Mount | `backend/src/server/routes.ts` — `app.use("/api/approvals", approvalRouter)` after `CrossDepartmentStatusService.ensureSchema()` |
| Router | `backend/src/server/routes/approval-routes.ts` — **empty `Router()` stub**; comment cites missing MVC-restructure implementation |
| Related service | `backend/src/server/services/cross-department-status.service.ts` — **`makeStub("CrossDepartmentStatusService")`**; `ensureSchema()` is a no-op warning |
| Schema | `backend/src/shared/schema.ts` — `cross_department_status_history` table defined; runtime ensure is stubbed |

**Confirmed:** GET `/api/approvals/pending` and `/api/approvals/summary` have **no handlers** → Express 404 for authenticated clients. The page shows loading then empty/error behavior via React Query (not a alternate API).

### Other approval implementations (working, separate)

These are **not** substitutes for the unified inbox API:

| Surface | API | Backend |
|---------|-----|---------|
| HOD dashboards | `/api/hod/approvals`, approve/reject | `hod-routes.ts` — `router.use(requireHod)` then `/approvals` handlers |
| PMS pending projects | `/api/pms/approvals*` | `pms-routes.ts` |
| GM / account flows | Various `/api/account/*`, gm-pool | Module-specific |
| Penalties | `PATCH /api/penalties/:id/approval` | `penalty-routes.ts` |

DB: `project_approvals` and related tables exist (`frontend/shared/schema.ts`); unified aggregator was intended (Patch 3 Stage 5) but **not implemented** in this tree.

### Classification

**Depends on unimplemented API** — not a placeholder page with a hidden endpoint; not partial backend on `/api/approvals`. Feature is **inactive/broken** for anyone visiting `/approvals`.

### Pilot impact

- **Do not** select `/approvals` or unified-approval flows for Next.js pilot.
- Safe references: `/pms/approvals`, HOD dashboard approval widgets, module-specific approval UIs.
- Migration tracker should keep `/approvals` as `legacy` until backend + UI contract verified end-to-end.

### Recommended follow-up

| Field | Value |
|-------|--------|
| Owner (proposed) | Backend platform owner + product (confirm with Talha) |
| Backlog ID | `AUTH-APPROVALS-01` |
| Acceptance criteria | (1) Restore `approval-routes.ts` handlers (`GET /pending`, `GET /summary`) and real `CrossDepartmentStatusService` **or** (2) remove/disable `App.tsx` route and document; (3) add tests hitting mounted paths; (4) update matrix notes |

---

## Task 3 — `/admin/audit-logs`

### Trace

| Layer | Evidence |
|-------|----------|
| Route | `App.tsx` — `/admin/audit-logs` → `AuditLogsPage` |
| Page | `frontend/src/pages/admin/audit-logs.tsx` — `GET /api/audit-logs?…` via `apiRequestJson` |
| Sidebar | `app-sidebar.tsx` — Audit Logs under DRM Setting, `permKey: "Admin"` |
| Registry | `allowedRoles: ["admin", "super_admin", "super_hod"]` (documentation; **not** enforced by `useRouteProtection`) |

### Frontend roles that can reach the page

`useRouteProtection.ts` — any path starting with `/admin` requires one of:

`admin`, `super_admin`, `administrator`, `service_manager`, `super_hod`

(`/admin/audit-logs` matches the `/admin` prefix; there is **no** more-specific guard for audit logs today.)

Sidebar visibility additionally uses `permKey: "Admin"` and `DEPT_NAME_TO_ROLES["Admin"]` → `admin`, `super_admin`, `administrator`, `junior_admin` plus DB `menu_permissions` when loaded.

### Backend authorization

`audit-log-routes.ts`:

- `const ROLES = ["admin", "super_admin", "super_hod"]`
- `router.get("/", requireRole(...ROLES), …)` — list only; **read-only**
- Filters: query params (actor, module, entityType, entityId, action, dateFrom, dateTo); **no** per-row ownership check beyond role gate
- Data: `drm.activity_logs` (sensitive JSON in `details`)

`requireRole` (`auth.middleware.ts`) → **403** `{ error: "Insufficient permissions" }` if active/assigned role not in list.

### Mismatch — **confirmed**

| Role | Can open `/admin/audit-logs` (client `/admin` guard) | `GET /api/audit-logs` |
|------|------------------------------------------------------|------------------------|
| `admin`, `super_admin`, `super_hod` | Yes | Yes |
| `administrator` | Yes | **403** (not in backend ROLES) |
| `service_manager` | Yes | **403** |
| `junior_admin` | May via sidebar hardcode / menu DB | **403** |

User experience: page shell loads; table shows **“Failed to load audit logs”** (`isError` branch in `audit-logs.tsx`) — fail-closed on API, fail-open on route.

### Least disruptive resolution (documentation only — implement in a later task)

**Do not** widen backend `ROLES`.

Preferred (frontend-only, Express stays authority):

1. Add **`/admin/audit-logs`** to `ROUTE_PERMISSIONS` with the same three roles as `audit-log-routes.ts` (must fail users who pass only the broad `/admin` rule — loop evaluates every matching prefix).
2. Optionally gate sidebar Audit Logs link with the same role set (or hide when `GET /api/audit-logs` would 403).

Alternative: redirect unauthorized users from the page — same effect.

### Pilot impact

- **Avoid** piloting `/admin/audit-logs` until client guard matches backend, or document known UX for misconfigured roles.
- Sensitive data: backend gate is correct; fix is **client alignment**, not API relaxation.

### Recommended follow-up

| Field | Value |
|-------|--------|
| Owner (proposed) | Frontend migration owner (Next `useRouteProtection` port) |
| Backlog ID | `AUTH-AUDIT-01` |
| Acceptance criteria | `service_manager` / `administrator` cannot reach page or see sidebar link; authorized roles load paginated list; manual test matrix documented |

---

## Remaining uncertainty

- Whether production branch restores full `approval-routes` / `approval-visibility.service` (not verifiable from this branch alone).
- Exact `menu_permissions` rows for `Admin` permKey in deployed DB (sidebar may hide Audit Logs for some roles despite loose `/admin` guard).
- Per-handler auth on `/api/pms/approvals` (separate backlog).

**Phase 0 remains open.**
