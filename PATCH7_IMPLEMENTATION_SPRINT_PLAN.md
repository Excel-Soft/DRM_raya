# PATCH 7 — IMPLEMENTATION SPRINT PLAN

**Stage:** Patch 7 — Stage 0 (planning only; no implementation performed).
**Date:** 2026-06-29.
Order follows the Patch 7 recommended sequence. Each sprint lists requirements
covered, likely files changed, DB/migration expectations, QA evidence required,
and management confirmations needed. **DB note for every sprint:** `db:push` is
broken (FK mismatch) — apply any schema change via runtime ensure DDL
(`server/db/ensure.ts`, `CREATE/ALTER ... IF NOT EXISTS`) or reviewed psql, never
`db:push`; no destructive operations.

---

## Sprint 1 — P0 Security & Validation Closure
- **Requirements:** SEC-001, SEC-002, SEC-003, VAL-001, SQL-001, API-001, DB-001 (assessment).
- **Likely files:** `server/routes.ts`, `server/middleware/action-permission.ts`,
  `server/config/validate-secrets.ts`, `server/auth.middleware.ts`, the 3 repos with
  `sql.raw` (`project-financials`, `tasks`, `projects`), zod DTO modules, the 34
  client files using raw `fetch`, `client/src/lib/queryClient.ts`.
- **DB/migration:** none expected (audit/guard work). Confirm `drm` parity only.
- **QA evidence:** per-endpoint RBAC census; LIVE anon→401 / wrong-role→403 sweep;
  LIVE invalid-body→400; inspection note for each `sql.raw` site (identifier-safe);
  re-run `npm test`.
- **Management confirmations:** none blocking (security closure is policy-neutral).

## Sprint 2 — Invoice / GM / Sales Workflow Closure
- **Requirements:** INV-001 (close Open), INV-002, INV-003, GM-001..GM-010, WF-001.
- **Likely files:** `server/account-routes.ts` (route raw status → state machine),
  `server/services/invoice-workflow.service.ts`, `server/gm-pool-routes.ts`,
  `server/gm-bv-pool-routes.ts`, `server/sales-routes.ts`,
  `CrossDepartmentStatusService`.
- **DB/migration:** verify `drm.gm_partial_receipts`, `drm.gm_loan_terms`,
  `uq_projects_invoice_root`; add columns via ensure DDL only if needed.
- **QA evidence:** LIVE raw-status-jump→blocked/audited; UAT approve-incomplete→block;
  UAT approve-twice→single project; UAT create each GM type; UAT finalize underpaid/
  unapproved loan→block/409.
- **Management confirmations:** #1 thresholds, #2 service-exec GM, #3 service-exec
  invoice, #4 invoice timing, #7 project initial status.

## Sprint 3 — Service & Communication Closure
- **Requirements:** SRV-001, SRV-002, COM-001, SOC-001, SOC-EXT-001, SUP-001, WF-001 (downstream).
- **Likely files:** `server/service-core-routes.ts`,
  `server/service-manager-routes.ts`, comms routes, `server/social-media-routes.ts`,
  Support guard (`server/routes.ts:100`), service/social/support client pages.
- **DB/migration:** confirm `drm.social_media_posts`, `drm.support_tickets`; ensure
  DDL only if a column is missing.
- **QA evidence:** UAT service lifecycle (followup/complaint/dropout/renewal)
  persisted+audited; UAT social approval+publishing state machine; LIVE
  `/api/support`→404.
- **Management confirmations:** #11 service bridge, #12 Support deactivation,
  #14 social external scope, #2 service-exec GM (bridge dependency).

## Sprint 4 — Office Accounts & Domain Closure
- **Requirements:** OFF-001..OFF-006, ACC-LEGACY-001, DOM-001, DOM-002.
- **Likely files:** `server/office-account-routes.ts`, `server/it-assets-routes.ts`,
  `client/src/pages/office-*` (chart-of-accounts, trial-balance, expenses,
  general-ledger, VAS, legacy redirects), `it-servers.tsx`,
  `client/src/App.tsx`, `route-registry.ts`.
- **DB/migration:** confirm `drm.account_heads`, `drm.office_expenses`, domain/server
  tables; ensure DDL only if needed.
- **QA evidence:** UAT account-head/expense/ledger CRUD persisted+audited; UAT
  trial-balance reconciliation; UAT legacy routes→redirect; add AlertDialog confirms
  for destructive ops.
- **Management confirmations:** #5 VAS source, #10 report ownership, #13 retained-vs-
  removed submodules (incl. legacy dead-file removal decision).

## Sprint 5 — Reports & Patch 1 QA Closure
- **Requirements:** REP-001..REP-005, REP-003 (export parity), GM-010, PEN-001,
  P5-PEN-001, QA-001, QA-002, AUD-001.
- **Likely files:** `server/reports-routes.ts`, `server/gm-bv-pool-routes.ts`,
  hod/salary routes, penalty routes, `server/routes/product-posting-workflow-routes.ts`,
  `server/services/audit-log.service.ts`, legacy `ActivityLogService` call sites
  (notice/events/HR), report client pages.
- **DB/migration:** none expected beyond verification; any backfill (BV metrics) is
  a reviewed, non-destructive data task pending management policy.
- **QA evidence:** UAT export-vs-screen parity; UAT penalty calc; UAT product-posting
  QA dependency gate; audit rows with before/after for migrated legacy logs.
- **Management confirmations:** #8 salary formula/freeze, #9 BV formulas/backfill,
  #10 report ownership, #6 verification-manager rule, #5 listing-page QA dependency.

## Sprint 6 — UAT, Governance & Release Readiness
- **Requirements:** UAT-004, P5-001, PROD-001, UI-001, DB-001 (resolution), plus
  sign-off of all preceding In-Progress items.
- **Likely files:** `client/src/pages/it-manager-dashboard.tsx` (wire mock data or
  mark honestly), UI-state gaps, `feature-flags.ts`, deployment config; no business
  logic changes expected at this stage.
- **DB/migration:** decide FK fix to restore `db:push` (reviewed, non-destructive);
  production schema parity verification.
- **QA evidence:** **executed role-based browser UAT for every role** (the UAT-004 /
  P5-001 gap); `npm audit` triage; bundle-size action or accepted advisory; full
  `check`/`build`/`test` green; production boot drills (weak/missing secret→exit,
  MOCK_AUTH+prod→fatal).
- **Management confirmations:** #15 Patch 5 evidence acceptance; final sign-off of
  all items #1–#14 carried from earlier sprints.

---

### Cross-sprint dependencies
- INV-001 (Sprint 2) blocks honest invoice UAT in Sprint 6.
- Management confirmations #1–#7 (Sprints 2–4) block Complete status for the GM/
  invoice/accounts business-rule items regardless of code readiness.
- UAT-004 (Sprint 6) is the gate that converts In-Progress code-complete items to
  Complete; it cannot start until Sprints 2–5 land their flows.
