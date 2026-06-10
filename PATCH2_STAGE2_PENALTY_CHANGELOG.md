# Patch 2 Stage 2 — Penalty / Plenty Engine (Gap-Fill)

The penalty feature already existed and was fully DB-backed (no mocks). This
stage gap-filled it to the Stage 2 spec **without rebuilding**: a real, audited
Void lifecycle, audit logging on every mutation, reject-requires-remarks,
acceptance of the `{ approvalStatus }` body shape, and surfacing of voided
counts/status in the API and UI.

A penalty now has **two independent dimensions**:

- `approval_status` — the decision dimension: `PENDING → APPROVED | REJECTED`
  (existing; unchanged).
- `status` — the lifecycle dimension: `ACTIVE | VOIDED` (new). A void never
  destroys the original approval decision, so history stays auditable.

---

## Files changed

### Database / schema
- `migrations/20260603_add_penalties_table.sql` — appended idempotent
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for the new lifecycle/void columns
  plus a status index (fresh-DB parity).
- `shared/schema.ts` — added `status`, `voidedBy`, `voidedAt`, `voidReason` to
  the `penalties` table definition and the `idx_penalties_lifecycle_status` index.
- `server/db/ensure.ts` — added `ensurePenaltiesSchema(client)` (additive,
  idempotent runtime ALTERs) wired into `ensureDbOnce` so columns appear on boot
  even though `db:push` is broken repo-wide.

### Service layer
- `server/services/penalty.service.ts`
  - `ROW_SELECT` / row joins now expose `status`, `voidReason`, `voidedById`,
    `voidedByName`, `voidedAt` (joins `drm.users` as the voiding actor).
  - `getPenaltyRaw` now returns `status` (so routes can 409 on voided rows).
  - `voidPenalty(id, voidedBy, reason)` — sets `status='VOIDED'` + void audit
    columns, preserves `approval_status`, fires a best-effort employee
    notification, returns `null` on a no-op (already voided/deleted).
  - List summary excludes VOIDED from `pending/approved/rejected` counts and
    `totalAmount`, and adds a `voidedCount` bucket.
  - `monthlyReport` money aggregates (totals / by department / by employee /
    by penalty head) exclude VOIDED; the `records` list still includes voided
    rows (with status) for visibility.
  - `getPenaltySummaryForEmployee` (Increment/Performance integration helper)
    now ignores VOIDED penalties.

### Routes + audit
- `server/penalty-routes.ts`
  - **New** `PATCH /api/penalties/:id/void` — reason required (400 if missing),
    409 if already voided, department-scoped, writes an audit row.
  - Approval endpoint accepts `{ approvalStatus }` (legacy `{ decision }` /
    `{ status }` still honored) and **requires `hodRemarks` on REJECTED** (400).
  - VOIDED guards: `approve/reject`, `edit`, `acknowledge`, and `delete` now
    return **409** on a voided penalty.
  - `recordAuditLog` (best-effort, never throws) on
    create / update / approve / reject / void / delete.
  - `/api/penalties/meta` permissions now include `canVoid`.

### Frontend
- `client/src/pages/drm/add-penalty.tsx`
  - Types extended (`status`, void fields, `voidedCount`, `canVoid`).
  - VOIDED badge (orange) shown next to the approval badge on voided rows.
  - **Void** action button (gated by `canVoid`) + required-reason dialog.
  - Reject is blocked in the approval dialog until remarks are entered.
  - New **Voided** summary card; void details (by / at / reason) in the detail view.
  - Approval mutation now sends `{ approvalStatus }`.

### Tests
- `server/penalty-routes.test.ts` — **new**. Pure-unit assertions on the penalty
  constants, plus resilient HTTP assertions that `/:id/void`, `/:id/approval`,
  and `/meta` sit behind the auth gate (401, never 404). Soft-skips when the dev
  Postgres pool is unreachable (mirrors the existing test pattern).

---

## API surface

| Method & path | Change | Notes |
| --- | --- | --- |
| `PATCH /api/penalties/:id/void` | **new** | `{ reason }` required; full-access + HOD (dept-scoped); 409 if already voided |
| `PATCH /api/penalties/:id/approval` | changed | accepts `{ approvalStatus }`; `hodRemarks` required when `REJECTED`; 409 on voided |
| `PATCH /api/penalties/:id` (edit) | changed | 409 on voided |
| `PATCH /api/penalties/:id/acknowledge` | changed | 409 on voided |
| `DELETE /api/penalties/:id` | changed | 409 on voided; writes audit |
| `POST /api/penalties` | changed | writes audit |
| `GET /api/penalties` (list) | changed | summary adds `voidedCount`; voided excluded from approval counts + `totalAmount` |
| `GET /api/penalties/meta` | changed | permissions add `canVoid` |

## Database changes

Applied to `drm.penalties` (live via psql + idempotent runtime ensure;
`db:push` is broken repo-wide on a pre-existing FK mismatch):

```sql
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES drm.users(id);
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS voided_at timestamp;
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS void_reason text;
CREATE INDEX IF NOT EXISTS idx_penalties_lifecycle_status ON drm.penalties (status);
```

No existing rows are mutated — every existing penalty defaults to `ACTIVE`.

## Permissions

- **Create**: full-access (`admin`, `super_hod`), HOD, and managerial roles.
- **Approve / Reject / Void**: full-access and HOD only (HOD is department-scoped).
  Void deliberately mirrors approve/reject authority — a managerial creator can
  delete their own still-PENDING penalty but cannot reverse an approved one.
- **Acknowledge**: the target employee only.
- All penalty routes are mounted behind the global auth middleware (401 when
  unauthenticated).

## How to test

1. **Automated**: `npm test` → 60 tests pass (6 files). `npx tsc --noEmit` →
   57 errors (unchanged pre-existing baseline; no new penalty errors).
2. **Service end-to-end** (real DB, no mocks): create an `APPROVED` penalty,
   call `voidPenalty`, and confirm: `status` becomes `VOIDED` with reason +
   actor; a second void is a no-op (`null` → route 409); the row stays visible
   in the list with `status=VOIDED`; `voidedCount` increments; approved counts
   and `totalAmount` drop; `getPenaltySummaryForEmployee` ignores it;
   `monthlyReport.records` still includes it while money totals exclude it.
3. **UI** (`/drm/add-penalty` as admin/HOD): the **Void** action opens a
   required-reason dialog; voided rows show a VOIDED badge and a Voided summary
   card; the detail view shows who/when/why; Reject is disabled until remarks
   are entered.

## Unresolved / out of scope

- The dev admin password is not stored in the repo, so the end-to-end check was
  run through the real service layer against the live DB rather than over HTTP
  with a JWT. Route wiring is covered by auth-gate tests; the business logic is
  covered by the service smoke run.
- Audit logging is intentionally best-effort (`recordAuditLog` never throws), so
  a logging outage will not block a penalty mutation.
- `db:push` remains broken repo-wide (pre-existing FK type mismatch); schema is
  applied via the runtime ensure step + migration SQL, not `push`.
- No new public/unauthenticated penalty endpoints were added.
