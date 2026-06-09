---
name: Central workflow enforcement invariants
description: Invariants to keep once the WorkflowTransitionService role/reason/evidence guards are enforced end-to-end.
---

# Central workflow enforcement is active end-to-end

All workflow phase changes are governed by the central transition guard (legal
state + role + required reason/evidence), not just by per-route checks. The
guards are no longer dormant: callers thread the actor's role context and turn on
content enforcement.

## Invariants — do not break these

1. **A route's `requireRole` allow-list must stay a subset of the action rule's
   permitted roles.** The central role guard fires whenever role context is
   supplied (it always is now). If a route admits a role the rule does not list,
   that actor clears `requireRole` but the central guard 403s them — a false
   rejection. Re-check this subset relationship when adding/changing a route or a
   rule.

2. **Content actions must thread their content.** Required-reason actions
   (returns/rejections) must pass a reason; the required-evidence action
   (executive submission) must pass an evidence count. With content enforcement
   on, omitting these yields a 400.

3. **No phase change may bypass the executors.** Never write the phase column
   directly in a route/service — that skips the entire guard. All transitions go
   through the transition executors.

**Why:** the service was designed as the single authority but its role/content
guards were initially dormant. With them on, any drift between a route's
`requireRole` and the rule table (or a missing reason/evidence argument) surfaces
as a user-facing false rejection rather than silently passing — so these three
invariants must hold for every new or changed transition path.
