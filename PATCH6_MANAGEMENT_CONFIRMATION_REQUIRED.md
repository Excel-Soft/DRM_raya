# PATCH 6 — Management Confirmation Required

These business-rule decisions block closure of their dependent requirements. Defaults in
code currently preserve existing behaviour; **no code will change** until management
confirms. Each item lists the decision, where it bites, and the current default.

## A. GM / Sales thresholds & Service participation (GM-001..010, SRV-001)
- **Decide:** minimum-payment thresholds by GM type/package; whether Service roles may
  initiate GM/VAS/BV.
- **Affects:** `gm-create-policy.service.ts`, `gm_sales_workflow_config`, service bridge.
- **Current default:** thresholds empty (not enforced); Service→GM/VAS/BV bridge returns
  501 (no Service participation). Carried over from Patch 5 pending list.

## B. Invoice generation timing (GM/INV)
- **Decide:** generate the 3 default invoices at **GM creation** or **after final GM
  approval**.
- **Affects:** `gmInvoiceGenerationTiming` config; `invoice-to-project`/GM flow.
- **Current default:** `ON_GM_CREATION`.

## C. Product Posting → Listing-Page QA dependency (WF/PP)
- **Decide:** must Product Posting always wait for linked Listing-Page QA approval?
- **Affects:** `requireProductPostingWaitForListingQa`; PP assign-task gate (409
  `LISTING_QA_PENDING`).
- **Current default:** dependency **off**.

## D. Verification Manager final-stage rule (WF/PP)
- **Decide:** is Verification Manager a **required** final stage uniformly across
  departments?
- **Affects:** `verificationManagerRequiredAfterQa`; verification lifecycle labels.
- **Current default:** required = **true** (labels only; transition logic unchanged).

## E. Salary formula / freeze / finalization (REP-002)
- **Decide:** confirm `perDaySalary = basicSalary / 30`, the **no late-penalty** policy,
  and that **FINALIZED** locks the run irreversibly.
- **Affects:** `salary-routes.ts` `computeSalaryLine` (lines ~192/196), lifecycle
  `ALLOWED_NEXT`.
- **Current default:** `/30` basis, no late penalty, finalize locks.

## F. BV metric formula & legacy migration (REP-005)
- **Decide:** confirm BV metric definitions and that **legacy `package`/`method`
  filters are permanently retired**.
- **Affects:** `reports-routes.ts` BV report; legacy filters rejected with 400.
- **Current default:** legacy filters rejected.

## G. Report ownership: Reports vs Accounts Office (REP / OFF)
- **Decide:** which module owns overlapping financial reports (e.g. expenses, VAS, trial
  balance) — Reports or Office Accounts.
- **Affects:** routing/duplication between `reports-routes.ts` and
  `office-account-routes.ts`.
- **Current default:** both exist independently.

## H. Service → GM / VAS / BV bridge decision (SRV-001)
- **Decide:** **implement** the bridge (persisted handoff) or **formally retire** it.
- **Affects:** `service-core-routes.ts` 501 endpoints + stub reports.
- **Current default:** 501 Not Implemented (honest stub, no silent success).

## I. Support module deactivation (SUP-001)
- **Decide:** fully **remove** Support (UI + routes) or keep it **soft-disabled** behind
  `SUPPORT_MODULE_ENABLED`.
- **Affects:** `app-sidebar.tsx`, `App.tsx`, `routes.ts` Support gate.
- **Current default:** soft-disabled (404 + `SupportInactive` unless flag set).

## J. Office Accounts: retained vs removed submodules (OFF-001..006)
- **Decide:** keep and complete vs remove — **Old Account Head** (stub), **Trial
  Balance** (stub), **Office VAS** (invoice-derived read-only); and confirm the **VAS
  source rule** ("paid, non-Alibaba invoices").
- **Affects:** `office-old-account-head.tsx`, `office-trial-balance.tsx`,
  `office-vas.tsx`, `office-account-routes.ts`.
- **Current default:** stubs present; VAS = paid non-Alibaba invoices.

## K. Daily Target achievement basis (REP-004)
- **Decide:** does "achievement" count only **Approved** GMs?
- **Affects:** `reports-routes.ts` day-target computation.
- **Current default:** Approved-only.

## L. Raw Attendance source of truth (REP-001)
- **Decide:** confirm `drm.attendance` is the **sole** source (vs biometric import).
- **Affects:** `stage3-reports-routes.ts` raw attendance.
- **Current default:** `drm.attendance` only.

---

**Note:** Items **A–F, K, L** are config/flag-backed — the keys already exist, so applying
a management decision needs **no code change** (only the decision itself). Items **H
(service bridge), I (Support removal), J (Office Accounts completion/removal)** are
different: depending on the decision, they may require implementation or removal work in a
later stage. Items A–D carry over from Patch 5's still-unresolved pending list.
