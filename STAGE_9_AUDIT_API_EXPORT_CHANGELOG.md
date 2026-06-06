# Stage 9 — Audit, Validation, API Contracts & Exports — Changelog

Scope: standardize sensitive admin workflows, audit logging, API contracts,
validation, and exports for the **active** backend (`server/`) and client
(`client/`). Constraints honored: no UI redesign, no route breakage, no silent
modification of financial/HR/admin records, no mock-data exports introduced.

This stage was **partially pre-built** by earlier stages (the error envelope,
shared validators, the audit store, the contract inventory, and the route
permission matrix already existed). Stage 9 closed the remaining gaps and
documented the actual state. Nothing was rewritten "for its own sake".

## What already existed (verified, not rebuilt)

- **Audit store** — `drm.activity_logs` (`shared/schema.ts`) +
  `ActivityLogService` (`server/services/activity-service.ts`), already wired
  into 16 route/job files (account, events, leave, loan, overtime, notice,
  policy, invoice, product-posting workflow, project-doc, software workflow,
  task-execution, settings/allowed-IPs, leads-import, overdue-checker).
  Per task A ("reuse if an audit table exists") this table is the canonical
  audit store — **no parallel `drm.audit_logs` table was created.**
- **Standard error envelope** — `server/utils/api-error.ts`
  (`{ success:false, error:{ code, message, details? }, message }`,
  `ApiError`, `sendError`, `sendSafeError`, `zodIssues`). No stack/SQL/secret
  leakage. Matches task F exactly.
- **Shared validators** — `shared/validators.ts` (id, uuid, email, phone,
  amount, url, approvalDecision, dateRange, pagination, fileMetadata,
  `parseOrThrow`).
- **API contract inventory** — `API_CONTRACT_INVENTORY.md`.
- **Route/permission matrix** — `ROUTE_PERMISSION_MATRIX.md`.
- **Export utilities** — `client/src/lib/export-utils.ts` (CSV/Excel/PDF with
  timestamped filenames) + `client/src/lib/performance-export.ts`; server CSV
  exports in `server/reports-routes.ts` (ledger, gm-entries, refund-entries,
  etc.) driven by real DB queries with filters.

## What Stage 9 added / changed

### A. Audit helper (`recordAuditLog`)
- Added `recordAuditLog({ actorUserId, action, module, entityType, entityId,
  before, after, reason, req })` in `server/services/activity-service.ts`.
- Reuses `drm.activity_logs` with **no schema change**: the flat columns map
  `actorUserId→user_id`, `action→action`, `entityType→resource_type`,
  `entityId→resource_id`; the richer fields (`module`, `before`, `after`,
  `reason`) plus request `ip`/`userAgent` are serialized as JSON into the
  existing `details` (text) column.
- Captures client IP (`x-forwarded-for` aware) and user-agent from `req`.
- Errors are swallowed by the underlying `ActivityLogService.log` so auditing
  can never break the primary request path.
- SECURITY: callers pass only safe fields; password/secret fields are never
  forwarded (the user routes strip `password` before auditing).

### B. Admin user validation + audit (`server/users-routes.ts`)
- User **create / update / status-change / soft-delete** now call
  `recordAuditLog` (actions `user.create`, `user.update`, `user.status_change`,
  `user.delete`) with safe before/after snapshots. Update payloads run through
  `safeUserAudit()` which strips `password`.
- Existing validation preserved: unique email (409 CONFLICT), Zod-validated
  body (`createUserSchema`/`updateUserSchema`), role defaulted, bcrypt-only
  password storage (no plaintext column, no plaintext in responses).
- **Hardening (no-silent-modification):** the status route now validates
  `status` against `activeStatus` and rejects anything else with a 400 envelope
  (previously any non-`active` value silently deactivated the user). Update,
  status-change and soft-delete now verify the user exists (row count / prior
  select) and return **404** instead of a false success + phantom audit row for
  unknown IDs.

### E. Validators
- Added `statusEnum(values)` factory and `activeStatus` (`active`/`inactive`)
  to `shared/validators.ts` to standardize status-field validation on modified
  APIs (task E "status enum" item).

### H. Documentation
- Added this changelog, `AUDIT_LOG_EVENTS.md`, and `EXPORT_STANDARD.md`.
- `API_CONTRACT_INVENTORY.md` and `ROUTE_PERMISSION_MATRIX.md` reviewed; user
  routes' access did not change (audit-only), so the matrix is unchanged.

## Tests run
- `npm run check` — 57 pre-existing baseline errors, **0 new**, none in the
  files touched this stage.
- `npm run dev` — app boots on port 5000.
- Authenticated smoke (admin JWT), all PASS:
  1. `POST /api/users` valid → 201 **and** writes a `user.create`
     `activity_logs` row whose `details` carries `module` + `ip`/`userAgent`
     and contains **no** password/secret.
  2. `POST /api/users` invalid → 400 with the standard safe envelope
     (`success:false`, `error.code=VALIDATION_ERROR`), no stack/SQL leak.
  3. `PATCH /api/users/:id/status` → 200 and writes a `user.status_change`
     row with before/after.
  4. `GET /api/reports/gm-entries/export-csv` → 200, `text/csv`,
     `attachment; filename="gm_report.csv"`, real DB data.

## Unresolved / deferred
- **Mock-data exports** (pre-existing, NOT introduced here) still export
  static/hardcoded data and therefore violate the export standard:
  - `client/src/pages/service-commission-verifications.tsx`
  - `client/src/pages/service-dropout-customer.tsx` (and sibling follow-up pages)
  - `client/src/pages/service-due-vas-payment.tsx`
  These belong to the service module and were left untouched (rebuilding their
  data layers is out of Stage 9 scope and would risk breakage). See
  `EXPORT_STANDARD.md` for the per-report status table.
- Older audited routes use generic action strings (`create`/`update`/`delete`/
  `approve`/`export`) with `resource_type` for context, rather than the new
  namespaced `module.action` convention. They were left as-is (working); new
  and modified routes should adopt `recordAuditLog` going forward.
- 57 baseline `tsc` errors remain in untouched legacy files (out of scope).
