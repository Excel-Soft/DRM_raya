# PATCH 7 — TRACEABILITY MATRIX

**Stage:** Patch 7 — Stage 0. **Date:** 2026-06-29.
**Status legend:** Open · In Progress · Partial · Complete · Blocked · Needs Management Confirmation (NMC).
**Evidence legend:** AUTO = automated test · CODE = code inspection · LIVE = executed HTTP/DB probe · UAT = role-based browser walkthrough.

> "Complete" is reserved for requirements with executed evidence across the full
> Definition of Done (see `PATCH7_DEFINITION_OF_DONE.md`). Code-complete features
> whose only gap is browser UAT are marked **In Progress**, not Complete.
> Business-rule items awaiting sign-off are **NMC** regardless of code state.

---

## P0 — Security, Validation, Invoice, GM, Workflow, Service, Support, Governance

| ID | Pri | Area | Patch src | Frontend route/file | Backend route/service | DB table/source | Required behavior | Current evidence | Missing pieces | Stage | Evidence required | QA/UAT scenario | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | P0 | Security/RBAC API closure | P3/P6 | `useRouteProtection.ts` | `routes.ts:220` global auth; `middleware/action-permission` | `drm.menu_permissions`, role tables | Business `/api` routes behind JWT (`/api/auth` + health intentionally public); sensitive ops action-permission guarded | LIVE anon `/api/customers`,`/api/invoices`→401 (this session); P6-LIVE anon 16-endpoint sweep + cross-role JWT matrix (prior same-code session); CODE auth :220, attributes :272 | Full per-endpoint census (→SEC-003) | 1 | LIVE+CODE per route | anon→401; wrong role→403 | Complete (scoped: sensitive business API auth closure executed/sampled; full endpoint census tracked by SEC-003) |
| SEC-002 | P0 | Secrets / JWT hardening | P6 | — | `config/validate-secrets.ts`; `index.ts:16` | env | Prod fail-fast on missing/weak/<32 `JWT_SECRET`; MOCK_AUTH prod-fatal | CODE `assertSecretsOrExit`; CODE MOCK_AUTH FATAL `routes.ts:109` | Prod-env boot drill (weak/missing secret) | 1 | LIVE prod boot | bad secret→exit | Partial |
| SEC-003 | P0 | Action-level RBAC coverage | P6 | — | `requireActionPermission` + variants (24 files) | — | Every sensitive mutation action-permission guarded | CODE 24 files; P6-LIVE gm/attributes matrix | 100% endpoint census; INV-001 gap | 1 | per-endpoint census | each mutation guarded | Partial |
| VAL-001 | P0 | Strict validation / DTO | P6 | — | zod (69 files) | — | Strict schema on all write endpoints | CODE zod×69; CODE 0 `.values(req.body)` | Full write-endpoint schema census | 1 | per-endpoint schema audit | invalid body→400 | Partial |
| SQL-001 | P0 | SQL hardening | P6 | — | repos (project-financials, tasks, projects) | — | No unsafe dynamic SQL | CODE 4 `sql.raw` sites; params prevalent | Verify 4 sites identifier-safe | 1 | inspect 4 sites | no injection vector | Partial |
| INV-001 | P0 | Invoice raw status update | P3/P6 | invoice pages | `account-routes.ts` status path | `drm.invoices` | Status via state machine + audit, not raw PATCH | CODE permissive `status` schema, not workflow-bound | Route through `invoice-workflow.service.ts` | 2 | LIVE raw status jump | blocked/audited | **Open** |
| INV-002 | P0 | Invoice state machine | P5/P6 | invoice pages | `invoice-workflow.service.ts`; `assertApprovalReadiness` | `drm.invoices` | Approval readiness + duplicate guard | CODE + AUTO; `findActiveDuplicate` | browser UAT | 2 | UAT approve incomplete | blocked | In Progress |
| INV-003 | P0 | Invoice→project idempotent link | P5 | — | `createOrLinkProjectForApprovedInvoice` | `drm.projects` `uq_projects_invoice_root` | One project per approved invoice root | CODE unique constraint + AUTO | browser UAT | 2 | UAT approve twice | one project | In Progress |
| WF-001 | P0 | Cross-dept status sync | P5 | — | `CrossDepartmentStatusService` | `drm.cross_department_status_history` | Status propagation + next-dept notify | CODE + AUTO (writes history + notify) | browser UAT | 2/3 | UAT transition→downstream | history+notify | Partial |
| WF-002 | P1 | PMS transitions | P6 | pms pages | `pms-transition.service.ts` | pms tables | Central transition service + audit | CODE audited service | browser UAT | 3 | UAT invalid transition | blocked | Partial |
| GM-001 | P0 | GM creation roles | P5 | gm pages | `gm-pool-routes.ts` `requireGmSalesActionPermission` | `drm.gm_*` | Only permitted roles create GM | P6-LIVE matrix: admin+super_hod+sales_executive allow; service_executive deny | service-exec policy | 2 | UAT role create | allow/deny | NMC |
| GM-002 | P0 | Full/Partial/Loan type routing | P5 | gm pages | `resolveCanonicalGmType` | `drm.gm_*` | Correct type classification | CODE + AUTO | browser UAT | 2 | UAT create each type | correct routing | In Progress |
| GM-003 | P0 | GM payment thresholds | P5 | gm pages | `validateMinimumPaymentThreshold` | settings | Per-package/type minimum thresholds | CODE hook; default `{}` | confirmed thresholds | 2 | UAT below threshold | blocked | NMC |
| GM-004 | P0 | Partial receipts all-paid gate | P5 | gm pages | `enforceLoanPartialFinalApprovalGate` | `drm.gm_partial_receipts` | Finalize only when fully paid | CODE gate `PARTIAL_PAYMENT_INCOMPLETE` + AUTO | browser UAT | 2 | UAT finalize underpaid | blocked | In Progress |
| GM-005 | P0 | Loan GM admin approval | P5 | gm pages | `gm_loan_terms.admin_approval_status` | `drm.gm_loan_terms` | Loan finalize needs Super-HOD approval | CODE status!=APPROVED→409 (`account-routes.ts` L149-160) | browser UAT | 2 | UAT finalize unapproved loan | 409 | In Progress |
| GM-006 | P1 | Loan return / overdue tracking | P5 | gm pages | loan terms service | `drm.gm_loan_terms` | Track due/return | CODE schema present | overdue rules | 2 | UAT overdue | flagged | NMC |
| GM-007 | P0 | GM default invoice generation | P5 | — | `generateDefaultInvoicesForGm` | `drm.invoices` | Generate default invoices on GM | CODE + Stage4 changelog | browser UAT | 2 | UAT create GM | invoices created | In Progress |
| GM-008 | P1 | Invoice generation timing | P5 | — | settings `ON_GM_CREATION` (default) | settings | Timing per management policy | CODE default | confirmed timing | 2 | UAT timing | per policy | NMC |
| GM-009 | P1 | Service-exec GM participation | P5 | — | `requireGmSalesActionPermission` | — | Service-exec GM allowed? | P6-LIVE denied (Service-GM OFF) | management decision | 2/3 | UAT service-exec GM | per policy | NMC |
| GM-010 | P1 | Accounts dashboard GM alignment | P5 | accounts dashboard | `GET /api/accounts/dashboard/gm-summary` | `drm.*` | Dashboard reflects GM types/invoice status | CODE endpoint (Stage7) | UAT + formula signoff | 4/5 | UAT vs ledger | reconciles | Partial |
| SRV-001 | P0 | Service→GM/VAS/BV bridge | P6 | service pages | `service-core-routes.ts` | `drm.*` | Bridge creates downstream records | CODE bridge; Service-GM OFF default | bridge decision | 3 | UAT bridge | per policy | NMC |
| SRV-002 | P0 | Service followup/complaint/dropout/renewal | P6 | service pages | `service-core-routes.ts` (audited) | `drm.*` | Lifecycle persisted + audited | CODE rich AuditLog | browser UAT | 3 | UAT lifecycle | persisted+audited | Partial |
| SUP-001 | P0 | Support deactivation (scope) | P4/P6 | support pages | `routes.ts:100` `/api/support`→404 | `drm.support_tickets` | Support disabled cleanly | LIVE anon `/api/support`,`/api/support/tickets`→404 (this session); CODE short-circuit :100; sidebar off | deactivate-vs-retain decision | 3 | LIVE/UAT /api/support | 404 | NMC |
| PROD-001 | P0 | Production readiness | P6/P7 | — | validate-secrets; MOCK_AUTH guard; `feature-flags.ts` | env | Prod guards + secrets + clean build | CODE guards; LIVE build/check/test pass | npm-audit, bundle size, prod boot drills | 6 | LIVE prod drills | guards fire | Partial |
| DB-001 | P0 | DB migration / schema sync | P7 | — | `drizzle.config.ts`; `ensureDbOnce` (`index.ts:76`); `db/ensure.ts` | `drm` schema | Reliable schema application | CODE runtime ensure DDL; LIVE 641 tables (Stage 8 re-census; supersedes earlier 528) | fix FK; restore `db:push` | 1/6 | schema parity | applied | Partial |
| UAT-004 | P0 | Role-based browser UAT | P6/P7 | all | all | all | Executed per-role browser UAT proof | LIVE anon 401 + cross-role API matrix | full browser UI UAT all roles | 6 | UAT per-role login+flows | documented pass | Open |
| P5-001 | P0 | Patch 5 evidence mapping | P5/P7 | — | `PATCH5_*` + `patch5-stage7-role-matrix.test.ts` (180) | — | Reqs+matrix+code+UAT mapped | CODE+AUTO (P1–P14, ISSUE_MATRIX, 180 tests) | role-based browser UAT; mgmt confirms | 6 | UAT walkthrough | per-role pass | Partial |

