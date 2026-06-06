# Stage 6 — Sales, Leads, Marketing Import, Duplicate Policy, CRM Exports

Internal changelog for the Stage 6 work on WebExcels DRM. Scope: real lead
template + import flow, a single shared duplicate policy, a standardized products
endpoint, quotation verification, assignment audit, and honest CRM/lead UX
(no fabricated leads, no silent duplicates). No sales-dashboard redesign; only
additive endpoints/UI and boot-blocker fixes.

## Files added

- `server/utils/duplicate-policy.ts` — shared duplicate-detection module.
- `server/leads-import-routes.ts` — lead template + import (preview/commit/errors).
- `client/src/components/lead-import-dialog.tsx` — upload → preview → commit wizard.
- `STAGE_6_SALES_MARKETING_CHANGELOG.md` — this file.

## Files modified

- `server/routes.ts` — register the lead-import routes.
- `server/repositories/services.repository.ts`
  - Made `listActiveWithSubservices` column-aware (defensively detects optional
    columns) so `/api/sales/services` no longer 500s on partial schemas.
  - Added idempotent unique indexes on `service_subservices(service_id, code)`
    and `(code)` **before** the seed, fixing a silent `ON CONFLICT` failure
    (42P10) that rolled back the whole catalog seed and left services/products
    empty.
- `server/repositories/customers.repository.ts` — fixed a pre-existing 500 in the
  customer list (`findByUserId`): `op.customer_id` (varchar) was compared to /
  unioned with `c.id` / opportunity ids (uuid). Added `::text` casts on the
  `opportunities` join and aligned the UNION column types
  (`opportunityId`, `opportunityStage`, `opportunityOwnerId`). No business logic
  changed; the list now returns real, filtered rows.
- `server/sales-routes.ts` — assignment audit (see Assignment audit below).
- `client/src/pages/marketing-manager-dashboard.tsx`
  - Replaced the placeholder alert with the real import dialog; real template
    download with honest failure (no silent fake file).
  - Removed the hardcoded `dummyLeads` fallback so the "All Uploaded Leads" list
    shows only real API data and the existing "No leads found" empty state.
- `client/src/pages/customer-management.tsx` — added a filtered "Export CSV"
  action (see CRM export below).

## APIs added / modified

- `GET /api/leads/template` — real CSV download. Columns: Company Name, Contact
  Person, Phone, Email, City, Country, Source, Service/Product Interest, Notes,
  Assigned User.
- `POST /api/leads/import/preview` — multipart upload (csv/xls/xlsx); parses,
  suggests a column mapping (scored matching), validates each row, flags
  within-file and existing duplicates; returns headers, suggested/applied
  mapping, per-row data + flags, and counts.
- `POST /api/leads/import/commit` — JSON `{ rows, fileName, override?,
  overrideReason? }`. Inserts valid non-duplicate rows, skips duplicates,
  collects invalid rows, records an import record, and audits the importer.
  Returns `inserted`, `skippedDuplicates`, `invalid`, `overriddenInserts`,
  `importId`.
- `GET /api/leads/imports/:id/errors` — CSV error report (Row, Company Name,
  Type, Reason).
- `GET /api/sales/products` — standardized product list. Fields: id, name,
  package, code, serviceCategory, active, price, maxPrice, tax, stock. Active-only
  by default; `?search=` filters by name/code/category.
- `POST /api/sales/leads/:id/assign` — now captures the assignment audit trail.

## Duplicate policy

Single source of truth: `server/utils/duplicate-policy.ts`.

- Normalization: email lowercased/trimmed; phone reduced to digits; company name
  lowercased with punctuation/whitespace normalized.
- `findDuplicates({ email, phone, company, excludeId })` matches against existing
  `drm.customers` on any of normalized email / phone / company and reports the
  match type and record type. (Fixed an earlier bug where a query referenced a
  non-existent `company` column, threw, and silently returned no duplicates —
  it now uses `company_name` only.)
