---
name: Report row-scope edge cases
description: Non-obvious traps when scoping report rows by role/userId across the reports endpoints
---

When building row-scope for a report endpoint (resolve which employee ids a viewer
may see), two traps recur and have caused wrong/empty results:

- **`getDepartmentFilterUserIds(req)` returns `null` for global roles** (e.g.
  `account_manager`), meaning "all users". A naive resolver that does
  `allowed.includes(queryUserId)` will throw/return an empty sentinel when
  `allowed === null`. Guard `allowed === null` FIRST: with a `userId` filter return
  `[userId]`; with no filter return `null` (all).
- **`hr` / `hr_manager` are granted `view` in report permission matrices but are
  NOT managerial** (`isManagerialRole` is false). If you only branch on
  managerial-vs-self they get scoped to themselves and the matrix grant is
  meaningless. Treat them as all-users explicitly.

**Why:** the permission matrix (who may *view*) and the row-scope (whose rows they
see) are separate systems; a role can be granted view yet fall through scope logic
to an empty/self result, so the report looks broken or leaks nothing.

**How to apply:** order the branches global-admins+hr → null(all); non-managerial →
[self]; managerial → getDepartmentFilterUserIds; then apply the `userId` filter with
the `allowed === null` guard above. `ourTeam` must only narrow (always bounded by
`allowed`), never widen. Out-of-scope `userId` → a non-matching sentinel id so the
result is honestly empty rather than unfiltered.
