---
name: Ownership scope enforcement
description: How record-ownership scoping works in DRM and the bypass pitfall to avoid.
---

# Ownership scope enforcement

`getEditableUserIds(req)` (server/utils/ownership.ts) is the single source of truth
for record-write scope: it returns `null` for full-access roles (admin /
super_admin / super_hod) meaning "all records", and otherwise a concrete list of
user ids the caller may edit (own for executives, department/team for managers,
mirroring performance-routes' department scoping).

**Rule:** scope checks must be exactly `allowed === null || allowed.includes(owner)`.
Do NOT add `|| isManagerialRole(role)` (or any role-based shortcut) on top.

**Why:** a managerial role is already represented inside `getEditableUserIds` by its
team list. Adding an extra `|| isManagerialRole(role)` grants every manager global
write access across all departments — an IDOR-style privilege escalation that
silently defeats the team scoping. This bug shipped once in lead-bulk-routes and
was caught in review.

**How to apply:** any new endpoint that mutates owned records (leads, customers,
follow-ups, bulk actions) should call `getEditableUserIds` / `assertCanEditCustomer`
and rely solely on the returned list — never re-widen it by role.
