# PATCH 7 — MANAGEMENT CONFIRMATION REQUIRED

**Stage:** Patch 7 — Stage 0. **Date:** 2026-06-29.
**Status of all items below: PENDING.** Each is currently running on a coded
**default**; the default is *not* an approved policy. No business-rule requirement
can be marked Complete until its confirmation is recorded here (authority + date).

> These consolidate the open management decisions across Patch 1–6. Patch 5's 7
> confirmations (`PATCH5_MANAGEMENT_CONFIRMATION_STATUS.md`) are a subset and remain
> PENDING.

---

**Reading the "Affects" column:** each entry tags the requirement with its current
matrix status. **(NMC)** = the requirement's status is *gated/blocked* by this
decision; **(other status)** = the decision *influences* the requirement (e.g. its
final value or UAT outcome) but the requirement is not itself NMC-blocked. Only
**(NMC)**-tagged IDs are status-blocked by the decision.

| # | Decision required | Affects (ID · matrix status) | Current default in code | Status |
|---|---|---|---|---|
| 1 | **GM/Sales payment thresholds** by package and GM type (Full/Partial/Loan) | GM-003 (NMC); influences GM-002 (In Progress) | `validateMinimumPaymentThreshold` with empty `{}` (no enforced minimum) | PENDING |
| 2 | **Service Executive GM creation** permission | GM-001 (NMC), GM-009 (NMC), SRV-001 (NMC) | Denied (Service-GM OFF; only admin/super_hod/sales_executive) | PENDING |
| 3 | **Service Executive manual invoice** permission | SRV-001 (NMC); influences INV-002 (In Progress) | Denied (`requireManualInvoiceCreator`) | PENDING |
| 4 | **Invoice generation timing** (on GM creation vs on approval) | GM-008 (NMC); influences GM-007 (In Progress) | `ON_GM_CREATION` | PENDING |
| 5 | **Product Posting Listing-Page QA dependency** (block assignment until QA done) | QA-002 (NMC); influences QA-001 (Partial) | `assertProductPostingDependencySatisfied` default false (not enforced) | PENDING |
| 6 | **Verification Manager final-stage rule** (required after QA?) | influences QA-001 (Partial) | Required = true (default) | PENDING |
| 7 | **Project initial status after invoice approval** (Active vs Docs Pending) | influences INV-003 (In Progress), GM-010 (Partial) | `ACTIVE` | PENDING |
| 8 | **Salary formula / freeze / finalization** policy | REP-004 (NMC) | Coded formula, not signed off; no freeze policy | PENDING |
| 9 | **BV metric formulas** and legacy migration/backfill policy | REP-002 (NMC); influences GM-010 (Partial) | Coded formula, no backfill policy | PENDING |
| 10 | **Report ownership** between Reports module and Accounts Office | REP-001 (NMC), REP-005 (NMC); influences OFF-004 (Partial) | Ambiguous (both surfaces) | PENDING |
| 11 | **Service → GM / VAS / BV bridge** decision (which bridges are live) | SRV-001 (NMC), OFF-005 (NMC) | Bridge present; Service-GM OFF | PENDING |
| 12 | **Support module deactivation** decision (remove vs retain) | SUP-001 (NMC) | Deactivated (`/api/support`→404), table retained | PENDING |
| 13 | **Office Accounts retained vs removed submodules** (incl. legacy account-head pages) | OFF-005 (NMC); influences OFF-002 (Addressed-by-redirect), ACC-LEGACY-001 (Partial) | Legacy pages redirect to Chart of Accounts; dead files retained (no-delete policy) | PENDING |
| 14 | **Social Media external provider publishing** scope (internal-only vs external APIs) | SOC-EXT-001 (NMC); influences SOC-001 (In Progress) | Internal/manual only; no external integration | PENDING |
| 15 | **Patch 5 implementation evidence package** acceptance (accept AUTO+CODE, or require browser UAT + code-diff) | influences P5-001 (Partial), P5-PEN-001 (In Progress), UAT-004 (Open) | Code+180 AUTO tests present; browser UAT MANUAL-PENDING | PENDING |

---

### How to record a confirmation
For each item, capture: **decision**, **confirming authority/role**, **date**, and
the **value** (e.g. threshold table, formula). Once recorded, update the linked
requirement IDs in `PATCH7_TRACEABILITY_MATRIX.md` from **NMC** to the appropriate
build status and assign to the relevant sprint.
