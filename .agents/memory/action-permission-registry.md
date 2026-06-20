---
name: action-permission registry & guard convention
description: how backend action-permission guards are wired (registry + options merge, adminOverride, which domains are deliberately excluded).
---

# action-permission registry & guard convention

`requireActionPermission(actionKey, options?)` (`server/middleware/action-permission.ts`)
is **config-driven**: it looks `actionKey` up in the registry
`server/config/action-permissions.ts` for default roles / allowRole /
adminOverride / audit / entityType / module / message. Explicit `options` at the
call site **override** the registry (options win). Import new usages from the
canonical re-export `server/middleware/action-permission.middleware.ts`.

**Rule — add a registry entry for new sensitive write guards** rather than
hardcoding roles inline, so the role map stays in one reviewable place.

**Rule — `adminOverride` defaults to FALSE** (least-privilege). It bypasses the
ROLE gate ONLY, never a `predicate` / segregation-of-duties check. Set it true
per-action only where an org admin should always pass.

**Why:** a single registry avoids role-map drift across dozens of routes, and
fail-closed defaults mean a forgotten field denies rather than grants.

**How to apply:** these domains are INTENTIONALLY NOT in the registry because
they already have dedicated, audited guards — do NOT duplicate them there (it
would create two competing role maps that drift):
- GM sales create → `requireGmSalesActionPermission` (utils/gm-sales-permissions)
- Office/Accounts writes → `requireFinancialPermission` (middleware/financial-permission)
- Reports export/finalize → `requireReportPermission`
- Penalty create/decide/void/delete → handler-level canCreate/canDecide/canVoid + recordAuditLog

Attributes `view` is intentionally **authenticated-only** (no role gate): the
lists feed dropdowns app-wide; only create/delete are admin/super_hod.
