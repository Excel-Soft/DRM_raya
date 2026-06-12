---
name: users money columns are normalized text
description: drm.users basic_salary + allowance columns are text but normalized to numeric-parseable on write/boot
---

# drm.users money columns

`drm.users.basic_salary`, `daily_allowance`, `mobile_allowance`,
`admin_allowance`, `conveyance_allowance` are **text** columns (not in
schema.ts, only ensured in `users.repository.ts` ensureUsersSchema). They are
NOT altered to numeric — kept as text because many raw-SQL readers consume them.

**Invariant:** they are normalized to canonical numeric strings:
- on write via `normalizeMoneyInput`/`normalizeMoneyFields` in `users-routes.ts`
  (create + PATCH). Blanks -> "0", strips commas/currency labels
  ("1,000 pkr" -> "1000"), rejects no-number garbage with 400.
- on boot via an idempotent UPDATE in ensureUsersSchema (only dirty rows).

**Why:** malformed text like "1,000 pkr" used to parse to 0 in
salary-routes.ts `toNum()` and silently understate payroll.

**How to apply:** keep the JS helper and the SQL `normExpr` in lockstep; both
strip a leading minus (negatives become positive). `toNum()` still reads them.
