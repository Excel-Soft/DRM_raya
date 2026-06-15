---
name: Cross-department notify policy & legacy notifier role-string trap
description: Why cross-cutting hooks must usually pass notify:false, and the non-obvious legacy NotificationService.notify role-broadcast behavior that causes duplicate notifications.
---

# Cross-department hooks: notify policy

When adding a cross-cutting post-transition hook (e.g. a status-ledger /
cross-department service) on top of an existing module flow, default to
`notify: false` and only flip to `true` when the module did NOT already notify.

**Why:** the legacy `NotificationService.notify({ userId })` is NOT a
user-only call. If `userId` does not match the UUID regex it is treated as a
**role** and broadcast to every resolved user via `notifyRole`. So an inline
`notify({ userId: "qa_manager" })` already reaches the real managers. Wrapping
it with a second hook that also notifies double-sends. (A code review caught
exactly this double-notify in the product-posting / software manager-complete
and qa-complete hooks.)

**How to apply:**
- Module already notifies real users (invoice chain, verification close-out) OR
  uses an inline role-string notify (manager-complete, qa-complete) → hook
  `notify: false`, record the ledger only.
- Module never notified before (PMS project create, service complaint raised) →
  hook `notify: true`.
- Use the Stage-2 explicit API (`createNotification` / `createNotificationsForUsers`)
  for new code — it rejects non-UUID ids, so role strings can never become user
  ids. Resolve roles to UUIDs first (`resolveUsersByRole` /
  `resolveUsersByDepartmentRole`).

# Idempotent side effects in a ledger writer

If a hook writes a dedupe row (`INSERT ... ON CONFLICT (event_key) DO NOTHING`)
AND has side effects (notify, audit), do the INSERT FIRST and gate the side
effects on `rowCount > 0`. Notifying/auditing before the insert (or
unconditionally after) makes a re-fired hook send duplicates even though the row
is deduped. Persist `notified`/`notified_count` via a follow-up UPDATE after the
notify actually runs.
