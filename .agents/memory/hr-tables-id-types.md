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

## Payroll honest-zeros (no source tables)

`users.basic_salary` is TEXT (parse it). The DB has **no** authoritative source
for allowance, bonus, loan, overtime *rate*, or late-minutes. The salary
workflow keeps these at 0 and only sets them via explicit manual adjustments —
never fabricated. `overtime_records` gives real overtime *minutes* but there is
no rate, so `overtimeAmount` stays manual. `perDaySalary = basicSalary/30`.

**Why:** Stage-4 spec forbids mock/fake values; a fabricated allowance would be
dishonest payroll. **How to apply:** if asked to "fill in" these fields, add a
real source table first; don't invent numbers.
