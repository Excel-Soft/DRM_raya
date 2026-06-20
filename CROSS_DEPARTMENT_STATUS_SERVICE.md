# Cross-Department Status Service

> **Status: service pre-existing; reconciliation endpoint added in Patch 6 Stage 4.**

## CrossDepartmentStatusService (pre-existing)

`server/services/cross-department-status.service.ts` is the central, post-commit
hook that keeps departments in sync after a workflow-critical change. It is
invoked **after** a successful state change (it is intentionally best-effort and
non-transactional — a failure here must never roll back the committed business
change) and it:

- records the cross-department event into the activity/audit ledger
  (`drm.activity_logs` via `AuditLogService`);
- notifies the receiving department/role via `NotificationService`
  (roles are resolved to active user UUIDs);
- propagates the official status so downstream dashboards/reports read a stored
  value rather than re-deriving it.

Stage 4 **kept this service as-is.** Individual modules continue to call it on
their handoffs; they do not duplicate its ledger/notify logic.

See `CROSS_DEPARTMENT_FLOW.md` for the end-to-end handoff map and
`PRODUCT_SOFTWARE_QA_VERIFICATION_STATE_MACHINE.md` for the QA/verification chain.

## Reconciliation endpoint (new in Stage 4)

The service above keeps state *moving forward*; it cannot retroactively detect
records that drifted (e.g. an approved invoice whose project was never created, or
a project stuck `OnHold` after its dependency cleared). Stage 4 adds a read-only
report for exactly that:

```
GET /api/workflow/reconciliation        (admin / super_hod / super_admin)
```

It is documented in full in `WORKFLOW_RECONCILIATION_REPORT.md`. It is
100% read-only, role-gated, and honest (real offending rows or nothing — never
fabricated). It complements the existing financial reconciliation
(`GET /api/reports/gm-bv-reconciliation`) by surfacing **workflow** drift rather
than **money** drift.
