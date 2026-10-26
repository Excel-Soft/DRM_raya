# Phase 3 — Controlled module migration

## Pre-migration verification (Phase 2 foundation)

| Check | Result |
|-------|--------|
| Auth bootstrap | `AuthProvider` + `GET /api/auth/me` on mount |
| Session storage | Bearer token in `sessionStorage` (legacy-compatible) |
| Page refresh | Re-validates via `/api/auth/me` on reload |
| Logout | `POST /api/auth/logout` + clear session → `/auth` |
| Expired session | 401 on `/me` → clear session, redirect `/auth` |
| Login E2E | **Not automated** — no test credentials in repository |
| Browser E2E infra | **None** (no Playwright/Cypress in `frontend-next`) |
| Route access | **Client-only** (`AuthGate` + `route-access.ts`) — see limitations below |
| Express authority | All business APIs enforce JWT + handler rules independently |

### Client guard limitations

- Prefix rules in `src/lib/auth/route-access.ts` are **not** server-side security.
- A user can bypass UI guards with devtools; **403 from Express** is expected for unauthorized API calls.
- No Next.js `middleware.ts` / `proxy.ts` enforcement in this phase.

## Module selection (evidence)

| Rank | Route | Why / why not |
|------|-------|----------------|
| **1 (chosen)** | `/admin/audit-logs` | Read-only; `audit-log-routes.ts` `requireRole(admin,super_admin,super_hod)`; client prefix aligned; filters + pagination in legacy |
| 2 | `/notice-board` | Phase 2 pilot (read-only list only); writes need managerial checks — deferred |
| 3 | `/policies` | GET any auth user; UI heavy (xlsx/pdf) — higher dependency cost |
| — | `/approvals` | Excluded — API stub |
| — | `/sales/active-clients` | Excluded — no App route |

## Phase 3 deliverable

**Module:** Admin Audit Logs — `src/modules/audit-logs/`, route `src/app/(app)/admin/audit-logs/page.tsx`

## Talha ownership

**Not confirmed.** Talha continues API inventories per `talha-parallel-tasks.md` without editing shared foundation files.

## Cutover

**Not performed.** Legacy Vite `frontend/` and `deploy.sh` unchanged.
