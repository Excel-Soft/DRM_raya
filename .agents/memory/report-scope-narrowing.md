---
name: Report row-scoping & userId narrowing convention
description: How report endpoints must scope rows by role and treat the userId filter, including out-of-scope and malformed handling.
---

# Report row-scoping convention

For role-scoped reports (e.g. reception, day-target), resolve a row-scope from the
caller's role, then apply an optional `userId` query param as a **narrowing only**
filter — it must never widen what the role can see.

- Global roles (admin/super_hod/hod/account_manager + the report's manager role) → no
  scope (see all).
- Non-managerial caller (executive) → own rows only (`[self]`), matched on the row's
  `created_by` OR `user_id`.
- Other managers → their department/team ids (via `getDepartmentFilterUserIds`).
- `userId` present: if global → `[userId]`; if in scope → `[userId]`; if **out of
  scope** → a zero-UUID sentinel `["00000000-0000-0000-0000-000000000000"]` so the
  result is empty, never the full set.
- A **malformed** `userId` (not a UUID) → **400**, not 500. Validate the format before
  it reaches `ANY($n::uuid[])`, or Postgres throws `22P02` and the generic catch
  returns 500.

**Why:** scoping bugs here are silent privilege escalation (one user reads another's
rows) or dishonest 500s on bad input. Fail closed (empty sentinel) and reject bad
input honestly (400), matching the status-whitelist 400 pattern in the same files.

**How to apply:** when adding/auditing any scoped report list + its CSV export, share
ONE filter+scope builder between them so the export can't leak rows the list hides,
and run the userId/empty-sentinel/malformed cases through tests.
