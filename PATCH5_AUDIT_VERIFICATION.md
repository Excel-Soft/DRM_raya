# PATCH 5 — Audit & Status-History Verification

Confirms every state-changing GM/Sales action records an audit trail and/or status
history, and that denied attempts are not recorded as successes. Method: **CODE**
inspection of the audit services + route guards.

---

## Tables (all under schema `drm`)

| Table | Purpose | Writer |
|-------|---------|--------|
| `activity_logs` | Central audit ledger (reused to avoid schema fragmentation) | `ActivityLogService` / `AuditLogService` / `recordGmSalesAudit` |
| `workflow_status_history` | GM / invoice / project status changes | `WorkflowStatusService` |
| `cross_department_status_history` | Cross-module hand-off ledger (P14) | `CrossDepartmentStatusService` |
| `task_status_history` | Task-level status changes | `task-status-history.repository.ts` |
| `product_posting_rework_history` | PP phase changes, returns, remarks | product-posting workflow routes |

## Services

- **`ActivityLogService.log()`** — best-effort, **never throws** (safe to await on a
  mutation's critical path); a logging failure cannot roll back the business write.
- **`AuditLogService`** — delegates to `ActivityLogService`.
- **`recordGmSalesAudit({ action, entityType, entityId, before?, after?, reason?, req })`**
  — uses a **controlled set of action strings** (`GM_SALES_AUDIT_ACTIONS`), e.g.
  `gm.create`, `gm.create.unauthorized_attempt`, `invoice.hod_approve`,
  `invoice.account_approve`, `product_posting.dependency_locked`,
  `gm_sales.config_update`.
- **`CrossDepartmentStatusService`** (P14) — post-transition hook: appends to
  `cross_department_status_history`, records a cross-module event in `activity_logs`,
  and notifies the next department's real users (UUIDs).

## What gets recorded

| Event | Audited as | History table |
|-------|-----------|---------------|
| GM create (success) | `gm.create` | `activity_logs` (GM create does not write `workflow_status_history`) |
| GM create (role denied) | `gm.create.unauthorized_attempt` | `activity_logs` (attempt only) |
| Manual invoice create denied | `gm.create.unauthorized_attempt` (invoice entity) | `activity_logs` |
| Invoice HOD / Accounts approve / reject | `invoice.*` | `activity_logs` + `workflow_status_history` |
| Project generated / linked | project event | `workflow_status_history` + cross-dept ledger |
| PP dependency block | `product_posting.dependency_locked` | `activity_logs` |
| PP phase / verification change | phase event | `product_posting_rework_history` + cross-dept ledger |
| Config update | `gm_sales.config_update` | `activity_logs` |
| Any cross-module hand-off | cross-module event | `cross_department_status_history` |

## Properties verified (CODE)

1. **Every state change is recorded.** Each mutation route writes to at least one
   history table and (for GM/Sales actions) an `activity_logs` entry.
2. **Denied attempts are audited only where the guard opts in.** Guards using
   `requireGmSalesActionPermission(..., { auditUnauthorizedAttempt: true })` (GM create,
   add-partial-receipt, finalize-partial, loan-return, loan-admin-approve) and
   `requireManualInvoiceCreator()` (manual invoice) record an `*_unauthorized_attempt`
   event and return **403** — never a success row. Plain `requireRole(...)` routes
   (invoice HOD/account approve & reject, generate-project, assign-task, qa-review,
   verification-review) return **401/403 without writing an audit row**; adding denial
   auditing to these is a recommended follow-up.
3. **No false success on illegal transitions.** Because guards run **before** the write,
   a rejected transition leaves both the status and the success-audit unwritten.
4. **Actor + context captured.** Audit entries carry actor (from `req.user`), entity
   type/id, optional before/after snapshot, and reason.
5. **Audit failures never corrupt business writes.** `ActivityLogService.log()` swallows
   its own errors.

---

## Summary

The audit surface is centralised on `activity_logs` with purpose-specific history
tables for workflow, cross-department, task, and product-posting rework events.
Successful Patch 5 mutations are recorded across `activity_logs` and the relevant
history tables. **Denied-attempt** auditing currently covers the GM-create,
partial/loan and manual-invoice guards (those using `auditUnauthorizedAttempt` /
`requireManualInvoiceCreator`) — **not** the plain `requireRole` approval/assignment
routes. Full seeded end-to-end audit-row assertions, and denial auditing for the
`requireRole` routes, are recommended follow-ups before production sign-off.
