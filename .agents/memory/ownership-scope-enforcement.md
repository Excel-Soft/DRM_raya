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

## Update endpoints must re-clamp the owner/assignee, not just the row

When a create endpoint clamps who a record may belong to (e.g. own-scope callers
forced to self-assign, team-scope callers limited to their department), the
matching update/PATCH endpoint must apply the **same** clamp to the
owner/assignee field — not only the row-level "can I touch this record" check.

**Why:** verifying the caller may edit *this* row is not enough. If PATCH then
lets them set `assignedTo`/owner to an arbitrary user id, a low-privilege caller
can push the record *out of* their own scope (handing it to someone else) or a
manager can reassign across departments — re-introducing the exact scope leak the
create-side clamp was meant to prevent. Caught in review on the diagnosis report
PATCH (own/team could reassign freely while POST forced self/department).

**How to apply:** mirror the create rule on update — own → force owner to self;
team → reject (403) any target outside the team list; full-access → unrestricted.
