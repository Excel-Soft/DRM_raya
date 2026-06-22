# PATCH 6 — Role-Based UAT Matrix (Stage 10, Section B)

Date: 2026-06-22. Authorization is **evidence-based**: the enforcement design is taken
from source code, and the **direct-API permission layer is executed live** (see
"Executed evidence"). Full per-role *browser* UAT (clicking through every screen as
each role) is **PENDING** — there are no seeded credentials for all roles, and per the
Definition of Done **unexecuted UAT is recorded as PENDING, never a fabricated pass.**

## Authorization model (source of truth)

| Concern | Mechanism | File |
|---|---|---|
| Role list / normalization | `normalizeRole()` single source; alias collapsing | `server/utils/role-utils.ts` |
| Role derivation | From **JWT only** (`activeRoleId`/`roleId`/`role`/`role_id` → normalized). `x-acting-role` honoured **only** in dev/mock | `server/auth.middleware.ts`, `server/routes.ts` |
| Global API auth | `app.use("/api", authMiddleware)` | `server/routes.ts:220` |
| Anonymous rejection | **401** `missing-token` / `verify-failed` (not 403) | `server/auth.middleware.ts:102–148` |
| Insufficient role | **403** | `requireRole` (`auth.middleware.ts:155`), `requireActionPermission` (`server/middleware/action-permission.ts`) |
| Action permissions | `ACTION_PERMISSIONS` registry + `requireActionPermission`; `adminOverride` default **false** | `server/config/action-permissions.ts` |
| Domain guards (excluded modules) | GM-sales `requireGmSalesActionPermission`; financial `requireFinancialPermission`; reports `requireReportPermission`; penalties handler predicates | respective files |
| MOCK_AUTH | Dev-only bypass; **FATAL boot** if `NODE_ENV=production && MOCK_AUTH=true` | `server/routes.ts:109–153` |

## Executed evidence (live HTTP against `localhost:5000`)

### E1 — Anonymous protected-API sweep (16 endpoints) → all rejected
All return **401** (global auth) except disabled-module Support which returns **404**:

`GET /api/auth/me`, `GET /api/attributes/:cat`, `POST /api/attributes`,
`DELETE /api/attributes/:id`, `GET /api/gm`, `POST /api/gm`, `GET /api/invoices`,
`POST /api/invoices/:id/hod-approve`, `GET /api/account/ledger`,
`GET /api/reports/salary`, `GET /api/office/expenses`, `GET /api/it/domains`,
`GET /api/social-media/posts`, `GET /api/penalties`, `GET /api/settings/allowed-ips`
→ **401**;  `GET /api/support/tickets` → **404** (module flag OFF).

### E2 — Cross-role direct-API permission matrix (14 roles, signed JWTs)
Codes: `403`=RBAC-denied; `200/400/404/409`=RBAC-allowed (passed the guard, then hit
handler/validation); `401`=auth-fail (none observed → all tokens valid).

| Role | `attributes.view` (any authed) | `attributes.create` (FULL_ACCESS) | `attributes.delete` (FULL_ACCESS) | `gm.create` (initiator set) |
|---|---|---|---|---|
| admin | 200 ✅ | 400 (allowed) ✅ | 200 (allowed) ✅ | 400 (allowed) ✅ |
| super_hod | 200 ✅ | 400 (allowed) ✅ | 200 (allowed) ✅ | 400 (allowed) ✅ |
| hod | 200 ✅ | **403 denied** ✅ | **403 denied** ✅ | **403 denied** ✅ |
| sales_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403 denied** ✅ |
| sales_executive | 200 ✅ | **403** ✅ | **403** ✅ | 400 (allowed) ✅ |
| account_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |
| service_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |
| service_executive | 200 ✅ | **403** ✅ | **403** ✅ | **403 denied** ✅ |
| product_posting_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |
| qa_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |
| verification_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |
| it_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |
| hr_manager | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |
| employee (ordinary) | 200 ✅ | **403** ✅ | **403** ✅ | **403** ✅ |

**Findings:** (a) every authenticated role passes auth and view; (b) write to system
attributes is restricted to `admin`/`super_hod` (FULL_ACCESS) only; (c) GM creation is
limited to the configured initiator set (`admin`, `super_hod`, `sales_executive`) —
**`sales_manager`, `service_executive` and all other roles are denied**, confirming
Service GM participation is OFF by default (QA scenario 4) and GM initiation is scoped.

## Per-role action matrix

