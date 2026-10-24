# Phase 2 — Auth and app shell (in progress)

## Auth contract (from repository)

| Endpoint | Evidence |
|----------|----------|
| `POST /api/auth/login` | `auth.routes.ts` — body `{ email, password }`; returns `{ token, user }` |
| `GET /api/auth/me` | `authMiddleware`; returns `id, fullName, email, role, roles, activeRoleId, isActive, isImpersonating?` |
| `POST /api/auth/logout` | Clears auth cookie; client clears sessionStorage |
| Client session | Legacy `App.tsx` + `auth.tsx`: Bearer token in `sessionStorage`, `credentials: "include"` |

Express remains authority; Next client guard is not backend security.

## Pilot route

**`/notice-board`** — `GET /api/notice-board` (`notice-routes.ts`, `authMiddleware` only for list). Read-only UI in `notice-board-pilot.tsx`.

Excluded: `/approvals`, `/sales/active-clients`.

## Node for staging

Recommend **Node 22.13+ LTS or 24.x** per Next 16 + ESLint engines (`FOUNDATION_STATUS.md`). Local dev validated on 23.x with `.npmrc` `engine-strict=false`.

## Phase 3 continuation

See `docs/PHASE3_STATUS.md` — `/admin/audit-logs` module migrated (read-only).

## Not done

- Full legacy sidebar port
- Server-side Next route enforcement (`middleware` / `proxy.ts`)
- Production cutover
- Browser E2E (no test account / no Playwright in repo)