## P1 — Frontend, PMS, Comms, Domain, Office Accounts, Reports, Penalty, Audit, UI, QA

| ID | Pri | Area | Patch src | Frontend route/file | Backend route/service | DB table/source | Required behavior | Current evidence | Missing pieces | Stage | Evidence required | QA/UAT scenario | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| API-001 | P1 | Frontend API consistency | P6 | `client/src` (34 raw fetch) | `lib/queryClient.ts` `apiRequest` (154 files) | — | All client calls via `apiRequest` | CODE 154 apiRequest; 34 raw fetch | migrate 34 raw fetch | 1 | grep + UI smoke | consistent 401 handling | Partial |
| COM-001 | P1 | Communication lifecycle | P6 | comms pages | comms routes | `drm.*` | Lifecycle states persisted | CODE complete | browser UAT | 3 | UAT lifecycle | persisted | In Progress |
| DOM-001 | P1 | Domain names mgmt | P4/P6 | IT pages | `it-assets-routes.ts` (audited) | `drm` domains | CRUD + audit + validation | CODE + audit | browser UAT | 4 | UAT CRUD | persisted+audited | In Progress |
| DOM-002 | P1 | Server names mgmt | P4/P6 | `it-servers.tsx` | `it-assets-routes.ts` | `drm` servers | CRUD + audit | CODE; UI-state gaps | browser UAT; UI states | 4 | UAT CRUD | persisted | Partial |
| OFF-001 | P1 | Office expenses | P4/P6 | `office-expenses.tsx` | `office-account-routes.ts` (audited) | `drm.office_expenses` | CRUD + audit + validation | CODE + audit | browser UAT | 4 | UAT CRUD | persisted+audited | Partial |
| OFF-002 | P1 | Legacy account-head pages | P4 | `office-account-head.tsx`, `office-old-account-head.tsx` | `App.tsx:331,335` redirect | `drm.account_heads` | Replace legacy w/ Chart of Accounts | CODE redirect to `/office/chart-of-accounts` | confirm removal of dead files | 4 | UAT nav legacy | redirect | Addressed by redirect (UAT pending) |
| OFF-003 | P1 | Chart of accounts | P4/P6 | `chart-of-accounts.tsx` | `office-account-routes.ts` | `drm.account_heads` | Real CRUD | CODE table-backed | confirm dialogs; UAT | 4 | UAT CRUD | persisted | Partial |
| OFF-004 | P1 | Trial balance | P4/P6 | `office-trial-balance.tsx` | `office-account-routes.ts` | `drm.*` | Computed trial balance | CODE present | formula signoff; UAT | 4/5 | UAT compute | reconciles | Partial |
| OFF-005 | P1 | VAS page / source | P4/P6 | office VAS page | reports/accounts | `drm.*` | VAS source defined | CODE source ambiguous | confirmed VAS source | 4 | UAT VAS | per source | NMC |
| OFF-006 | P1 | General ledger | P4/P6 | `general-ledger.tsx` | `office-account-routes.ts` | `drm.*` | Ledger entries + reverse | CODE present; reverse lacks confirm | confirm dialog; UAT | 4 | UAT entry/reverse | persisted | Partial |
| REP-001 | P1 | Report ownership (Reports vs Accounts) | P2/P6 | report pages | `reports-routes.ts` | `drm.*` | Defined ownership | CODE ambiguous | ownership decision | 5 | — | per policy | NMC |
| REP-002 | P1 | BV metric formulas | P2/P6 | BV report | `gm-bv-pool-routes.ts` | `drm.*` | Confirmed formulas + backfill | CODE not signed off | formulas + migration policy | 5 | UAT formula | per policy | NMC |
| REP-003 | P1 | Report export parity | P6 | report pages | `reports-routes.ts` | `drm.*` | Export matches on-screen | CODE + `PATCH6_REPORT_EXPORT_PARITY_RESULTS.md` | browser UAT | 5 | UAT export vs screen | identical | In Progress |
| REP-004 | P1 | Salary formula / freeze | P2/P3/P6 | HR/salary | hod/salary routes | `drm.*` | Salary formula + freeze policy | CODE not signed off | confirmed policy | 5 | UAT salary | per policy | NMC |
| REP-005 | P1 | Attendance / day-target reports | P2/P6 | reports | `reports-routes.ts` | `drm.*` | Report correctness | CODE partial | formula signoff | 5 | UAT report | per policy | NMC |
| PEN-001 | P1 | Penalty cleanup | P2/P3/P6 | penalty pages | penalty routes | `drm.penalties` | Penalty calc cleanup | CODE complete | browser UAT | 5 | UAT penalty | correct calc | In Progress |
| P5-PEN-001 | P1 | Patch 5 penalty residual | P5/P7 | penalty | penalty routes | `drm.penalties` | Patch 5 penalty items closed | CODE (overlaps PEN-001) | browser UAT | 5 | UAT penalty | closed | In Progress |
| AUD-001 | P1 | Audit / notification coverage | P6/P7 | — | `services/audit-log.service.ts`→`drm.activity_logs` | `drm.activity_logs` | actor/time/before/after/reason on sensitive ops | CODE rich AuditLog (office/it/service/invoice/pms); legacy ActivityLog for notice/events/HR (no before/after) | migrate legacy to rich | 5/6 | UAT mutate→audit row | full context | Partial |
| UI-001 | P1 | UI validation/loading/empty/error states | P6/P7 | many pages | — | — | All screens have proper states | CODE most done | `it-manager-dashboard.tsx` mock data (Open); missing AlertDialog confirms | 6 | UAT states | all states | Partial |
| SOC-001 | P1 | Social media posting (internal) | P4/P6 | social pages | `social-media-routes.ts` | `drm.social_media_posts` | Internal post lifecycle persisted | CODE approval+publishing state machines | browser UAT | 3 | UAT lifecycle | persisted | In Progress |
| SOC-EXT-001 | P1 | Social external publishing | P7 | — | none (by design) | — | External provider publish scope | CODE explicitly internal/manual only | external scope decision | 3 | — | per policy | NMC |
| ACC-LEGACY-001 | P1 | Legacy account code cleanup | P7 | `office-old-account-head.tsx`, `office-account-head.tsx` | `App.tsx` redirects; `route-registry.ts` sidebarVisible:false | `drm.account_heads` | Legacy removed/redirected | CODE redirect; files retained (no-delete policy) w/ mock | removal decision | 4 | UAT nav→redirect | redirect ok | Partial |
| QA-001 | P1 | Patch 1 QA closure | P1/P7 | qa/verification pages | pms / product-posting routes | `drm.*` | Product posting / QA / verification flow | CODE partial | mgmt deps (listing-page QA, verification mgr) | 5 | UAT flow | per policy | Partial |
| QA-002 | P1 | Product posting listing-page QA dependency | P1/P5/P7 | product-posting | `assertProductPostingDependencySatisfied` | `drm.*` | Block assignment if QA pending | CODE gate; default false | dependency decision | 5 | UAT assign w/ pending QA | blocked | NMC |

---

### Status roll-up (Stage 0 baseline)
- **Open:** INV-001, UAT-004 (browser-UAT dimension).
- **Complete (scoped):** SEC-001 (API permission closure executed; full census via SEC-003).
- **In Progress (code-complete, UAT pending):** INV-002, INV-003, GM-002, GM-004, GM-005, GM-007, COM-001, DOM-001, REP-003, PEN-001, P5-PEN-001, SOC-001.
- **Partial:** SEC-002, SEC-003, VAL-001, SQL-001, API-001, WF-001, WF-002, GM-010, SRV-002, DOM-002, OFF-001, OFF-003, OFF-004, OFF-006, AUD-001, UI-001, ACC-LEGACY-001, PROD-001, DB-001, P5-001, QA-001.
- **Addressed by redirect (UAT pending):** OFF-002.
- **Needs Management Confirmation:** GM-001, GM-003, GM-006, GM-008, GM-009, SRV-001, SUP-001, OFF-005, REP-001, REP-002, REP-004, REP-005, SOC-EXT-001, QA-002.
