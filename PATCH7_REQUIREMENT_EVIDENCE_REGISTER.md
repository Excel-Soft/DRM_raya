# PATCH 7 — Requirement Evidence Register (Stage 8, Section H)

**Date:** 2026-06-30. One row per requirement in `PATCH7_TRACEABILITY_MATRIX.md`,
with the concrete evidence artifacts. **Evidence:** CODE = source · AUTO = test
(227/227) · LIVE = executed this session · P6-LIVE = prior identical-code session ·
UAT = browser walkthrough (Open, UAT-004). Status follows `PATCH7_DEFINITION_OF_DONE.md`.

## P0 — Security / Invoice / GM / Workflow / Service / Support / Governance

| ID | Files (representative) | API route | DB table | Validation | Permission guard | Audit event | Report/Dashboard | UAT result | Reviewer | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | `routes.ts`, `useRouteProtection.ts` | all `/api/*` (auth global) | — | — | global JWT + `requireActionPermission` | auth events | — | **LIVE** anon 401 ×7 + role 403 | QA ✓ | **Complete** (scoped: API permission) |
| SEC-002 | `config/validate-secrets.ts`, `index.ts:16` | — | env | secret strength | `assertSecretsOrExit` | — | — | AUTO (validate-secrets.test) | QA ✓ | Partial (prod boot drill pending) |
| SEC-003 | `requireActionPermission` (+variants, 24 files) | sensitive mutations | — | — | action-permission | per action | — | LIVE penalty 403 | QA ✓ | Partial (full census pending) |
| VAL-001 | zod DTOs (69 files) | write endpoints | — | zod | — | — | — | LIVE audit invalid-date 400 | QA ✓ | Partial |
| SQL-001 | repos (project-financials, tasks, projects) | — | — | parameterized | — | — | — | CODE 4 `sql.raw` sites reviewed | QA ✓ | Partial |
| INV-001 | `account-routes.ts` status path | invoice status PATCH | `drm.invoices` | permissive status schema | role | **missing on raw path** | — | — | QA ✗ | **Open** |
| INV-002 | `invoice-workflow.service.ts` | invoice approve | `drm.invoices` | `assertApprovalReadiness` | role/stage | invoice.*_approve | accounts dash | PENDING-UAT | QA ✓(code) | In Progress |
| INV-003 | `createOrLinkProjectForApprovedInvoice` | approve→project | `drm.projects` `uq_projects_invoice_root` | idempotent | role | project create | — | PENDING-UAT | QA ✓(code) | In Progress |
| WF-001 | `CrossDepartmentStatusService` | transitions | `drm.cross_department_status_history` | — | — | history + notify | downstream | PENDING-UAT | QA ✓ | Partial |
| WF-002 | `pms-transition.service.ts` | pms transitions | pms tables | — | role | pms transition | pms | PENDING-UAT | QA ✓ | Partial |
| GM-001 | `gm-pool-routes.ts` | GM create | `drm.gm_*` | zod | `requireGmSalesActionPermission` | gm.create | — | P6-LIVE matrix | QA ✓(code) | **NMC** |
| GM-002 | `resolveCanonicalGmType` | GM create | `drm.gm_*` | type routing | role | gm.create | — | PENDING-UAT | QA ✓(code) | In Progress |
| GM-003 | `validateMinimumPaymentThreshold` | GM create | settings | threshold hook | role | — | — | — | QA ✓ | **NMC** (thresholds) |
| GM-004 | `enforceLoanPartialFinalApprovalGate` | partial finalize | `drm.gm_partial_receipts` | all-paid gate | role | gm.partial_receipt_add | — | AUTO; PENDING-UAT | QA ✓(code) | In Progress |
| GM-005 | `account-routes.ts` L149-160 | loan finalize | `drm.gm_loan_terms` | admin_approval_status | role | gm.loan_terms_add | — | PENDING-UAT | QA ✓(code) | In Progress |
| GM-006 | loan terms service | loan return | `drm.gm_loan_terms` | — | role | — | overdue report | — | QA ✓ | **NMC** (overdue rules) |
| GM-007 | `generateDefaultInvoicesForGm` | GM create | `drm.invoices` | — | role | invoice.auto_generate | — | PENDING-UAT | QA ✓(code) | In Progress |
| GM-008 | settings `ON_GM_CREATION` | timing | settings | — | — | — | — | — | QA ✓ | **NMC** (timing) |
| GM-009 | `requireGmSalesActionPermission` | service-exec GM | — | — | role | — | — | P6-LIVE deny | QA ✓ | **NMC** |
| GM-010 | `GET /api/accounts/dashboard/gm-summary` | dashboard | `drm.*` | — | role | — | accounts dash | LIVE anon 401 | QA ✓ | Partial (formula signoff) |
| SRV-001 | `service-core-routes.ts` | service→GM bridge | `drm.*` | — | role | — | — | — | QA ✓ | **NMC** |
| SRV-002 | `service-core-routes.ts` | service lifecycle | `drm.*` | validators | role | rich AuditLog | service reports | PENDING-UAT | QA ✓ | Partial |
| SUP-001 | `routes.ts:100` | `/api/support*` → 404 | `drm.support_tickets` | — | short-circuit | — | — | P6-LIVE 404 | QA ✓ | **NMC** (disposition) |
| PROD-001 | `validate-secrets.ts`, MOCK_AUTH guards, `feature-flags.ts` | — | env | secret strength | prod guards | — | — | AUTO + LIVE gates green | QA ✓ | Partial (prod drill) |
| DB-001 | `drizzle.config.ts`, `db/ensure.ts`, `index.ts:76` | — | `drm` (641 tables) | — | — | — | — | LIVE table census + boot ensure | QA ✓ | Partial (db:push FK) |
| UAT-004 | all | all | all | — | — | — | — | **LIVE API matrix; browser PENDING** | QA partial | **Open** |
| P5-001 | `PATCH5_*`, `patch5-stage7-role-matrix.test.ts` | — | — | — | — | — | — | AUTO (180) ; PENDING-UAT | QA ✓ | Partial |

