# Patch 3 — Stage 1: P0 Auth / Session / Password / RBAC / URL-Permission / Action-Guards

Stage 1 hardens the highest-risk security and permission defects identified in
Patch 3, **without** changing business workflows, UI, approval logic, or DB
business structure, and **without weakening any existing permission**.

Stage 0 (audit) was completed and merged previously. This stage builds on the
auth/RBAC hardening already delivered in earlier patches; several of the spec
items (A, C, D, E, G, I, J, K, and the frontend half of B) were already
implemented and are **documented here for completeness** — they were verified,
not rewritten. The genuinely new work in this stage is **task H** (the reusable
action-permission guard, applied to HR/loan approvals) and a **targeted slice of
task B** (standardizing the in-scope HR overtime page on the shared API client).

---

## Files changed in this stage

| File | Change |
| --- | --- |
| `server/middleware/action-permission.ts` | Extended `requireActionPermission(actionKey, options)` additively: added an optional async `predicate` hook (ownership / stage-status / department-team checks via `{ req, role, user }`), documented options, kept it **fail-closed**. Existing `roles` / `allowRole` / `message` behavior is unchanged and backward-compatible. |
| `server/leave-routes.ts` | Added `requireActionPermission("leave.approve" / "leave.reject", { allowRole: isManagerialRole })` as an outer guard on the approve/reject routes. All pre-existing inline self-approval (segregation-of-duties) and status checks are **preserved**. |
| `server/overtime-routes.ts` | Same outer guard on overtime approve/reject (`allowRole: isManagerialRole`). Inline self-approval/status checks preserved. |
| `server/loan-routes.ts` | Outer guards added: manager-approve / reject / complete / pay-installment (`allowRole: isManagerialRole`) and hod-approve (`allowRole: isHodAllowed`). Inline self-approval, status, and amount-validation checks preserved. |
| `client/src/pages/overtime-submission.tsx` | Task B: converted the 3 remaining raw `fetch("/api/...")` calls (records fetch + approve + reject mutations) to the shared `apiRequest` helper so `Authorization` / acting-role headers and 401 redirect behavior are consistent with the rest of the app. No UI change. |
| `PATCH3_STAGE1_SECURITY_RBAC_CHANGELOG.md` | This document (task L). |

No database migrations were run. No secrets were added, moved, or exposed.

---

## A. Server-validated private routing  *(pre-existing — verified)*
- Private layout waits on server-validated current user (`/api/auth/me`); failure
  clears stale token/role/sessionStorage values, redirects to `/auth`, and shows a
  session-expired path.
- Route protection (`client/src/hooks/useRouteProtection.ts`) keys off
  server-derived `activeRoleId` / user roles, not editable sessionStorage role.
- Result: invalid/expired tokens redirect to `/auth`; editing the sessionStorage
  role does not unlock private routes.

## B. Standardize protected API requests  *(infra pre-existing; in-scope page standardized this stage)*
- Shared client helpers exist and are the standard: `apiRequest`,
  `apiRequestJson`, `getQueryFn`, `getAuthHeader` (in `client/src/lib/queryClient.ts`).
  They attach `Authorization` (+ acting-role) and, on `401`, clear auth state and
  redirect to `/auth`. All TanStack Query reads already route through `getQueryFn`.
- This stage converted the in-scope HR overtime page (`overtime-submission.tsx`)
  off raw `fetch` onto `apiRequest`, making its approve/reject/records calls
  consistent end-to-end.
- **Intentionally not converted:** `client/src/pages/auth.tsx` login/signup/forgot/
  reset calls — these are **public** endpoints and must NOT route through the
  401-redirect helper. File-upload (multipart) fetches were also left as-is to
  avoid breaking `Content-Type` boundaries.
- See *Known limitations* for the remaining raw fetches (tracked follow-up).

## C. Public signup hardening  *(pre-existing — verified)*
- `server/auth.routes.ts` signup assigns a fixed lowest-privilege role and **never**
  `admin`; public self-service signup is **disabled in production** (returns a
  forbidden response). Response is sanitized.

## D. Secure password reset  *(pre-existing — verified)*
- Reset uses a signed, expiring, one-time token with hash + expiry persisted in the
  `drm` schema; generic responses avoid account enumeration; the full token is not
  logged in production.

## E. Remove plaintext password exposure  *(pre-existing — verified)*
- User APIs never return `password` / `password_hash` (explicit sanitization in
  `server/users-routes.ts`); create/update writes `password_hash` only.

## F. Fail-closed URL permissions  *(documented limitation — intentionally NOT flipped)*
- `server/settings.middleware.ts` currently **allows** an API path that has no
  matching rule in `drm.url_permissions` (lines ~102-111). This is **intentional and
  left unchanged**: the `url_permissions` table only models menu segments and is
  currently unpopulated, so flipping this to a hard default-deny would lock every
  non-admin role out of the entire API and brick the app.