Legend: **EX-PASS** = executed live; **CODE** = enforced in code (design-verified, live
functional walkthrough pending); **VIS** = sidebar/route visibility from client guards;
**PEND** = live browser UAT pending; **MGMT** = gated on management confirmation.

| Role | Protected API access | Sidebar/route visibility | Create/Update/Delete | Approve/Reject | Export | Finalize | Workflow transition | Report view/export |
|---|---|---|---|---|---|---|---|---|
| anonymous | EX-PASS: all 401 (Support 404) | none (login gate) | 401 | 401 | 401 | 401 | 401 | 401 |
| admin | EX-PASS (200) | full | EX-PASS attr/gm allowed; CODE elsewhere | CODE (all queues) | CODE | CODE | CODE | CODE |
| super_admin → `admin` | EX-PASS | full | EX-PASS allowed | CODE | CODE | CODE | CODE | CODE |
| super_hod | EX-PASS (200) | full | EX-PASS attr/gm allowed | CODE (super-hod approve) | CODE | CODE | CODE | CODE |
| HOD | EX-PASS (200) | dept scope | EX-PASS attr/gm **denied** (403); CODE dept writes | CODE (`hod-approve` invoice/gm) | CODE | CODE | CODE | CODE |
| account_manager / accounts_office | EX-PASS (200) | accounts | EX-PASS attr/gm denied; CODE accounts writes | CODE (`account-approve`, financial guard) | CODE | CODE (salary finalize lock) MGMT | CODE | CODE |
| sales_executive | EX-PASS (200) | sales | EX-PASS **gm.create allowed**, attr denied | CODE (own pool) | CODE | n/a | CODE | CODE (own scope) |
| sales_manager | EX-PASS (200) | sales mgmt | EX-PASS gm.create **denied** (not initiator) | CODE (`sales-manager-approve`) | CODE | n/a | CODE | CODE |
| service_executive | EX-PASS (200) | service | EX-PASS gm.create **denied** (Service GM OFF) MGMT | CODE | CODE | n/a | CODE | CODE |
| service_manager | EX-PASS (200) | service mgmt | EX-PASS denied; CODE service writes | CODE | CODE | n/a | CODE | CODE |
| PMS / project manager | CODE | PMS | CODE (`pms-routes`) | CODE | CODE | CODE | CODE (transition rules WF-002 Partial) | CODE |
| product_posting_manager | EX-PASS (200) | product posting | EX-PASS attr/gm denied; CODE PP writes | CODE | CODE | n/a | CODE (listing-QA gate MGMT) | CODE |
| product_posting_executive | CODE | product posting | CODE | n/a | CODE | n/a | CODE | CODE |
| DD manager | CODE | DD | CODE | CODE | CODE | n/a | CODE | CODE |
| DD executive | CODE | DD | CODE | n/a | CODE | n/a | CODE | CODE |
| software_manager | CODE | software | CODE | CODE | CODE | n/a | CODE | CODE |
| software_executive | CODE | software | CODE | n/a | CODE | n/a | CODE | CODE |
| QA manager | EX-PASS (200) | QA | EX-PASS attr/gm denied; CODE QA writes | CODE (listing QA approve) | CODE | n/a | CODE | CODE |
| verification manager | EX-PASS (200) | verification | EX-PASS denied; CODE verify writes | CODE | CODE | n/a | CODE (final-stage rule MGMT) | CODE |
| HR manager | EX-PASS (200) | HR | EX-PASS denied; CODE HR writes | CODE | CODE | CODE (salary) MGMT | CODE | CODE |
| IT manager | EX-PASS (200) | IT/domains | EX-PASS attr/gm denied; CODE server-names CRUD | CODE | CODE | n/a | CODE | CODE |
| ordinary employee | EX-PASS (200 view, 403 writes) | minimal | EX-PASS all sensitive **denied** (403) | 403 | scoped | n/a | 403 | own scope |

## Status & gaps

- **Executed now:** anonymous rejection (16 endpoints) and cross-role RBAC on the
  `attributes.*` action-permission family and `gm.create` (14 roles) — **all pass.**
- **PENDING (live browser UAT):** end-to-end click-through per role for create/update/
  delete, approve/reject, finalize, workflow transitions and report exports on each
  module. Requires seeded per-role accounts; recorded as PENDING per DoD.
- **MGMT-gated:** Service GM participation, salary finalize formula, product-posting
  Listing-QA dependency, verification-manager final stage (see
  `PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`).