## P1 — Frontend / PMS / Comms / Domain / Office / Reports / Penalty / Audit / UI / QA

| ID | Files | API route | DB table | Validation | Permission | Audit | Report/Dashboard | UAT | Reviewer | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| API-001 | `lib/queryClient.ts` (`apiRequest` ×154); 34 raw fetch | — | — | — | central 401 handling | — | — | PENDING-UAT | QA ✓ | Partial |
| COM-001 | comms routes | comms | `drm.*` | — | role | comms log | — | PENDING-UAT | QA ✓(code) | In Progress |
| DOM-001 | `it-assets-routes.ts` | domains | `drm` domains | zod | role | domain audit | — | PENDING-UAT | QA ✓(code) | In Progress |
| DOM-002 | `it-servers.tsx`, `it-assets-routes.ts` | servers CRUD | `drm` servers | zod | role | server audit | — | PENDING-UAT | QA ✓ | Partial |
| OFF-001 | `office-account-routes.ts` | expenses | `drm.office_expenses` | zod | role | office audit | — | PENDING-UAT | QA ✓ | Partial |
| OFF-002 | `App.tsx:331,335` | legacy redirect | `drm.account_heads` | — | — | — | — | CODE redirect | QA ✓ | Addressed by redirect (UAT pending) |
| OFF-003 | `chart-of-accounts.tsx` | heads CRUD | `drm.account_heads` | zod | role | — | — | PENDING-UAT | QA ✓ | Partial |
| OFF-004 | `office-trial-balance.tsx` | trial balance | `drm.*` | — | role | — | TB report | PENDING-UAT | QA ✓ | Partial (formula) |
| OFF-005 | office VAS page | VAS source | `drm.*` | — | role | — | VAS report | — | QA ✓ | **NMC** (VAS source) |
| OFF-006 | `general-ledger.tsx` | ledger | `drm.*` | — | role | — | ledger | PENDING-UAT (reverse confirm gap) | QA ✓ | Partial |
| REP-001 | `reports-routes.ts` | reports | `drm.*` | — | role | report export | reports | — | QA ✓ | **NMC** (ownership) |
| REP-002 | `gm-bv-pool-routes.ts` | BV report | `drm.*` | — | role | — | BV report | — | QA ✓ | **NMC** (formulas) |
| REP-003 | `reports-routes.ts` | export | `drm.*` | — | role | report export | reports | `PATCH7_REPORT_EXPORT_PARITY_RESULTS.md`; PENDING-UAT | QA ✓(code) | In Progress |
| REP-004 | hod/salary routes | salary | `drm.*` | — | role | salary generate/approve/finalize | salary report | — | QA ✓ | **NMC** (formula/freeze) |
| REP-005 | `reports-routes.ts` | attendance/day-target | `drm.*` | — | role | — | reports | — | QA ✓ | **NMC** (formulas) |
| PEN-001 | penalty routes | `/api/penalties*` | `drm.penalties` | zod | penalty-permission | penalty.create/approve/void | — | **LIVE** 403 deny | QA ✓(code) | In Progress |
| P5-PEN-001 | penalty routes | `/api/penalties*` | `drm.penalties` | zod | penalty-permission | penalty.* | — | LIVE 403 | QA ✓ | In Progress |
| AUD-001 | `audit-log.service.ts`, `audit-log-routes.ts` | `GET /api/audit-logs` | `drm.activity_logs` | param filters | `requireRole(admin/super_admin/super_hod)` | viewer of all events | audit viewer | **LIVE** 200/403/400 | QA ✓ | Partial (legacy coverage) |
| UI-001 | many pages | — | — | client+server | — | — | — | `PATCH7_ACTIVE_SCREEN_UI_AUDIT.md` | QA ✓ | Partial |
| SOC-001 | `social-media-routes.ts` | social CRUD | `drm.social_media_posts` | zod | role | social audit | social dash | PENDING-UAT | QA ✓(code) | In Progress |
| SOC-EXT-001 | — | none (by design) | — | — | — | — | — | — | QA ✓ | **NMC** (scope) |
| ACC-LEGACY-001 | `office-old-account-head.tsx` | `App.tsx` redirect | `drm.account_heads` | — | sidebarVisible:false | — | — | CODE redirect | QA ✓ | Partial |
| QA-001 | build/check/test | — | — | — | — | — | — | **LIVE** gates 227/227 + build/check 0; PENDING browser UAT | QA ✓ | Partial |
| QA-002 | `assertProductPostingDependencySatisfied` | posting assign | `drm.*` | dependency gate | role | — | — | — | QA ✓ | **NMC** (dependency) |

**Reviewer:** Stage-8 QA = automated gates (227/227, build/check exit 0) + source
evidence + LIVE permission probes. **Not** a substitute for management business-rule
confirmations or live role-based browser UAT, both outstanding where noted.
