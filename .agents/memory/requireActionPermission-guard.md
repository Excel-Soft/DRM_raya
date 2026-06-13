---
name: requireActionPermission guard reuse
description: Why the backend action guard can be bolted onto approval routes without changing who can do what.
---

# requireActionPermission action guard

The backend action guard's role check runs `normalizeRole()` on the caller's role
*before* handing it to a role predicate. The role-utils predicates
(`isManagerialRole`, `isHodAllowed`) also normalize internally, and normalization
is idempotent. So gating a route with the guard's role predicate is
**behavior-identical** to the inline `if (!isManagerialRole(callerRole(req)))`
checks the handlers already have.

**Why this matters:** Patch 3 Stage 1's hard rule was "never weaken existing
permissions." The normalize-on-both-sides idempotency is exactly what makes the
guard safe to add as defense-in-depth without changing access for any role —
neither weakening nor over-restricting legitimate managers/HODs.

**How to apply:**
- Add the guard as a *single* middleware argument, never a guard array — an array
  makes Express infer `req`/`res` as implicit `any` and breaks `tsc` (TS7006).
- Keep the handler's inline segregation-of-duties / status-stage checks; those stay
  authoritative. The guard only gates the role up front.
- It fails closed: no auth → 401; role denied or context predicate false/throws → 403.
