# Patch 7 — Stage 2: Invoice / GM / Sales / Full-Partial-Loan / Project-Generation Closure

**Date:** 2026-06-29
**Mode:** BUILD
**Scope:** Close the verified gaps in the GM / Sales / Invoice / Project-generation
surface and document the end-to-end behaviour. All Stage-2 *infrastructure*
(invoice state machine, invoice→project generation, partial-receipt and loan
workflows, the Accounts GM breakdown) was already built in Patch 5 / Patch 6, so
this stage **verifies + closes genuine gaps + documents** rather than rebuilding.

## 1. Grounding outcome (what already existed)

Confirmed present and unchanged (no duplication created):

- **Invoice state machine + transitions** — `server/services/invoice-workflow.service.ts`,
  `shared/gm-sales-constants.ts` (`INVOICE_WORKFLOW_STATUSES`), routes in
  `server/routes/invoice-routes.ts` (each transition already `requireRole`-gated).
- **Invoice → project generation (idempotent, one root per invoice)** —
  `server/services/invoice-to-project.service.ts`, triggered on Accounts approval
  and via the explicit `POST /api/invoices/:invoiceId/generate-project`.
- **Default-invoice generation (idempotent, one per `(GM, invoiceType)`)** —
  `server/services/gm-invoice-generation.service.ts`.
- **Full / Partial / Loan workflows** — partial receipts (append-only) and loan
  terms / loan-admin approval in `server/gm-pool-routes.ts`, with the
  final-approval gate `enforceLoanPartialFinalApprovalGate`.
- **Accounts dashboard GM breakdown** — `GET /api/accounts/dashboard/gm-summary`
  in `server/account-routes.ts`.

Because of this, the following were **intentionally NOT built** (doing so would
duplicate existing, working logic — a hard constraint of this patch):

- No new invoice / project tables or endpoints.
- No `invoice-transition.service.ts` (the established name is
  `invoice-workflow.service.ts`; it already fulfils that role).
- No receipt `PATCH` / `DELETE` (partial receipts are **append-only** by design;
  corrections are new receipts, preserving the audit trail). The running payment
  summary is embedded in `GET .../partial-receipts` (`loadPartialSummary`), so no
  standalone payment-summary endpoint was added.
- No `/api/reports/gm-loans` (loan reporting is already served by the loan-admin
  queue + loan-return report in `server/gm-pool-routes.ts`).
- No `/api/gm/:gmId` alias — the established route family is `/api/gm-pool/:id`
  (see the spec→actual mapping in `PATCH5_REQUIREMENT_COVERAGE_VERIFICATION.md`).

## 2. Genuine gap closed — GM-route broken access control (P0)

**Problem.** Many mutation routes in `server/gm-pool-routes.ts` checked
*authentication only* (`if (!req.user)`), with no role/permission guard. The SQL
stage guards (`WHERE approval_status = 'pending_hod'`, etc.) constrain *when* a
transition is legal but **not who** may perform it — so any authenticated user
(e.g. a Sales Executive) could call `hod-approve` / `super-hod-approve` /
`account-manager-approve`, raw-override status via `fix-status`, or delete/withdraw
another user's GM.

**Fix.** Added the existing fail-closed, admin-bypassing, audited middleware
`requireGmSalesActionPermission(...)` at the route layer, mapped to the role that
each endpoint's UI already targets. Transition SQL, `WHERE` stage guards,
notifications, and happy-path behaviour are **unchanged** — only the denial path
(now 401 for anon, 403 + audit for wrong role) is added. No double-guarding: these
handlers previously had no role guard.

| Route (`server/gm-pool-routes.ts`) | Permission key | Allowed roles (plus `admin` bypass) |
| --- | --- | --- |
| `PATCH /gm-pool/:id` (edit) | `GM_EDIT` | sales_executive, sales_manager, sales_assistant_manager |
| `POST /gm-pool/:id/fix-status` | `GM_FIX_STATUS` | *(none — admin-only break-glass)* |
| `POST .../hod-approve`, `.../hod-reject` | `GM_APPROVE_HOD` | hod, super_hod |
| `POST .../account-manager-approve`, `.../account-manager-reject` | `GM_APPROVE_ACCOUNTS` | account_manager |
| `POST .../sales-manager-approve`, `.../sales-manager-reject` | `GM_APPROVE_SALES_MANAGER` *(new)* | sales_manager |
| `POST .../super-hod-approve`, `.../super-hod-reject` (final) | `GM_APPROVE_ADMIN` | super_hod |
| `PATCH .../super-hod-update` | `GM_APPROVE_ADMIN` | super_hod |
| `POST .../super-hod-approve`, `.../super-hod-reject` (shadowed dup) | `GM_APPROVE_ADMIN` | super_hod |
| `POST .../request-update`, `.../request-withdraw` | `GM_SUBMIT` | sales_executive, sales_manager, sales_assistant_manager |
| `POST .../withdraw-approve`, `.../withdraw-reject`, `.../withdraw` | `GM_APPROVE_HOD` | hod, super_hod |
| `DELETE /gm-pool/:id` | `GM_DELETE` *(new)* | sales_executive, sales_manager, sales_assistant_manager |

Role mapping was validated against actual frontend usage so legitimate flows are
preserved: `hod-dashboard` (HOD) → `hod-*`; `gm-approval-card` (Account Manager /
Sales Manager / Super HOD per context) → `account-manager-*` / `sales-manager-*` /
final `super-hod-*`; `super-hod-dashboard` (Super HOD) → `withdraw-approve/reject`;
`gm-pool-add-gm` (Sales owner) → `request-update`, `request-withdraw`, `DELETE`.

