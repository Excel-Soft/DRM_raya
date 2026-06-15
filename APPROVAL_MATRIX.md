# Approval Matrix

Who can act on each pending stage, the status the item sits at, and the existing
endpoint the unified dashboard calls. The `/approvals` dashboard is **read-only**;
the actions below are each module's own authoritative endpoints (unchanged).

| Module | Stage (status) | Approver role(s) | Approve endpoint | Reject endpoint | Reason on reject |
| --- | --- | --- | --- | --- | --- |
| Invoice | `PENDING_HOD` | hod, super_hod, admin | `POST /api/invoices/:id/hod-approve` | `POST /api/invoices/:id/hod-reject` | required |
| Invoice | `PENDING_ACCOUNT` | account_manager, admin | `POST /api/invoices/:id/account-approve` | `POST /api/invoices/:id/account-reject` | required |
| PMS | pending project (approved invoice, no project) | product_posting_manager, software_manager, dd_manager | (project creation via existing PMS flow) | — | — |
| HR | leave `Pending` | manager / HOD (dept-scoped) | `PATCH /api/leave/:id/approve` | `PATCH /api/leave/:id/reject` | required |
| HR | overtime `Pending` | manager / HOD (dept-scoped) | `PATCH /api/overtime/:id/approve` | `PATCH /api/overtime/:id/reject` | required |
| Loan | `Pending` → manager | manager | `PATCH /api/loans/:id/manager-approve` | `PATCH /api/loans/:id/reject` | required |
| Loan | `ManagerApproved` → HOD | hod | `PATCH /api/loans/:id/hod-approve` | `PATCH /api/loans/:id/reject` | required |
| Product Posting | `QA_REVIEW` | qa_manager, admin | `POST /api/product-posting/tasks/:taskId/qa-review` `{action:"complete"}` | same endpoint `{action:"return", remarks}` | required (return) |
| Product Posting | `VERIFICATION_PENDING` | verification_manager, admin | `POST /api/product-posting/tasks/:taskId/verification-review` `{action:"complete"}` | same endpoint `{action:"return", remarks}` | required (return) |
| Software | `QA_REVIEW` | qa_manager, admin | `POST /api/software/tasks/:taskId/qa-review` `{action:"complete"}` | same endpoint `{action:"return", remarks}` | required (return) |
| Software | `VERIFICATION_PENDING` | verification_manager, admin | `POST /api/software/tasks/:taskId/verification-review` `{action:"complete"}` | same endpoint `{action:"return", remarks}` | required (return) |
| Service | complaint `open` / `in_progress` | service_manager / assignee | `PATCH /api/service/complaints/:id/resolve` | (status edits via existing complaint endpoints) | resolution remark required |

## Scoping
- Role scoping is enforced **server-side** in
  `approval-visibility.service.ts` — each adapter only returns items the actor's
  role/department may act on. The dashboard never widens visibility.
- Managers see their department/team-scoped items; HOD/Account/QA/Verification
  see their stage's queue.

## Notes
- Workflow QA/Verification use a single endpoint with an `action` body of
  `"complete"` (approve) or `"return"` (reject); the dashboard maps Approve →
  `complete` and Reject → `return` with the reason as `remarks`.
- The matrix mirrors the existing module endpoints exactly — Stage 5 added no new
  approval logic.
