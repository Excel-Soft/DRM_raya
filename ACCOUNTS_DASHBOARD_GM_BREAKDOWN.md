# Accounts Dashboard — GM Breakdown

Patch 6 — Stage 3 reference for section K. The Accounts dashboard GM summary with
Full / Partial / Loan breakdown is **already implemented**.

> **Patch 7 Stage 2 re-verification (2026-06-29):** the endpoint, response shape,
> and `::text`-cast joins were re-checked and remain accurate. The **access-scoping
> open item** below is still open and unchanged (tightening it would alter access
> behaviour and needs management confirmation). No dashboard behaviour was changed
> in Patch 7 (see `PATCH7_STAGE2_INVOICE_GM_SALES_CHANGELOG.md`).

## Endpoint

`GET /api/accounts/dashboard/gm-summary` (`server/account-routes.ts`).

Aggregates `drm.gm_entries` (left-joined to invoices, users, and `gm_loan_terms` /
partial-receipt totals) by canonical GM type and status using raw parameterised
SQL.

## Response shape

The handler returns a success envelope `{ success: true, data: { ... } }`
(`sendSuccess`). The keys below are the top-level keys **inside `data`** (there is
**no** `summary` or `loans` block — loan figures live inside `totals` and per-row
in `recentGms`):

| Key | Contents |
| --- | --- |
| `totals` | Top-line counts and amounts: `totalGmCount`, `fullGmCount`/`fullGmAmount`, `partialGmCount`/`partialGmTotalAmount`/`partialGmReceivedAmount`/`partialGmPendingAmount`, `loanGmCount`/`loanGmAmount`, `loanDueSoonCount`, `loanOverdueCount` |
| `byStatus` | Array of `{ status, count, amount }` broken down by GM status |
| `recentGms` | Recent GM rows, each enriched with canonical GM type, customer total / received, derived per-GM invoice payment status, and a loan `overdue` flag |
| `filters` | The applied filter set, echoed back |
| `dueSoonDays` | The applied due-soon window (default `7`) |

By GM type the figures cover:

- **Full** — count, amount.
- **Partial** — count, total, received, pending (remaining balance).
- **Loan** — count, amount, due-soon count, overdue count; per-row return date /
  overdue flag in `recentGms`.

Per-GM invoice statuses are surfaced on each `recentGms` row (derived
`PAID` / `APPROVED` / `PENDING` / `OTHER` / `NONE`) so Accounts can see invoice
progress without leaving the dashboard.

## Filters

Query parameters parsed by the route's zod schema include `gmType`, `status`,
`dateFrom` / `dateTo`, `customer`, `owner` (salesperson), `branch`,
`invoiceStatus`, and `dueSoonDays`. There is **no** export endpoint for this
summary in the current implementation.

## Consumers

This endpoint provides the data for the Accounts / Account Manager dashboard GM
breakdown (Full / Partial / Loan totals, partial received-vs-pending, loan
due-soon / overdue, and the per-GM invoice-status view). The exact widgets and
their wording are owned by the frontend.

## Notes

- Amounts come from the live `gm_entries` rows and the partial-receipt / loan
  data; there is no mocked or placeholder data — empty result sets return zeros.
- The GM id is `varchar` while joined ids are `uuid`, so the raw SQL uses explicit
  `::text` casts (e.g. `users.id::text = e.sales_person_id`, and `e.id::text`
  against the invoice / receipt / loan `gm_id` columns) to avoid type-mismatch
  errors. This summary query does not join `customers`.

## Open item — access scoping (do not change without confirmation)

The handler enforces **authentication only** (`if (!req.user)` → 401). It does
**not** apply managerial-hierarchy or row-level scoping in the handler itself
(no `getDepartmentFilterUserIds` call), so the aggregates returned are not scoped
to the caller's department/hierarchy inside this route. Any role restriction
therefore depends on the global URL-permission layer rather than this code.
Whether `gm-summary` should be restricted to account/managerial roles, and/or
scoped to the caller's permitted GMs, is a **security item to confirm with
management** before sign-off. It was intentionally left unchanged in this
documentation stage because tightening it would alter access behaviour, which
this stage must not do without confirmation.
