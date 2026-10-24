# Phase 14 — Customer module migration (tracker)

**Project:** DRM WebExcels  
**Branch:** `fix/upgrade_frontend_habib`  
**Owner:** Habib  
**Overall status:** **In progress** — **14A–14C implemented in Next** (full legacy parity not claimed; Habib browser sign-off pending)

## Internal sub-phases

| Sub-phase | Scope | Status |
|-----------|--------|--------|
| **14A** | Routes, redirects, nav, guards; Check Duplication; **Add Customer**; Invoice Pool; In service Report; Active Clients orphan | **Complete** (browser sign-off pending) |
| **14B** | Temporary Contact, Service Pool, Public Pool Follow-up | **Implemented** (browser sign-off pending) |
| **14C** | GM BV Pool, Private/Public Pool (sales + service role variants) | **Implemented** (core workflows; deep legacy modals deferred) |

---

## 1. Customer sidebar inventory (legacy source of truth)

From `frontend/src/components/app-sidebar.tsx` → Customer group (11 items).  
**Excluded:** Lead → GM BV Pool (`/customers/gmbv-pool`), DRM Related Customer, Office Business Customer (different sidebar groups).

| # | Sidebar label | Legacy route | Next canonical route | Legacy page | Lines (approx) |
|---|---------------|--------------|----------------------|-------------|----------------|
| 1 | Check Duplication | `/sales/duplicate-checker` | `/dashboard/sales/duplicate-checker` | `CheckDuplicationPage.tsx` | 291 |
| 2 | Add Customer | `/sales/add-customer` | `/dashboard/sales/add-customer` | `add-customer.tsx` | 1675 |
| 3 | Temporary Contact | `/customer/temporary-contact` | `/dashboard/customer/temporary-contact` | `temp-contact.tsx` | 805 |
| 4 | Private Pool | `/customers/private-pool` | `/dashboard/customers/private-pool` | `DynamicPrivatePool` → `lead-pools` / `service-private-pool` | 3935+ |
| 5 | Service Pool | `/customers/service-pool` | `/dashboard/customers/service-pool` | `service-pool.tsx` | 566 |
| 6 | Gm Bv Pool | `/gm-pool/add-gm` | `/dashboard/gm-pool/add-gm` | `gm-pool-add-gm.tsx` | 2082 |
| 7 | In service Report | `/reports/in-service` | `/dashboard/reports/in-service` | `reports-in-service.tsx` | 271 (mock UI) |
| 8 | Public Pool (Pick up) | `/customers/public-pool` | `/dashboard/customers/public-pool` | `DynamicPublicPool` | 3935+ |
| 9 | Public Pool (Follow up) | `/customers/public-pool-followup` | `/dashboard/customers/public-pool-followup` | `public-pool-followup.tsx` | 275 |
| 10 | Invoice Pool | `/sales/invoice-pool` | `/dashboard/sales/invoice-pool` | `invoice-pool.tsx` | 375 |
| 11 | Active Clients | `/sales/active-clients` | `/dashboard/sales/active-clients` | **None (sidebar orphan)** | — |

**Related internal routes (not sidebar):** `/sales/customers`, `/sales/tracing`, `/customers/attribute/:id`, `/sales/create-invoice/:customerId`, etc. — out of Phase 14 sidebar scope unless linked from migrated pages.

---

## 2. API endpoints (by submodule)

| Submodule | Primary APIs |
|-----------|----------------|
| Check Duplication | `GET /api/check-duplicate?company&email&phone` |
| Add Customer | `POST /api/sales/customers`, checks, temp convert, posting products |
| Temporary Contact | `GET/POST /api/customer/temporary-contact`, meta, duplicate check |
| Private / Public Pool | `GET /api/sales/lead-pools/list`, summary, claim, pick; service pool variants |
| Service Pool | `GET /api/sales/service-pool/summary`, `list`, `PATCH .../assign` |
| GM BV Pool | `GET /api/gm-pool`, `POST /api/gm`, search, duplicate checks, withdraw/update |
| In service Report | **None** (legacy mock charts) |
| Public Pool Follow-up | `GET .../public-pool-followup/main-services`, sub-services, customers; `POST /api/sales/leads/:id/assign`; FollowupModal |
| Invoice Pool | `GET /api/sales/invoice-pool`, `GET /api/sales/invoice-pool/:id` |
| Active Clients | N/A |