### Edit endpoint (`PATCH /gm-pool/:id`) — role-guarded, behaviour preserved
- The genuine fix here is the **role guard** (`GM_EDIT`): the endpoint was
  authentication-only, so any logged-in user could edit any GM. It is now
  fail-closed to the sales-edit roles (+ admin), denials audited.
- The endpoint still accepts exactly the fields it always did — `package`, `type`,
  financial fields, the display `status`, and the Lead Pools **`hod_status` /
  `accountant_status` Done/Pending tracking flags**. The Lead Pools table sends
  these tracking flags (`client/src/pages/lead-pools.tsx`), so they are retained;
  removing them would have silently broken those dropdowns.
- These tracking flags are **separate from the formal approval state machine**
  (`approval_status` / `account_manager_status` / `super_hod_status` /
  `final_status`). Those approval columns are **not in `updateSchema`** and have
  never been writable through this endpoint, so there is no approval-status backdoor
  to close here. The existing inline "Sales Exec cannot edit after HOD approval"
  stage check is kept.
- **`POST /gm-pool/:id/fix-status`** (raw `approval_status` override) has **no UI
  caller**; it is now an admin-only break-glass tool (empty allowed-role set → only
  the admin bypass passes) and every successful override is audited
  (`gm.fix_status`, with before/after status + reason).

### Shadowed duplicate routes documented
`super-hod-approve` / `super-hod-reject` are each declared **twice** in this file.
Express serves the **first** registration (the final-approval handlers), so the
later pair (the update-request approve/reject) is **dead/shadowed** — the live
super-HOD update-request flow is served under `/api/hod/...`. The shadowed pair is
now both guarded (defensive, so route-order changes cannot reopen a hole) and
clearly commented as shadowed. Their transition SQL was left untouched (changing
the shadowed business logic is out of scope).

## 3. APIs added / modified

- **Added:** none.
- **Modified (guarding / narrowing only, no behavioural/contract change for valid
  callers):** the 19 GM mutation routes listed in §2.
- Invoice and invoice→project endpoints: **unchanged** (re-verified only).

## 4. Permission / audit changes

- `server/utils/gm-sales-permissions.ts` — new action keys
  `GM_APPROVE_SALES_MANAGER` (`[sales_manager]`), `GM_DELETE`
  (`[sales_executive, sales_manager, sales_assistant_manager]`), and `GM_FIX_STATUS`
  (`[]`, admin-only). Existing keys (`GM_EDIT`, `GM_SUBMIT`, `GM_APPROVE_HOD`,
  `GM_APPROVE_ACCOUNTS`, `GM_APPROVE_ADMIN`) were reused unchanged.
- `server/services/gm-sales-audit.ts` — new audit action `GM_FIX_STATUS`
  (`gm.fix_status`) for the break-glass override.
- The middleware already audits unauthorized attempts; no other endpoint's
  success-audit behaviour was altered.

## 5. Database changes

**None.** No schema, table, column, enum, or data changes. (Consistent with the
no-destructive-DB constraint and `db:push` being unusable in this repo.)

## 6. Verification

- `npm run check` (tsc `--noEmit`) — **EXIT 0**, no new errors.
- `npm test` (vitest) — **227 passed (15 files)**.
- Localhost smoke (`http://localhost:5000`):
  - Anonymous → **401** on `hod-approve`, `super-hod-approve`, `request-update`,
    `PATCH`, `DELETE`, `fix-status`.
  - Wrong role → **403** (e.g. sales_executive on `hod-approve`; hod on
    `account-manager-approve`; super_hod on `fix-status`).
  - Correct role passes the guard (reaches the handler) — confirmed for hod,
    super_hod, account_manager, sales_manager, sales_executive, and admin.
  - 17/17 role cases passed; 0 failures.

## 7. Related documents

- `GM_FULL_PARTIAL_LOAN_STATE_MACHINE.md` — Full/Partial/Loan state machine + gates.
- `INVOICE_TRANSITION_RULES.md` — invoice workflow (re-verified).
- `INVOICE_TO_PROJECT_RULES.md` — invoice→project generation (re-verified).
- `ACCOUNTS_DASHBOARD_GM_BREAKDOWN.md` — Accounts GM breakdown (re-verified).
- `PATCH5_REQUIREMENT_COVERAGE_VERIFICATION.md` — requirement-by-requirement evidence.

## 8. Unresolved / pending management confirmation

- **`gm-summary` access scoping** (`ACCOUNTS_DASHBOARD_GM_BREAKDOWN.md`): the
  endpoint is authentication-only with no in-handler hierarchy/row scoping. Whether
  to restrict it to account/managerial roles and/or scope to the caller's permitted
  GMs is a security item left for management confirmation (tightening it would
  change access behaviour).
- **Config-gated behaviours stay at their documented defaults** until management
  confirms: `gmInvoiceGenerationTiming = ON_GM_CREATION`,
  `projectGenerationMode = MANUAL`, `requireProductPostingWaitForListingQa = false`,
  `serviceExecutiveCanCreateManualInvoice = false`,
  `defaultProjectStatusAfterInvoiceApproval = ACTIVE`.
- **Shadowed super-HOD duplicate routes** are documented and defensively guarded
  but not removed (removing dead business logic is out of this patch's scope).
