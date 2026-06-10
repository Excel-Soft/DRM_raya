---
name: Penalty void = second lifecycle dimension
description: Why penalties carry a status (ACTIVE/VOIDED) column separate from approval_status, and the invariants any penalty change must keep.
---

A penalty row has **two independent dimensions** that must never be collapsed:

- `approval_status` — the decision: `PENDING → APPROVED | REJECTED`.
- `status` — the lifecycle: `ACTIVE | VOIDED`.

**Why:** a void must reverse a penalty's effect (money totals, employee
increment/performance integration) **without destroying the original approval
decision**, so history stays auditable. Overloading `approval_status` with a
"VOIDED" value would have erased who approved it and when.

**How to apply (invariants to preserve on any penalty work):**
- Always read the lifecycle as `coalesce(status,'ACTIVE')` — pre-migration rows
  have NULL status and must behave as ACTIVE in selects, summaries, and the void
  compare-and-set predicate.
- Void is compare-and-set (`coalesce(status,'ACTIVE') <> 'VOIDED'`); a no-op
  returns null at the service layer and the route maps that to **409**.
- Money/decision aggregates (list summary counts + totalAmount, monthlyReport
  money totals, getPenaltySummaryForEmployee) **exclude VOIDED**; but voided rows
  stay **visible** in list/report `records` (with status) for the audit trail.
- VOIDED rows must 409 on approve/reject/edit/acknowledge/delete. The edit path
  is safe because updatePenalty whitelists columns — neither `status` nor
  `approval_status` is writable, so edit can't be used as a void/approve bypass.
- Void authority mirrors approve/reject (full-access + HOD, dept-scoped via
  canViewEmployee); `canVoid` is surfaced in `/api/penalties/meta`.
- `client/src/pages/drm/service-add-penalty.tsx` shares the same `/api/penalties`
  engine but was intentionally left without void UI — its summary semantics
  silently changed (voided now excluded). Future UI-parity work lives there.
