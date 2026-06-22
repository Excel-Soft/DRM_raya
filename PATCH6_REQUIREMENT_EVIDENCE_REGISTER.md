# PATCH 6 — Requirement Evidence Register (Stage 10, Section D)

Date: 2026-06-22. One row per requirement in `PATCH6_TRACEABILITY_MATRIX.md`, with the
concrete artifacts collected this stage. **Reviewer** = Stage-10 QA pass (technical
gates executed + source/code evidence + existing stage docs). **UAT result** reflects
*executed* status only — code-complete items whose live role-based browser walkthrough
was not run are marked **PENDING** (never a fabricated pass, per DoD).

Legend — UAT result: **EXEC** (executed live this stage) · **PENDING** (live UAT
outstanding) · **MGMT** (blocked on management decision).

| Req | Files / route | DB table | Validation | Permission rule | Audit / report | UAT result | Status |
|---|---|---|---|---|---|---|---|
| SEC-001 | `attributes-routes.ts`, mounted after `authMiddleware` (`routes.ts:272`) | system attributes | zod on create | `requireActionPermission` `attributes.view/create/delete`; create/delete FULL_ACCESS | `auditUnauthorizedAttempt` supported | **EXEC**: anon 401; wrong-role 403; admin/super_hod allowed | **Complete (API-permission executed)** |
| SEC-002 | `auth.service.ts:6` JWT fallback; MOCK_AUTH gate `routes.ts:109–115` | n/a | n/a | MOCK_AUTH FATAL in prod | boot fail-fast | EXEC: MOCK_AUTH prod-block verified in code; JWT_SECRET present (len 96) | **Partial** (recommend hard-fail if `JWT_SECRET` unset in prod; fallback string still present) |
| SEC-003 | `requireActionPermission`, `requireRole`, domain guards | permission matrix | per-handler | action/role guards | denied-attempt audit (where supported) | EXEC (attributes, gm.create) ; PENDING (universal mutation coverage) | **Partial** |
| VAL-001 | `account-routes.ts`, `gm-pool-routes.ts`, `service-core-routes.ts` | various | zod `parse`/`safeParse` | n/a | n/a | PENDING | **Partial** (some handlers still raw `req.body`) |
| API-001 | `gm-pool-add-gm.tsx`, `account-gm-entries.tsx`, `dd-executive-dashboard.tsx`, `salary-report.tsx`, `office-vas.tsx` | n/a | n/a | n/a | n/a | PENDING | **Partial** (some pages still raw `fetch`) |
| SQL-001 | `utils/sales-tables.ts`, `pools.repository.ts`, `gm-pool-routes.ts` | drm tables | identifier whitelist (partial) | n/a | n/a | PENDING | **Partial** (values parameterized; dynamic identifiers partially hardened) |
| INV-001 | `account-routes.ts` PATCH `/account/invoices/:id/status` | `invoices` | none on transition | none / no workflow | **no audit** | PENDING | **Open** (raw status set; route via workflow + audit) |
| INV-002 | `invoice-workflow.service.ts:186`, `invoice-routes.ts` | `productPostingInvoices` | `assertApprovalReadiness` | creator/role guard | approval audit | PENDING | **In Progress (code complete; UAT pending)** |
| INV-003 | `invoice-to-project.service.ts:419`, `invoice-routes.ts` | `projects` | idempotent find-or-create | n/a | best-effort generation | PENDING | **In Progress (code complete; UAT pending)** |
| WF-001 | `cross-department-status.service.ts`; invoice hooks | `cross_department_status_history` | n/a | n/a | status ledger rows | PENDING | **Partial** (wired for invoice/project; broader hooks TBD) |
| WF-002 | `pms-routes.ts:488` | `projects` | sensitive-field block only | role guard | n/a | PENDING | **Partial** (no full state machine) |
| GM-001..010 | `gm-create-policy.service.ts`, `gm-pool-routes.ts`, `gm_sales_workflow_config` | `gm_*` | `createSchema`, thresholds, partial/loan gates | `requireGmSalesActionPermission` | gm audit (best-effort on config) | EXEC (gm.create RBAC + service OFF) ; PENDING (per-type workflow) | **Needs Mgmt Confirmation** (thresholds, service participation, invoice timing) |
| SRV-001 | `service-core-routes.ts:464–472` (501) | n/a | n/a | n/a | honest 501 stub | MGMT | **Needs Mgmt Confirmation** (implement vs retire bridge) |
| SRV-002 | `service-core-routes.ts:74/148/344/410` | `service_*` | `service.validators.ts` (partial adoption) | per-action guard (partial) | lifecycle/comms logs | PENDING | **Partial** |
| COM-001 | `communication.service.ts`; service hooks | `communication_logs` | n/a | n/a | unified logging (fire-and-forget) | PENDING | **In Progress (code complete; logging best-effort)** |
| DOM-001 | `it-servers.tsx`, `it-assets-routes.ts` | `it_servers` | zod | role guard | persists across refresh | PENDING | **In Progress (code complete; UAT pending)** |
| DOM-002 | `it-servers.tsx` Add-Domain, `it-assets-routes.ts` | domains/registries/hosting | partial | role guard | n/a | PENDING | **Partial** (servers full; other entities partial CRUD) |
| SUP-001 | `app-sidebar.tsx`, `App.tsx`, `routes.ts` support gate, `feature-flags.ts` | (data retained) | n/a | flag gate | 404 + `SupportInactive` | **EXEC**: `/api/support/tickets`→404; CODE: nav hidden + `SupportInactive` | **Needs Mgmt Confirmation** (remove vs keep soft-disabled) |
| SOC-001 | `social-media.tsx`, `social-media-routes.ts` | `social_media_posts` | zod | role guard | dashboard metric (manual) | PENDING | **In Progress (code complete; UAT pending)** |
| OFF-001 | `office-account-routes.ts`, Chart of Accounts UI | `account_heads` | zod | financial guard | ledger/report | PENDING | **Partial→addressed** (heads live; verify UI wiring) |
| OFF-002 | Old Account Head | (redirected) | n/a | n/a | n/a | CODE-VERIFIED (removed/redirected to Chart of Accounts); UAT pending | **Addressed by redirect** (was Open; UAT pending) |
| OFF-003 | Trial Balance (`office-trial-balance`) | ledger/heads | compute endpoint (de-mocked) | financial guard | balanced TB | PENDING | **Addressed** (live compute; was Open) — UAT pending |
| OFF-004 | `office-expenses.tsx`, `office-account-routes.ts` | `office_expenses` | zod | financial guard | expense report | PENDING | **Partial** (UI error-state polish; UAT pending) |
| OFF-005 | `office-vas.tsx`, `office-account-routes.ts` | derived from `invoices` | n/a | financial guard | VAS view | MGMT | **Partial / Needs Mgmt Confirmation** (VAS source rule) |
| OFF-006 | all office pages | drm office tables | mixed | financial guard | audit/closure | PENDING | **Partial** |
| REP-001 | `reports-raw-attendance.tsx`, `stage3-reports-routes.ts` | `attendance` | scope filter | `requireReportPermission` | export parity (verified) | MGMT | **Needs Mgmt Confirmation** (source of truth) |
| REP-002 | `salary-create.tsx`, `salary-routes.ts` | salary tables | zod + lifecycle locks | report guard | finalize lock + audit | MGMT | **Needs Mgmt Confirmation** (formula/freeze) |
| REP-003 | `reports-event.tsx`, `reports-reception.tsx`, `stage3-reports-routes.ts` | `meetings`/events | scope filter | report guard | export parity | PENDING | **In Progress (code complete; UAT pending)** |
| REP-004 | `reports-day-target.tsx`, `reports-routes.ts` | day-target source | KPI formula | report guard | export parity | MGMT | **Needs Mgmt Confirmation** (Approved-only basis) |
| REP-005 | `bv-report-new.tsx`, `reports-routes.ts` | `bv_reports` | legacy filters →400 | report guard | metrics | MGMT | **Needs Mgmt Confirmation** (migration) |
| PEN-001 | `drm/add-penalty.tsx`, `penalty-routes.ts` | penalty tables | zod + decision validation | handler `canCreate/canDecide` | penalty audit | PENDING | **In Progress (code complete; UAT pending)** |
| QA-001 | build/test pipeline | n/a | n/a | n/a | gate logs | EXEC (build/check/tests green) ; PENDING (browser UAT) | **Partial** (gates pass; role-based UAT pending) |
| QA-002 | this register + DoD | n/a | n/a | n/a | evidence attached | EXEC (evidence collected) | **In Progress** |

## Evidence sources (artifacts)
- Technical gates: `PATCH6_BUILD_TYPECHECK_REPORT.md`, `/tmp/p6_{ci,check,build,test}.log`.
- Executed permission tests: `PATCH6_ROLE_BASED_UAT_MATRIX.md` §E1/E2.
- Scenario evidence: `PATCH6_FINAL_QA_SCENARIOS.md`.
- Supporting design docs: GM/INVOICE/LOAN/PARTIAL/PRODUCT_POSTING/SERVICE/REPORT/OFFICE
  state-machine and rule docs; `PATCH6_*` stage changelogs and matrices.
