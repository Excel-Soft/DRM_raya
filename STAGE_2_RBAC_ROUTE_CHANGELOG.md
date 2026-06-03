# Stage 2 — RBAC, Route, Sidebar & Permission Alignment — Changelog

Scope: make the sidebar, routing, and permission model internally consistent.
No UI redesign, no workflow changes, no DB schema changes, no broadening of
access (no exposing all routes to all roles), and no undoing of Stage 1.

Companion document: `ROUTE_PERMISSION_MATRIX.md`.

---

## Files changed

| File | Change |
|---|---|
| `client/src/App.tsx` | Removed 8 shadowed duplicate `<Route>` declarations (kept the first/canonical occurrence of each); removed the now-unused `import PmsSettings`. |
| `client/src/lib/role-utils.ts` | Hardened `normalizeRole`: hyphens treated as separators; `d&d / dnd / d_d / d-d` collapse to `dd` (token-anchored). |
| `server/utils/role-utils.ts` | Same `normalizeRole` hardening applied server-side for parity. |
| `client/src/hooks/useRouteProtection.ts` | Removed the local `normalize` helper; now imports the central `normalizeRole` from `@/lib/role-utils`. |
| `client/src/pages/sales/create-invoice.tsx` | Added invalid-link and customer-not-found states. |
| `client/src/pages/loan-report-edit.tsx` | Added invalid-id and load-error states. |
| `ROUTE_PERMISSION_MATRIX.md` | New — full route/permission matrix (deliverable). |
| `STAGE_2_RBAC_ROUTE_CHANGELOG.md` | New — this file (deliverable). |

---

## Route fixes (Task B — duplicate routes)

`App.tsx` routes live inside a wouter `<Switch>` where the **first match wins**;
later duplicates were dead code. The following shadowed duplicates were removed,
keeping the first (canonical) declaration. Route count 197 → 189; zero duplicate
paths remain.

| Route | Resolution |
|---|---|
| `/account/gm-entries` | kept first; removed later dup |
| `/drm/delay-project` | kept first; removed 2 later dups |
| `/drm/pms-setting` | kept canonical `PmsSettingPage`; removed the shadowed `PmsSettings` dup. `pages/pms-settings.tsx` is now unreferenced (file left in place per "do not delete backup/scratch files"). |
| `/office/chart-of-accounts` | kept first; removed later dup |
| `/pms/project-report` | kept first; removed later dup |
| `/product-posting/executive` | kept first; removed later dup |
| `/product-posting/manager` | kept first; removed later dup |

No route paths were added or renamed; only dead duplicates were deleted.

---

## Sidebar fixes (Tasks E, G — verification)

No structural sidebar changes were required; the sidebar URL set already aligned
with the route set. Verified and documented:

- **4 sidebar URLs with no exact App route** — `/reports/bv`, `/reports/gm`,
  `/reports/loan`, `/reports/vas` — are all served by the dynamic route
  `/reports/:type` (`UserReports`), which validates the type via `isReportType`
  (`loan | vas | gm | bv`) and selects the matching tab. Invalid types fall back
  to the Loan tab gracefully. No alias routes were needed.
- **Expected duplicate sidebar entries** (`/reports/vas`, `/reports/loan`,
  `/reports/bv`, `/posting-data/link-report`) are intentional aliases and were
  left as-is.

---

## Permission-model changes (Tasks D, E)

- **Central role normalization.** `normalizeRole` is now the single normalization
  path on both client and server. It treats spaces **and hyphens** as separators
  and collapses the design-&-development variants to `dd`:
  - `super-hod → super_hod`
  - `d & d`, `d&d`, `dnd`, `d_d`, `d-d` → `dd` (so `dnd_manager`,
    `d_d_manager`, `d-d-manager` all normalize to `dd_manager`)
  - All previously-existing mappings are preserved unchanged.
- **Single active-role source.** `useRouteProtection` no longer defines its own
  local role-normalizer; it imports the central one, so the route guard, the
  sidebar, and the backend all normalize identically. The active role itself
  continues to flow from `/api/auth/me` (`activeRoleId`) into both the route
  guard and the sidebar (see matrix §1). No behavioural redesign.
- **No access broadening.** No role was granted access it did not previously
  have; `ROUTE_PERMISSIONS` and `DEPT_NAME_TO_ROLES` membership is unchanged.
  Normalization only makes equivalent spellings resolve to the same canonical
  role.

### Verification-by-inspection of `normalizeRole`
| Input | Output |
|---|---|
| `Super Admin` | `super_admin` |
| `super-hod` | `super_hod` |
| `dnd_manager` | `dd_manager` |
| `d_d_manager` | `dd_manager` |
| `d-d-manager` | `dd_manager` |
| `D & D Manager` | `dd_manager` |
| `product_posting_executive` | `product_posting_executive` (unchanged) |

---

## Dynamic-route robustness (Task F)

Loading / invalid-param / not-found / unauthorized states were added only where
missing (no redesign, existing component styling preserved):

- `create-invoice/:customerId` — added "Invalid invoice link" (missing param)
  and "Customer not found" (query error/missing) states.
- `reports/loan/:id/edit` — added invalid-id and load-error card.
- Already adequate (verified, unchanged): `support/tickets/:id`,
  `sales/tracing/view/:id`, `reports/:type`.
- `training/:category` — the `:category` param is not consumed by the component
  (selection is internal state). Left unchanged (pre-existing behaviour, no
  redesign in scope). Recorded under Unresolved below.

See `ROUTE_PERMISSION_MATRIX.md` §3 for the per-route state table.

---

## Test / verification commands

| Command | Result |
|---|---|
| `npx tsc --noEmit` (a.k.a. `npm run check`) | 64 pre-existing errors — **no new errors introduced** by Stage 2 |
| `npx vitest run` | 2 passed / 2 (only suite: `server/performance-routes.team.test.ts`) |
| `npm run build` | succeeds (client Vite build + server bundle) |
| Dev smoke (`Start application`, port 5000) | `GET /` → 200; `GET /api/auth/me` (no token) → 401 (correct) |

---

## Unresolved / follow-ups (documented, intentionally not changed in Stage 2)

These are observations surfaced during Stage 2. They were **not** changed to
avoid altering live access or doing redesign outside scope.

1. **76 routes have no client route-guard** (`ROUTE_PERMISSIONS` prefix). They
   are reachable by any authenticated user via direct URL; the sidebar still
   hides them and the backend still enforces data access. Sensitive examples for
   a future hardening pass: `/drm/users/*`, `/drm/permission`, `/office/*`,
   `/account/*`, `/allowed-ip/drm-ip-list`, `/daily-reports/added-gm`,
   `/target-system/*`. Tightening these is a deliberate, backend-coordinated
   change deferred beyond Stage 2.
2. **`/training/:category`** ignores its URL param (component-internal selection).
   Wiring the param to the active category is a small UX change left for later.
3. **`pages/pms-settings.tsx`** is now unreferenced after the `/drm/pms-setting`
   dedup. Left in place per the "do not delete backup/scratch files" preference.
4. **Pre-existing `npm run check` errors (64)** are out of Stage 2 scope and were
   left untouched.
5. **`/api/db-health` returns 401 without a token** — pre-existing behaviour,
   unrelated to RBAC/route alignment, out of scope.
