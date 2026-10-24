# Phase 0B — discrepancy resolution log

**Branch:** `fix/upgrade_frontend_habib`  
**Registry file updated:** `frontend/src/routes/route-registry.ts` (documentation only — no App/backend changes)

---

## Task 2 — Twelve former App-only routes

| Path | Resolution | Evidence summary |
|------|------------|------------------|
| `/account/dollar-advance-payment` | **Added to registry** | `App.tsx` → `DollarAdvancePayment`; API `/api/account/advance-payments` + `requireFinancialPermission` |
| `/account/dollar-buying` | **Added to registry** | `App.tsx` → `DollarBuying`; API `/api/account/buying` + financial permission |
| `/account/history/:companyId` | **Added to registry** | `App.tsx` → `AccountHistory`; dynamic; API `company-ledger-routes.ts` |
| `/admin/audit-logs` | **Added to registry** | Sidebar + `AuditLogsPage`; API `audit-log-routes.ts` roles `admin,super_admin,super_hod` |
| `/approvals` | **Added to registry + open gap** | `Approvals` page calls `/api/approvals/*` but `approval-routes.ts` is **empty stub** — backend team must implement or remove UI |
| `/dashboard/complaint-manager` | **Added to registry** | `ComplaintManagerDashboard`; `ROLE_DASHBOARDS.complaint_manager` |
| `/dashboard/developer` | **Added to registry** | `DeveloperDashboard`; `ROLE_DASHBOARDS.developer` |
| `/dashboard/it-executive` | **Added to registry** | `ItExecutiveDashboard`; `ROLE_DASHBOARDS` + `/it` prefix guard |
| `/dashboard/seo-smm-executive` | **Added to registry** | `SeoSmmExecutiveDashboard`; `ROLE_DASHBOARDS.seo_smm_executive` |
| `/drm/branches` | **Added to registry** | Sidebar `permKey: Branches`; API `branches-routes.ts` read/write rules |
| `/office/general-ledger` | **Added to registry** | Sidebar Office Account; API `/api/office/ledger*` financial permission |
| `/office/journal-voucher` | **Added to registry** | Sidebar Office Account; API `/api/office/journal-vouchers*` |

**Not an App-only route:** `/approvals` (root) is **not** the same as `/pms/approvals` (registered PMS pending projects).

---

## Task 3 — Sidebar orphan `/sales/active-clients`

| Finding | Detail |
|---------|--------|
| Sidebar | `app-sidebar.tsx` — "Active Clients" → `/sales/active-clients` |
| App.tsx | **No** `<Route>` for this path |
| Codebase search | **No** page, alias, or API reference besides sidebar |
| Classification | **Dead / missing route** (broken navigation) |
| Recommended action | **Team decision:** (A) remove or hide sidebar item until implemented, (B) add `<Route>` + page in a future story, or (C) redirect to an existing customer list with documented filter — **do not** invent page in Phase 0B |

**Status:** `open` — tracked in matrix `meta.sidebarOrphans` with `resolutionStatus: open`.

---

## Task 4 — Authorization evidence

See **`auth-mapping-backlog.json`** — partial, code-cited mapping for sensitive/financial/admin routes.  
**Not claimed:** full 207-route backend handler mapping.

---

## Phase 0 closure

Still **not closed**: `/approvals` API stub, `/sales/active-clients` nav fix, full auth backlog, Talha ownership, production Node verification.
