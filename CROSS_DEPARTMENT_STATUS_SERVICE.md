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

## Patch 7 Stage 3 — spec-named public API + three new ledger hooks

Stage 3 made the service honour the Patch-7 hook names **without** changing any
existing behaviour. Three things were added to
`server/services/cross-department-status.service.ts`; nothing was removed or
rewritten, and the core `record()` writer (event-key dedupe, best-effort,
never-throws, never mutates business status) is unchanged.

### 1. Three genuinely-new best-effort ledger hooks

| Hook | Hand-off recorded | Wired at |
|------|-------------------|----------|
| `onGmApproved` | GM final-approved (SALES) → ACCOUNTS/invoicing | `server/gm-pool-routes.ts` — account-manager-approve, sales-manager-approve (both-managers branch), super-hod-approve, each after the committed update + inline notify. |
| `onInvoiceCreated` | invoice auto-generated (SALES/GM) → HOD review | `server/services/gm-invoice-generation.service.ts` — one call per created invoice in the post-insert audit loop (the single GM→invoice chokepoint). |
| `onPmsTaskAssigned` | PMS task assigned → execution dept | `server/routes/product-posting-workflow-routes.ts` and `server/routes/software-workflow-routes.ts` — assign-task, after the assignee notify. |

All three are wired with `notify: false` (the originating routes already notify
the next actor inline) and `actorUserId` set to the acting user, so they record
the ledger row + cross-department audit event only. Repeats are no-ops via the
`event_key` (`${sourceModule}:${entityId}:${action}:${toStatus}`).

### 2. Spec-name delegates over existing hooks (no behaviour change)

The spec names below map 1:1 onto hooks that already existed; they are thin
delegates that forward their args unchanged:

| Spec name | Delegates to |
|-----------|--------------|
| `onHodInvoiceApproved` | `onInvoiceHodApproved` |
| `onAccountInvoiceApproved` | `onInvoiceAccountApproved` |
| `onDepartmentManagerCompleted` | `onWorkflowManagerCompleted` |
| `onQaApproved` | `onWorkflowQaCompleted` |
| `onVerificationCompleted` | `onWorkflowVerificationCompleted` |
| `onServiceStatusChanged` | generalises `onServiceComplaintRaised` to any status |

Existing call sites continue to call the original method names and are
unaffected.