- The authoritative access control for API routes today is the **per-route role
  guards** (and, for sensitive write actions, the new `requireActionPermission`
  guards from task H). The frontend sidebar/menu already fails closed (task G).
- Converting this middleware to a true default-deny requires first populating
  `url_permissions` for every API route/role — tracked as a **Stage 1B** follow-up.

## G. Sidebar permissions fail-closed  *(pre-existing — verified)*
- While permissions load or if the fetch fails, the sidebar shows a safe minimal
  menu rather than all items; admin/super_admin breadth is explicit.

## H. Action-level permission guard  *(NEW this stage)*
- `requireActionPermission(actionKey, options)` is the reusable backend guard. It
  supports: an **action key** (for logging), **allowed roles** (`roles` and/or an
  `allowRole` predicate, compared on normalized roles), an optional async
  **predicate** for **ownership / stage-status / department-team** checks, and a
  **clear 403** response. It is **fail-closed**: unauthenticated → 401; role not
  permitted → 403; predicate returning false or throwing → 403.
- Applied as an outer guard to, while **preserving** every existing inline
  segregation-of-duties / status check inside the handlers (which remain
  authoritative):
  - leave approve, leave reject
  - overtime approve, overtime reject
  - loan manager-approve, loan hod-approve, loan reject, loan complete,
    loan pay-installment
  - (user create/edit/delete/status were already guarded by the user-admin guard
    in `server/users-routes.ts`.)
- Because `allowRole` receives the already-normalized role and `isManagerialRole` /
  `isHodAllowed` re-normalize internally (idempotent), the guard is **behavior-
  identical** to the pre-existing inline role checks — it adds defense-in-depth and
  centralized logging without weakening or over-restricting any role.
- Approver id / timestamp continue to be stored by the existing repository methods
  where the schema supports it (unchanged).

## I. API error sanitization  *(pre-existing — verified)*
- Auth/login and todo/database errors return safe messages via the shared
  `api-error` helpers; no SQL detail, stack trace, token, or secret is returned.

## J. MOCK_AUTH production guard  *(pre-existing — verified)*
- `server/routes.ts` refuses the `NODE_ENV=production` + `MOCK_AUTH=true`
  combination so mock auth can never bypass real JWT auth in production.

## K. DRM debug endpoint restriction  *(pre-existing — verified)*
- `GET /api/drm/permissions/debug` returns **404 in production** and **403** for
  non-admin in development (super_admin/admin only).

---

## Tests run
- `npm run check` — TypeScript type check. Result: **56 errors, all pre-existing
  baseline errors in unrelated files** (e.g. `InvoiceCreateForm.tsx`,
  `account-invoices.tsx`, `dollar-system.tsx`, `lead-executive-dashboard.tsx`).
  **Zero errors in any file changed by this stage.**
- `npm run dev` — app boots cleanly on port 5000 and serves the SPA (`GET / → 200`).
- `npm test` (vitest) — **125/125 tests passing** across 8 files.

## Smoke test results
- App serves: `GET / → 200`.
- Guarded HR/loan write endpoints, called **without auth**, all fail closed:
  - `PATCH /api/leave/:id/approve → 401`
  - `PATCH /api/leave/:id/reject → 401`
  - `PATCH /api/overtime/:id/approve → 401`
  - `PATCH /api/loans/:id/manager-approve → 401`
  - `PATCH /api/loans/:id/hod-approve → 401`
  - `PATCH /api/loans/:id/pay-installment → 401`
- The role gate (403 for an authenticated ordinary employee/executive) mirrors the
  pre-existing inline checks exactly; existing behavior is also covered by the
  passing unit-test suite.

---

## Known limitations / follow-ups (Stage 1B)
1. **URL-permission default-deny (F):** `settings.middleware.ts` still allows
   API paths with no matching `url_permissions` rule. Converting it to a true
   default-deny requires first populating `url_permissions` for every API
   route/role; until then, per-route role guards + action guards are the
   authoritative API access control.
2. **Remaining raw `fetch("/api/...")` calls (B):** roughly three dozen call sites
   across the client still use raw `fetch`. They authenticate via the
   `credentials: include` cookie and most reads already go through TanStack Query
   (centralized 401 handling), so this is a consistency/maintainability item, not
   an open auth hole. A full migration to `apiRequest` is intentionally deferred to
   avoid regressions in untested pages; public auth endpoints and multipart uploads
   should be excluded from that migration.
3. **Declarative ownership/stage predicates:** the new `predicate` hook on
   `requireActionPermission` is available for callers; ownership/stage checks
   currently remain inline in the handlers (authoritative) and can be migrated to
   the predicate incrementally.
