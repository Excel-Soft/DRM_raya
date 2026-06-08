# Permission Matrix QA Checklist — Stage 10 (Task D)

Role-by-role QA script for verifying RBAC: which routes are **visible**, which are
**blocked**, and which **approve / delete / export** actions are permitted.

This complements `ROUTE_PERMISSION_MATRIX.md` (the route→role reference). Use this
file as the tester's worksheet: log in as each role and tick the expectations.

## How to test each role
1. Log in as the role's account (see `QA_SEED_DATA_GUIDE.md`).
2. **Visible:** confirm the listed modules appear in the sidebar and open.
3. **Blocked:** paste each blocked route URL directly into the address bar →
   expect redirect / "not authorized", **never** the data.
4. **Actions:** attempt approve / delete / export where listed; confirm the
   control is present (allowed) or absent/denied (blocked). A denied API call
   must return 401/403 with the sanitized envelope (no stack/SQL).

Legend: ✅ allowed · ⛔ blocked · — n/a

## Roles

### admin / super_admin
- Visible: **all modules** (CRM, GM/BV, Accounts, Attendance/HR, PMS, Product
  Posting/Software/QA/Verification, Service, DRM/DD, Reports, Admin/Settings,
  Users, Notifications).
- Actions: approve ✅, delete ✅, export ✅, user management ✅, allowed-IP ✅.
- Blocked: none. (super_admin = full; admin = full minus any super-admin-only
  toggles per `ROUTE_PERMISSION_MATRIX.md`.)

### HOD / super_hod
- Visible: department dashboards, team reports, approvals queue, PMS, CRM
  read/manage for their scope.
- Actions: approve ✅ (within department), export ✅, delete ⛔ (unless owner).
- Blocked: Admin/Settings, Users management, cross-department admin data.

### sales_manager
- Visible: sales/lead manager dashboards, customers, leads, targets, team reports.
- Actions: approve ✅ (team scope), export ✅, delete ⛔ (global), reassign ✅.
- Blocked: Admin/Settings, Users, GM/BV admin, other departments' dashboards.

### sales_executive
- Visible: own dashboard, own customers/leads, own targets, own attendance.
- Actions: create/edit own records ✅, export ✅ (own scope), approve ⛔, delete ⛔.
- Blocked: manager/HOD dashboards, Users, Settings, other reps' data.

### product_posting_manager
- Visible: product-posting dashboard, posting data, report links, team view.
- Actions: approve ✅, export ✅, assign ✅, delete ⛔ (global).
- Blocked: Admin/Settings, Users, CRM admin, unrelated dept dashboards.

### product_posting_executive
- Visible: own posting tasks/data.
- Actions: create/edit own ✅, export own ✅, approve ⛔, delete ⛔.
- Blocked: manager dashboards, Settings, other modules' admin.

### dd_manager
- Visible: DRM/DD manager dashboard, DD pipeline, team reports.
- Actions: approve ✅, export ✅, assign ✅, delete ⛔ (global).
- Blocked: Admin/Settings, Users, unrelated dept admin.

### dd_executive
- Visible: own DD tasks/dashboard.
- Actions: create/edit own ✅, export own ✅, approve ⛔, delete ⛔.
- Blocked: manager dashboards, Settings, other modules.

### software_manager
- Visible: software/IT manager dashboard, software tasks, team reports.
- Actions: approve ✅, export ✅, assign ✅, delete ⛔ (global).
- Blocked: Admin/Settings, Users, unrelated dept admin.

### software_executive
- Visible: own software tasks/dashboard.
- Actions: create/edit own ✅, export own ✅, approve ⛔, delete ⛔.
- Blocked: manager dashboards, Settings, other modules.

### qa_manager
- Visible: QA dashboard/queues, verification of submitted work, reports.
- Actions: approve/reject QA ✅, export ✅, delete ⛔ (global).
- Blocked: Admin/Settings, Users, unrelated dept admin.

### verification_manager
- Visible: verification dashboard/queues, approvals.
- Actions: approve/reject verification ✅, export ✅, delete ⛔ (global).
- Blocked: Admin/Settings, Users, unrelated dept admin.

### service_manager
- Visible: service manager dashboard, complaints, private/public pool, VAS, due
  payments, team reports.
- Actions: approve ✅, assign ✅, export ✅, delete ⛔ (global).
- Blocked: Admin/Settings, Users, unrelated dept admin.

### service_executive
- Visible: own service queue/dashboard.
- Actions: handle own tickets ✅, export own ✅, approve ⛔, delete ⛔.
- Blocked: manager dashboards, Settings, other modules.

### account_manager
- Visible: accounts/account-manager dashboard, ledgers, GM/BV financials,
  refund/loan, financial reports.
- Actions: approve financial ✅, export ✅, post entries ✅, delete ⛔ (global).
- Blocked: Admin/Settings, Users, non-finance dept admin.

### HR / admin-HR roles (if provisioned)
- Visible: attendance, leave, overtime, loan, salary, HR reports.
- Actions: approve leave/overtime/loan ✅, export ✅, run salary ✅, delete ⛔.
- Blocked: non-HR dept dashboards, Users/Settings unless also admin.

## Cross-cutting RBAC assertions (all roles)
- Direct-URL access to a blocked route never leaks data (redirect / 403).
- A blocked approve/delete/export API call returns 401/403 + sanitized envelope.
- Allowed-IP gate (`IP_RESTRICTION_ENABLED=true`) blocks out-of-range IPs and the
  block is audited (see `AUDIT_LOG_EVENTS.md`).
- Every action that mutates data writes an audit entry with actor + request id.

> Roles and exact route bindings are defined in code (`ROUTE_PERMISSION_MATRIX.md`
> + the route guards). If a discrepancy is found during QA, record it in
> `UAT_SIGNOFF_MATRIX.md` notes — do **not** change guards as part of QA.
