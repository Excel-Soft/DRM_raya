# PATCH 7 — Action Permission Matrix (SEC-003)

_Last updated: 2026-06-29 (Patch 7 Stage 1)._

This matrix documents the action-level RBAC model as it actually exists, the
permission keys, and how each module is guarded. A central Stage-1 principle:
**do not double-guard.** Several modules deliberately use dedicated, purpose-built
guards; adding generic keys on top would risk role-map drift and could weaken
existing rules. This document records that coverage rather than duplicating it.

## 1. The unified guard

`server/middleware/action-permission.ts` exports:

```ts
requireActionPermission(actionKey, options = {})
```

- Looks up the policy in `ACTION_PERMISSIONS[actionKey]`
  (`server/config/action-permissions.ts`).
- **Merges explicit `options` over the registry policy (options win):**
  `roles`, `allowRole` (role predicate), `adminOverride`, `auditDenied`,
  `auditEntityType`, `module`, `message`.
- `predicate` (ownership / department / status / stage check) is **code-only** —
  never sourced from the registry — so context checks live next to the handler.
- Returns **401** for anonymous (auth middleware runs first) and **403** with a
  safe message for an authenticated-but-unauthorized caller. Optional
  `auditDenied` records the denial.

Because options override the registry, a route can use an action key that is
**not** in the static registry by supplying inline config. This is intentional and
keeps least-privilege the default.

## 2. Static registry keys (18)

From `server/config/action-permissions.ts`:

| Module | Keys |
| --- | --- |
| Attributes | `attributes.view`, `attributes.create`, `attributes.update`*, `attributes.delete` |
| Invoice | `invoice.update_status`, `invoice.update`, `invoice.delete` |
| Service follow-up | `service.followup.create`, `service.followup.complete` |
| Service complaint | `service.complaint.create`, `service.complaint.update`, `service.complaint.assign`, `service.complaint.resolve`, `service.complaint.close`, `service.complaint.reopen` |
| Service dropout | `service.dropout.create`, `service.dropout.recover` |
| Service renewal | `service.renewal.create` |

\* `attributes.update` was added in Patch 7 Stage 1. No update endpoint currently
exists for attributes, so the key is registered for completeness/forward use; it
does not introduce a new route or alter any workflow.

## 3. Inline-configured keys (not in the static registry)

These routes call `requireActionPermission("<key>", { allowRole, message, ... })`
with the policy supplied inline. They are part of the **same** unified system.

| Module | Route(s) | Key | Role gate |
| --- | --- | --- | --- |
| Loan | manager-approve / hod-approve / reject / complete / pay-installment | `loan.*` | `isManagerialRole` / `isHodAllowed` |
| Overtime | approve / reject | `overtime.approve` / `overtime.reject` | `isManagerialRole` |
| Leave | approve / reject | `leave.approve` / `leave.reject` | `isManagerialRole` |
| Attendance | correction | `attendance:correction` | correction guard |
| Users | manage | `user.manage` | user-admin guard |
| DRM permissions | manage | `drm.permissions.manage` | permission-admin guard |

## 4. Dedicated-guard modules (wrappers over the same primitive)

| Module | Guard | Mechanism |
| --- | --- | --- |
| Office / finance | `requireFinancialPermission` (`server/middleware/financial-permission.ts`) | builds `finance:${actionKey}` and delegates to `requireActionPermission` |
| Reports | `requireReportPermission` (`server/middleware/report-permission.ts`) | builds `report:${reportKey}:${action}` and delegates to `requireActionPermission` |
| GM sales | `requireGmSalesActionPermission` (gm-pool routes) | dedicated GM role/scope guard + `gm-sales-audit` |
| Penalty | handler-level 403 checks (`server/penalty-routes.ts`) | per-handler role + cross-scope checks (lines ~65–330): list/report/view/create/penalize/edit/assign/decide |

These are **intentionally not** re-keyed in the generic registry — doing so would
double-guard and risk diverging from their existing role maps.

## 5. PMS access control (closed in Patch 7 Stage 1)

The genuine P0 gap this sprint closed: PMS task mutations and approval decisions
had no ownership/role check on the non-status paths.

| Route | New guard |
| --- | --- |
| `PUT /api/pms/tasks/:id` (non-status update) | `canManageTask` — owner / assignee / manager, else **403** |
| `PATCH /api/pms/tasks/:id` (non-status update) | `canManageTask` — owner / assignee / manager, else **403** |
| `POST /api/pms/approvals/:id/approve` | `canDecideApproval` — managerial or designated approver, else **403** (applied to active **and** the shadowed duplicate handler) |
| `POST /api/pms/approvals/:id/reject` | `canDecideApproval` — same |

The status-change path (which already enforced owner rules) is unchanged. Guards
mirror the existing project-edit ownership pattern in the same file.

## 6. Enforcement summary

- **Anonymous → 401** (verified by smoke probes on `/api/attributes`, guarded PMS
  task `PUT`, approvals approve).
- **Authenticated but unauthorized → 403** with a safe message.
- **Authorized (role/owner/manager/admin-override) → allowed.**
- No rule was weakened; no module was double-guarded.
