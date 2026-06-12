---
name: HR table id types + payroll honest-zeros
description: user_id column types across HR tables, and which payroll fields have no source and must stay manual/zero
---

## HR table join key types (recurring 500-cause)

In schema `drm`, `users.id` is **uuid**, but several HR tables store the user
reference as **varchar**, so raw-SQL joins/filters need a cast or they error:

- `attendance.user_id` — varchar → compare with `users.id::text` (or just group
  by `user_id` and map by string).
- `leave_requests.user_id` — varchar.
- `overtime_records.user_id` — varchar.
- `penalties.employee_id` — **uuid** (no cast; matches users.id directly).

**Why:** the imported app populated these as text strings. A naive
`JOIN ... ON a.user_id = u.id` throws `operator does not exist: character varying = uuid`.

**How to apply:** when querying attendance/leave/overtime by employee, treat the
key as text; only penalties uses a uuid employee_id.

## Live data status values (exact strings)

- attendance.status enum: `Present` / `Absent` / `Late` / `HalfDay` / `Leave`.
- leave_requests: `status = 'Approved'`, unpaid leave is `leave_type = 'Unpaid'`.
- overtime_records: `status = 'Approved'`, minutes in `time_spent`.
- penalties: `approval_status = 'APPROVED'`, void via `status` (ACTIVE/VOIDED),
  has `deleted_at`; money totals exclude VOIDED.

## Payroll sources (allowance/bonus/loan now wired) + remaining zeros

`users.basic_salary` is TEXT (parse it); `perDaySalary = basicSalary/30`.

Wired to real sources (each still overridable by a per-line manual adjustment):
- **allowance** = sum of TEXT `users` allowance cols
  (`daily/mobile/admin/conveyance_allowance`); the users table IS the source, no
  separate table.
- **bonus** = `SUM(amount)` of `drm.employee_bonuses` where `status='APPROVED'`
  and `period_month/period_year` match the pay period (new table; user_id uuid).
- **loanDeduction** = `SUM(LEAST(installment_amount, remaining_amount))` from
  `drm.loan_requests` where `status='HODApproved'` (the loan lifecycle's active
  state — see loan-routes pay-installment guard) and `remaining_amount>0`.

Still honest-zero (no source): `overtimeAmount` (real minutes, no rate),
`otherDeductions`, `lateMinutes/lateDeduction`.

**Bonus management gate (decision):** employee-bonus CRUD (create/edit/approve/
reject/delete) is gated by `canBonus()` to the full (admin/super_hod), accounts,
and HR salary classes only — i.e. the same set as the salary "edit" capability,
NOT the broader "approve" set (which also includes HOD). Lifecycle is PENDING ->
APPROVED/REJECTED; only PENDING rows are editable/deletable; approve/reject set
`approved_by_user_id`+`approved_at`. **Why:** task scope was "HR add and approve";
keeping one gate avoids HOD/manager touching bonuses. **How to apply:** reuse
`canBonus(req)`, not `can(req,"approve")`, for any new bonus action.

**Manual-override pattern:** `parseOptionalMoney` returns undefined for
empty/missing (use source), null for invalid (400), number for explicit
override; the POST loop only sets fields that are present so unset ones fall back
to source. **Why:** spec forbids fabricated values, but real records should drive
payroll. **How to apply:** to add another auto field, add a source query + map
and default `field = m.x !== undefined ? m.x : source`.