---

## 3. Permissions

- **Menu:** `permKey: "Customer"` → `MENU_PERM_ROLES.Customer` / legacy `DEPT_NAME_TO_ROLES` fallback.
- **Route guard:** `toLegacyGuardPath("/dashboard/...")` → prefixes in `route-access.ts` (`/sales`, `/customers`, `/customer`, `/gm-pool`, `/reports`).
- **Backend:** Existing Express middleware per route — unchanged in Phase 14.

---

## 4. Feature parity checklist (summary)

Legend: ☐ not started · ◐ in progress · ☑ implemented · ✓ verified (tests/browser)

| Submodule | List/search | Writes | Detail/dialogs | Uploads | Status |
|-----------|-------------|--------|----------------|---------|--------|
| Check Duplication | ☑ debounced search | — | row select | — | ◐ (unit tests only) |
| Invoice Pool | ☑ tabs/filter | — | ☑ detail dialog | — | ◐ |
| In service Report | ☑ mock filters | — | mock charts | — | ☑ parity with legacy mock |
| Active Clients | — | — | — | — | ☑ orphan documented |
| Add Customer | ☑ form | ☑ POST + convert | ☑ CSV import; ☑ Auto Fill Test Data (QA) | — | ☑ implemented (14A) |
| Temporary Contact | ☑ list | ☑ POST | ☑ convert → Add Customer | — | ☑ implemented (14B) |
| Service Pool | ☑ filters/search | ☑ assign | ☑ FollowupModal | ☑ copy/CSV export | ☑ implemented (14B) |
| Public Pool F/U | ☑ main/sub/customers | ☑ claim on submit | ☑ FollowupModal | — | ☑ implemented (14B) |
| Private/Public Pool | ☑ list/tracing | ☑ pick / to-public | ☑ FollowupModal | — | ☑ 14C (service + sales) |
| GM BV Pool | ☑ list/search | ☑ Add GM POST | ☑ detail JSON | — | ☑ 14C (loan/install/edit/withdraw → legacy for full parity) |

---

## 5. Implementation files (Phase 14A)

| Area | Path |
|------|------|
| Route constants | `src/lib/navigation/customer-routes.ts` |
| Redirects | `legacy-redirects.ts` + `next.config.ts` |
| Nav | `navigation-config.ts`, `navigation-visibility.ts`, `migrated-routes.ts` |
| Views | `src/modules/customer/*` |
| App routes | `src/app/(app)/dashboard/sales|customer|customers|gm-pool|reports/**/page.tsx` |
| Tests | `customer-routes.test.ts`, updated `legacy-redirects.test.ts` |

---

## 6. Verification

```bash
cd frontend-next
npm run test && npm run typecheck && npm run lint && npm run build
```

| Check | Result (last run) |
|-------|-------------------|
| Tests | Run after pull — includes `customer-routes.test.ts` |
| Authenticated API workflows | **Blocked** — no E2E creds in agent env |

**After build:** restart Express + standalone on `:3001`; hard refresh browser.

---

## 7. Blockers / deferred

- **Full parity** for Add Customer, pools, GM pool, temp contact, service pool, public follow-up (large legacy surfaces + shared modals e.g. `FollowupModal`).
- **Active Clients:** product decision on orphan (phase-0b-resolution).
- **Invoice detail UI:** Next port uses JSON detail pane; legacy uses formatted tables — refine in 14A.1.
- **Do not** declare Customer module complete until all checklist rows are ✓ verified.

---

## 8. Recommendation

**Not ready** to migrate the next sidebar module until Habib signs off authenticated Customer workflows (pools + GM advanced actions).

**Legacy Vite:** unchanged; use as fallback for pending submodules.
