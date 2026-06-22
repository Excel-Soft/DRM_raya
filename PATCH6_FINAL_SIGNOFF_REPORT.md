# PATCH 6 — Final Sign-off Report (Stage 10, Section E)

Date: 2026-06-22. Governance sign-off per requirement, applying the
`PATCH6_DEFINITION_OF_DONE.md` rules. **No requirement is marked Complete without the
full set of applicable DoD artifacts.** Code-complete items lacking live role-based UAT
remain **In Progress / Partial**; business-rule items remain **Needs Management
Confirmation**. Unexecuted UAT = PENDING (never a fabricated pass).

**Reviewer signoff** below = Stage-10 QA (automated gates + code/source evidence). It is
**not** a substitute for the management business-rule confirmations or the live
role-based browser UAT, both of which remain outstanding where noted.

## Status definitions
Complete · Partial · Open · Blocked · Needs Management Confirmation.

## Sign-off table

| Req | Status | Implementation evidence | QA evidence | Mgmt confirmation | Reviewer | Remaining risk |
|---|---|---|---|---|---|---|
| SEC-001 | **Complete** (API-permission) | attributes mounted after global auth; `requireActionPermission` create/delete = FULL_ACCESS | **EXEC**: anon 401 + wrong-role 403 + admin/super_hod allowed | — | QA ✓ | Low — covered by automated permission test |
| SEC-002 | **Partial** | MOCK_AUTH prod-block (FATAL); JWT secret from env | MOCK_AUTH gate verified; JWT_SECRET present | — | QA ✓ | Med — `auth.service` still has dev fallback string; add prod fail-fast if unset |
| SEC-003 | **Partial** | action/role/domain guards exist | EXEC for attributes+gm.create; not universal | — | QA ✓ | Med — confirm every mutation has an action guard |
| VAL-001 | **Partial** | zod on many handlers | PENDING | — | QA ✓ | Med — some raw `req.body` inserts remain |
| API-001 | **Partial** | shared `apiRequest` adopted widely | PENDING | — | QA ✓ | Low — a few pages still raw `fetch` |
| SQL-001 | **Partial** | parameterized values | PENDING | — | QA ✓ | Med — dynamic identifier whitelisting incomplete |
| INV-001 | **Open** | raw status PATCH, no workflow/audit | — | — | QA ✗ | **High** — illegal/unaudited status transitions possible |
| INV-002 | **In Progress** (code complete) | `assertApprovalReadiness` + creator guard | PENDING (role UAT) | — | QA ✓ (code) | Med — needs live denial/approval UAT |
| INV-003 | **In Progress** (code complete) | idempotent project create/link (`uq_projects_invoice_root`) | PENDING | — | QA ✓ (code) | Med — best-effort: approval not blocked if generation fails |
| WF-001 | **Partial** | cross-dept ledger for invoice/project | PENDING | — | QA ✓ | Med — broaden hooks (PMS/service/software) |
| WF-002 | **Partial** | sensitive-field block | PENDING | — | QA ✓ | Med — no formal PMS state machine |
| GM-001..010 | **Needs Mgmt Confirmation** | type routing, partial/loan gates, thresholds (config) | EXEC: gm.create RBAC + Service OFF; PENDING per-type | **A, B** (thresholds, invoice timing, service participation) | QA ✓ (code) | Med — values empty pending mgmt |
| SRV-001 | **Needs Mgmt Confirmation** | honest 501 bridge stubs | — | **H** (implement vs retire) | QA ✓ | Med — feature absent by decision |
| SRV-002 | **Partial** | validators exist, partial adoption | PENDING | — | QA ✓ | Med — enforce zod + guard on all service writes |
| COM-001 | **In Progress** (code complete) | unified comms logging | PENDING | — | QA ✓ (code) | Low — logging is fire-and-forget (observability) |
| DOM-001 | **In Progress** (code complete) | server-names CRUD persists | PENDING | — | QA ✓ (code) | Low — needs UAT record |
| DOM-002 | **Partial** | servers full; others partial | PENDING | — | QA ✓ | Med — finish CRUD + Add-Domain wiring |
| SUP-001 | **Needs Mgmt Confirmation** | flag-gated; 404 + `SupportInactive` | **EXEC**: `/api/support/tickets`→404; CODE: nav hidden + `SupportInactive` | **I** (remove vs keep) | QA ✓ | Low — disabled cleanly; decide final disposition |
| SOC-001 | **In Progress** (code complete) | persisted posting lifecycle | PENDING | — | QA ✓ (code) | Low — manual/internal only by design |
| OFF-001 | **Partial** | heads API live | PENDING | — | QA ✓ | Low — verify UI wired to API |
| OFF-002 | **Addressed by redirect** | Old Account Head removed → Chart of Accounts | CODE-VERIFIED; redirect UAT pending | — | QA ✓ | Low — was Open; superseded |
| OFF-003 | **Partial** (addressed) | Trial Balance live compute (de-mocked) | PENDING | — | QA ✓ | Low — needs balanced-TB UAT |
| OFF-004 | **Partial** | expense CRUD live | PENDING | — | QA ✓ | Low — error-state polish |
| OFF-005 | **Needs Mgmt Confirmation** | invoice-derived VAS view | — | **J** (VAS source rule) | QA ✓ | Low |
| OFF-006 | **Partial** | infra solid; UI gaps | PENDING | — | QA ✓ | Low |
| REP-001 | **Needs Mgmt Confirmation** | raw attendance + parity | parity verified | **L** (source) | QA ✓ | Low |
| REP-002 | **Needs Mgmt Confirmation** | salary formula + finalize lock | finalize-lock code | **E** (formula/freeze) | QA ✓ | **High** — payroll correctness needs sign-off |
| REP-003 | **In Progress** (code complete) | event/reception scope+export | PENDING | — | QA ✓ (code) | Low |
| REP-004 | **Needs Mgmt Confirmation** | day-target KPI | parity verified | **K** (Approved-only) | QA ✓ | Low |
| REP-005 | **Needs Mgmt Confirmation** | BV metrics; legacy→400 | code | **F** (migration) | QA ✓ | Low |
| PEN-001 | **In Progress** (code complete) | penalty validation + RBAC | PENDING | — | QA ✓ (code) | Low |
| QA-001 | **Partial** | build/check/test green | EXEC gates; PENDING browser UAT | — | QA ✓ | Med — role-based browser UAT pending |
| QA-002 | **In Progress** | evidence register produced | EXEC | — | QA ✓ | Low |

## Sign-off summary
- **Complete:** 1 (SEC-001 — API-permission layer, executed).
- **Open:** 1 (INV-001 — raw invoice status route; **highest-risk** item).
- **Partial:** 12 (SEC-002/003, VAL-001, API-001, SQL-001, WF-001/002, SRV-002,
  DOM-002, OFF-001/004/006, QA-001) + OFF-003 (addressed/partial).
- **In Progress (code complete; UAT pending):** 8 (INV-002/003, COM-001, DOM-001,
  SOC-001, REP-003, PEN-001, QA-002).
- **Needs Management Confirmation:** 8 requirement entries (GM-001..010, SRV-001,
  SUP-001, OFF-005, REP-001/002/004/005), gated by the **12 management decision items
  (A–L)** in `PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`.
- **Addressed by redirect (UAT pending):** OFF-002.

**Only SEC-001 has its closure criteria met (API-permission, executed); no requirement
meets the *full* DoD** (live role-based browser UAT and/or management confirmation
outstanding). **Highest residual risks:** INV-001 (Open), REP-002 (payroll formula
sign-off), GM thresholds (mgmt).
