# Patch 6 Stage 8 — Reports Sign-off (Changelog)

Date: 2026-06-22. Goal: make the seven reportable surfaces — Raw Attendance,
Salary, Event, Reception, Daily Target, BV, Penalty — sign-off ready: the
on-screen view and its export come from the **same** query/service with the
**same** filters and role-scope; exports carry a descriptive, timestamped
filename; every export writes one audit row; empty/error states are honest. No
formula, permission, role, or approval-logic change was made — those remain
gated on management confirmation (see `PATCH6_REPORT_FORMULA_SIGNOFF_PENDING.md`).
Behaviour-preserving only.

## Export audit parity (rule A.5)

Every report export now writes exactly one audit row via
`ActivityLogService.log` (action `<report>.export`, `resourceType: "report"`),
matching the shape day-target/BV already used.

- **Raw Attendance** (`server/stage3-reports-routes.ts`) — added export audit.
- **Reception** (`server/stage3-reports-routes.ts`) — added export audit.
- **Event** (`server/events-routes.ts`) — added export audit.
- Salary, Daily Target, BV — already audited; unchanged.

No change to the data, filters, or row-scope of any export.

## Export filename parity (rule A.4 = report + range + user/branch + timestamp)

- New `server/utils/export-filename.ts`:
  - `buildExportFilename(report, { from, to, user, branch, ext })` — slugified,
    path-separator-free; the `report` token keeps its underscores so existing
    prefixes (e.g. `bv_report`) survive.
  - `exportTimestamp()` — UTC `YYYYMMDD-HHMMSS`.
- Server `Content-Disposition` made compliant for direct/API consumers on
  raw-attendance, reception, event, and salary; a `_${exportTimestamp()}` suffix
  was appended to day-target and BV (the **`bv_report_` prefix is preserved** so
  `stage9-bv-report.test` stays green).
- Client (the user-visible `a.download` / `downloadAuthedFile` name):
  `safeReportFilename` in `client/src/lib/reportApi.ts` gained an opt-in
  `timestamp?: boolean`. Reception (was static `reception_report.csv`), Salary
  (was static `salary_report.csv`), Event (was date-only), Raw Attendance (was
  range-only), and Daily Target now route through it with `timestamp: true`, so
  the visible filename = report + range + user/branch + timestamp.

## PEN-001 — Penalty refinement (behaviour-preserving)

- **Single permission source.** The penalty permission helpers were extracted
  verbatim into `server/middleware/penalty-permission.ts`; `penalty-routes.ts`
  imports them. Penalty intentionally keeps its **own row-aware** source rather
  than the flat `REPORT_PERMISSION_MATRIX` `penalty_report` entry, because access
  depends on `isManagerialRole` **and** the requester's department vs. the
  penalised employee's department (row-level scope) — which the role→page matrix
  cannot express, and switching to it would *change* who can act. See
  `PATCH6_REPORT_PERMISSION_MATRIX.md`.
- **Zod validation.** New `server/validators/penalty.validators.ts` provides
  create/update/decision/void schemas. They are a faithful port of the previous
  inline checks: identical messages, identical "first failing field wins"
  ordering, identical coercions, and the same `{ error: "BadRequest", message }`
  400 envelope. All 401/403/404/409 checks and the persistence mapping stay in
  the route, so 400-vs-404-vs-403 ordering is unchanged.
- **Audit completeness.** Added `penalty.acknowledge` audit on the acknowledge
  route so every state-changing penalty action (create/update/approve/reject/
  delete/void/acknowledge) is now audited.
- **No penalty CSV export** was added — penalty has no export UI and the task's
  "if required" condition does not apply.

## Verification

- `npm run check` (tsc): clean.
- `npm test` (vitest): 14 files, 219 tests passing — no regressions.
- Unauthenticated smoke of every touched export/penalty endpoint returns 401
  (gating intact; server boots on port 5000).
