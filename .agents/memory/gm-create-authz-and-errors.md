---
name: GM create authz, type-routing & error-shape conventions
description: Durable design rules for guarding the two GM-create paths — two-layer per-type authz, fail-closed config checks, and the dual API error shape the GM-sales frontend must parse.
---

## Two-layer authz for a type-routed create endpoint
When one create endpoint produces several canonical types and each type has its own
allowed-initiator list, enforce authz in **two** layers:
1. **Route guard = coarse gate**: admit any role in the *union* of every type's
   allowed list (+ override roles).
2. **Handler = per-type narrowing**: after the canonical type is resolved, re-check
   against that type's specific list and 403 (with an unauthorized-attempt audit)
   if the role is not permitted for that type.

**Why:** the request body decides the type, so the guard runs *before* the type is
known. A guard keyed to a single type's list would wrongly block roles that are only
valid for a different type. The union gate lets the request through; the handler does
the precise decision once it knows the type.
**How to apply:** any future per-type initiator divergence is expressed only in the
config lists — the union-gate + narrow structure already enforces it correctly.

## Fail-closed config consistency (create AND approval)
Threshold/role checks that read workflow config must behave identically at create
time and at every later transition (e.g. approval re-checks):
- config load **error** → fail closed (503 CONFIG_UNAVAILABLE), never silently allow.
- thresholds **explicitly empty/unconfigured** → no-op (short-circuit before any DB read).

**Why:** an approval path that opened-up on a transient config failure would bypass a
limit the create path enforces, creating an inconsistent, exploitable gap.
**How to apply:** keep the create-side and approval-side helpers symmetric; if you add
a new transition, route it through the same fail-closed helper.

## Dual API error shape (GM sales endpoints)
Two error shapes coexist **by design** and the frontend must parse both:
- **Permission/auth middleware** → envelope: `{ error: { code, message } }`.
- **Route-handler business validation** → flat: `{ error: <string>, code, details }`
  (flat string preserves the pre-existing frontend contract).

**Why:** the flat string was the original contract many callers relied on; the envelope
comes from shared middleware that can't be changed without breaking other consumers.
**How to apply:** frontend mutation/error helpers must extract the message from *both*
`error` (string) and `error.message` (envelope). Don't "normalize" one away — both
sources are live.
