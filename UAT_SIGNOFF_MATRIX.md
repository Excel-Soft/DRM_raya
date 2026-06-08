# UAT Sign-off Matrix — Stage 10 (Task H)

Tester worksheet for User Acceptance Testing. Fill **Tested by** / **Status** /
**Notes** per row. Status = ✅ Pass · ❌ Fail · ⏳ Pending · ⚠️ Pass-with-notes.

Run the API smoke first (`npm test`) and use `scripts/manual-smoke-test.md` +
`PERMISSION_MATRIX_QA.md` alongside this matrix.

| Module | Scenario | Role | Route | Expected result | Tested by | Status | Notes |
|---|---|---|---|---|---|---|---|
| Auth/RBAC | Valid login | any | `/login` | Redirect to role dashboard, token issued | | ⏳ | |
| Auth/RBAC | Invalid credentials | any | `/api/auth/login` | 401 sanitized envelope, no 500 | | ⏳ | |
| Auth/RBAC | Invalid/expired token | any | any protected | Redirect to login | | ⏳ | |
| Auth/RBAC | Unauthorized route via URL | low-priv | admin-only URL | Blocked / redirected, no data leak | | ⏳ | |
| Navigation | Sidebar item opens route | any | sidebar links | Suspense fallback then page renders | | ⏳ | |
| Navigation | Deep-link reload | any | any route | Page restores, no blank screen | | ⏳ | |
| CRM/Sales/Leads | Customer list loads | sales_* | `/customers` | Rows or clear empty state | | ⏳ | |
| CRM/Sales/Leads | Lead/marketing page | sales_* | leads/marketing | Renders, filters work | | ⏳ | |
| CRM/Sales/Leads | Scope filtering | sales_executive | own data | Sees only own records | | ⏳ | |
| GM/BV/Accounts | GM entries | account_manager | GM page | Real seeded data renders | | ⏳ | |
| GM/BV/Accounts | BV entries | account_manager | BV page | Real seeded data renders | | ⏳ | |
| GM/BV/Accounts | Ledger / financial report | account_manager | accounts | Renders + export | | ⏳ | |
| Attendance/HR/Salary | Attendance To-Do | HR/manager | `/attendance/todo` | List renders | | ⏳ | |
| Attendance/HR/Salary | Leave/overtime/loan approval | HR/manager | HR queues | Approve/reject works + audited | | ⏳ | |
| Attendance/HR/Salary | Salary run/export | HR/account | salary | Real data, timestamped export | | ⏳ | |
| PMS | Task/project page | HOD/manager | `/pms/...` | Tasks render, status change works | | ⏳ | |
| PMS | Overdue handling | manager | PMS | Overdue flagged (overdue job) | | ⏳ | |
| Product Posting/Software/QA/Verification | Posting manager page | product_posting_manager | posting | Dashboard/list renders | | ⏳ | |
| Product Posting/Software/QA/Verification | Workflow handoff | manager chain | posting→QA→verif | Each queue gets the record, approvals work | | ⏳ | |
| Service | Service page | service_* | service module | Complaints/pool/VAS render | | ⏳ | |
| Service | Due VAS payment | service_manager | due payments | Renders (see export note) | | ⏳ | |
| DRM/DD | DD dashboard | dd_manager | DRM/DD | Pipeline renders | | ⏳ | |
| DRM/DD | DD task (executive) | dd_executive | own tasks | Own scope only | | ⏳ | |
| Reports | Report page loads | manager+ | reports | Data renders | | ⏳ | |
| Reports | Export | manager+ | reports | Timestamped file, filtered rows | | ⏳ | |
| Events/Training/Notices | Events page | any (permitted) | events | Renders | | ⏳ | |
| Events/Training/Notices | Training/notice | any (permitted) | training/notices | Renders | | ⏳ | |
| Admin/Settings | User list/management | admin | `/users` | List renders, CRUD audited | | ⏳ | |
| Admin/Settings | Allowed-IP settings | admin | settings | View/edit, changes audited | | ⏳ | |
| Notifications/Support | Notifications | any | notifications | Renders, marks read | | ⏳ | |
| Notifications/Support | Support page | any | support | Renders | | ⏳ | |

## Cross-cutting (verify once, applies to all rows)
- [ ] Every `/api/*` response carries `X-Request-Id`; failures quote `rid=` from logs.
- [ ] No 5xx response leaks stack/SQL/secrets (sanitized envelope).
- [ ] Mutations write audit rows (see `AUDIT_LOG_EVENTS.md`).
- [ ] Known mock-data exports flagged per `EXPORT_STANDARD.md`.

## Sign-off
- UAT owner: ______________  Date: __________  Overall: ☐ Go ☐ No-go
