# Patch 6 Stage 2 — Validation / DTO Safety / SQL Hardening Changelog

Shared-foundation stage. Goals: input validation + DTO safety on modified routes,
centralized SQL-safety helpers applied to raw-SQL id lists and pagination,
audit wiring on the touched mutations, and a consistent authenticated download
helper on the frontend. **No business-workflow outcome changes, no destructive DB
operations, no new audit table, no secret exposure.** Existing modules were not
rewritten wholesale.

## SQL hardening

- **New:** `server/utils/sql-safety.ts`
  - `isUuid`, `assertUuidList`, `quotedUuidList` — UUID-validate every id before
    it is interpolated into raw SQL (`ARRAY[...]::uuid[]` / `IN (...)`). Throws a
    safe `400` that never echoes the offending value.
  - `safePage`, `safePageSize` (clamped to a max), `safeOffset` — coerce
    pagination to bounded integers; invalid/malicious values fall back.
  - `makeOrderBy` — resolves user sort input against an explicit allow-list and
    only ever emits `ASC`/`DESC`; unknown/prototype keys fall back.
- **Applied:**
  - `quotedUuidList` at the four `sql.raw` id-list interpolation sites
    (projects / tasks / project-financials repositories).
  - `safePage` / `safePageSize` wired into the service-core `listOpts` (adds an
    upper bound on page size).

## Validators / DTO safety

- **Extended** `server/validators/service.validators.ts`:
  - Create schemas for follow-up, complaint, dropout, renewal (+ status enums).
  - Preprocessed optional helpers (`blankToUndef` / `nullToUndef` →
    `optUuid` / `optDate` / `optMoney` / `optText` / `optVarchar`) so empty
    strings and explicit `null`s become `undefined` instead of becoming a
    `1970` epoch date or a null-UUID `400`.
  - Schemas **strip unknown keys** (not `.strict()`) so handlers can still read
    aux fields (e.g. follow-up `outcome`) while only column fields reach inserts.
- **New foundation validators:** `account.validators.ts`,
  `office-account.validators.ts`, `social-media.validators.ts`.

## Routes — DTO mapping + error envelope

- `server/service-core-routes.ts`: the four `...req.body` inserts
  (followup / complaint / dropout / renewal) now go through
  `ValidationService.parse(schema)` and spread the validated DTO into the insert.
  - Renewal `amount` is a `decimal` column (Drizzle expects a string); the DTO
    coerces it to a number for validation, so it is serialized back to a string
    at the insert boundary.
  - Inline business `400`s converted to `throw badRequest(...)`; `401`s to
    `throw unauthorized(...)`; catches route through `sendError` (standard
    envelope). Existing `CommunicationService` / cross-department calls intact.
- `server/notice-routes.ts`: the `PATCH` update replaces `.set(...req.body)` with
  an allow-listed `noticeUpdateSchema` (title / description / status enum /
  assignedToRole+Dept nullable) and returns the standard envelope. Existing
  `ActivityLogService.log` retained.

## Audit wiring

- `server/services/activity-service.ts` `recordAuditLog` + `audit-log.service.ts`
  `AuditLogInput`: added an `actorRole` alias that maps to `activeRole`.
- `AuditLogService.record(...)` wired (best-effort, `void`) on the four service
  creates. Notice update keeps its existing `ActivityLogService.log` as the audit
  record (no double-logging). See `PATCH6_AUDIT_NOTIFICATION_EVENT_MAP.md`.

## Frontend API consistency

- **New:** `client/src/lib/download.ts` — `downloadAuthedFile(...)` +
  `DownloadError`, routing downloads through `apiRequest` for consistent
  `401` (session redirect) and `403` handling.
- Converted the export/template-download subset (salary report, raw-attendance
  CSV, user-reports export, lead-import template). Details + rationale for what
  was left as direct `fetch` in `FRONTEND_API_CONSISTENCY_AUDIT.md`.

## Tests

- **New:** `server/sql-safety.test.ts` — malicious sort / filter / pagination /
  UUID inputs against the `sql-safety` helpers (injection blocked, fallbacks,
  prototype-key safety, no value echo in errors).

## Explicitly out of scope (unchanged)

- No new database table (audit reuses `drm.activity_logs`).
- No status / permission / role / approval-logic changes.
- No wholesale rewrite of other modules or every client `fetch` call.