- Enforcement points:
  - Import commit: duplicates are skipped by default and reported in the error
    report. Override requires (a) a permitted role (`admin` / `super_admin` /
    `sales_manager`) and (b) a non-empty reason; otherwise 403 (role) or 400
    (missing reason). Overridden inserts are counted and audited.
  - Within a single import batch, repeated rows are skipped (never inserted
    twice).
  - Add-customer continues to block duplicates with 409; temp-contact detection
    left as-is (column-aware, warn-only) to avoid breaking existing behavior.
- No silent duplicates: every skip is surfaced (counts + downloadable error
  report). No fabricated leads: empty results render real empty states.
- Fail-closed verification: if the duplicate lookup itself errors, `findDuplicates`
  now throws instead of returning an empty list. Import commit treats this as a
  row error (the row is **not** inserted) and preview marks the row as unverified,
  so a failed lookup can never be mistaken for "unique".

## Assignment audit

`POST /api/sales/leads/:id/assign` reads the previous owner, applies the new
owner (defaults to self; optional `toUserId` for reassignment), and logs a
`lead_activities` entry with `meta = { fromUserId, toUserId, reason, at }`. A
reason is accepted from the body; sensible defaults ("Assigned to self" /
"Reassigned") are used when omitted.

Authorization: any authenticated user may self-assign, but assigning a lead to a
*different* user requires a managerial role (`isManagerialRole`); otherwise the
endpoint returns 403. This closes a privilege-escalation gap where the
`toUserId` body field would have let any authenticated user reassign leads.

## Quotation (E) — verification

The quotation workflow depends on the services catalog and products. Root-caused
and fixed the empty-catalog issue (services seed + `/api/sales/services` 500), so
the catalog now seeds (4 services, 51 subservices) and both
`/api/sales/services` and `/api/sales/products` return real data. No changes were
made to quotation/invoice/GM-BV business logic.

## CRM export (F)

`client/src/pages/customer-management.tsx` gained an "Export CSV" button that
pulls the customers matching the **current** filters (search/stage/grade/sort)
from `/api/sales/customers` — real, server-filtered rows, never cached or
fabricated — and builds a CSV client-side. Empty results report "Nothing to
export"; failures show an honest toast and the button can be retried.

## Tests run

- `npm test` (vitest): 2 files, 14 tests — all pass.
- `npm run check` (tsc): 57 errors, unchanged from the pre-existing baseline
  (server repositories / reports — see `.agents/memory/tsc-baseline-errors.md`);
  no new errors in any file touched by this stage.
- Manual API smoke tests (admin JWT), all passing:
  1. `GET /api/leads/template` → 200, correct CSV header row.
  2. `POST /api/leads/import/preview` → counts total/valid/duplicate/invalid.
  3. `GET /api/sales/products` → 51 items, standardized shape.
  4. `GET /api/sales/products?search=seo` → filtered subset.
  5. `GET /api/sales/services` → 4 services / 51 subservices.
  6. `GET /api/sales/customers` → 200 (previously 500), real filtered rows.
  7. `POST /api/leads/import/commit` → inserted 1 / skippedDuplicates 1 /
     invalid 1; re-commit → inserted 0 / skippedDuplicates 2 (no silent dupes);
     error report CSV downloads.
  8. Override without reason → 400; override with reason (admin) → inserted +
     audited.
  - `POST /api/sales/leads/:id/assign` → audit row with from/to/reason recorded.

## Known issues / unresolved

- Pre-existing tsc baseline (~57 errors) in server repositories / reports remains
  untouched (out of scope; not boot-blockers).
- `opportunities.id` / `customer_id` / `owner_id` are `varchar` while
  `customers.id` is `uuid`; this stage worked around the mismatch with casts. A
  proper schema type alignment is a larger migration left for a future stage.
- Temp-contact duplicate detection remains warn-only (intentionally unchanged to
  avoid breaking existing flows).
