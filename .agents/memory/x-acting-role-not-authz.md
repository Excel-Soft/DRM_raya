---
name: x-acting-role is not an authority
description: The x-acting-role HTTP header is client-controlled; never use it for authorization decisions.
---

# x-acting-role must never grant privileges

The frontend's `queryClient` attaches an `x-acting-role` header (from
`sessionStorage`) to every request. It is a **UI hint only**. The signed JWT
auth middleware ignores it entirely and derives roles from the token
(`req.user.roleId` / `role` / `roles`).

**Rule:** Authorization checks must read roles ONLY from `req.user` (the JWT).
Never add `x-acting-role` (or any client header/body field) to the set of role
candidates used to grant access.

**Why:** A role check that ORs the header into the candidates is purely
additive — it can only escalate. Any authenticated low-privilege user can forge
`x-acting-role: admin` and gain full access. This was a real broken-access-control
bug in the salary/payroll routes (caught in code review): forging the header
granted company-wide payroll view/create/edit/approve/finalize and bypassed
per-user self-scoping on reports/exports.

**How to apply:** When writing any new route guard or report-scoping helper, base
it on `req.user` from the JWT. If a "scope down / act as" feature is ever truly
needed, only honor the header when the JWT user already holds that role (narrow
only, never widen) — but for sensitive data, prefer ignoring it outright.
