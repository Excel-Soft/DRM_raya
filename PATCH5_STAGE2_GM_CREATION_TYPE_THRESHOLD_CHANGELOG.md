# Patch 5 — Stage 2: GM Creation Role Guards, GM Type Routing, Payment Thresholds

A **thin, behaviour-preserving validation/authz wrapper** around the two existing
GM-create paths. With the shipped safe defaults every new gate is a no-op, so
current GM behaviour is unchanged. No partial-receipt, loan-approval or
invoice-generation logic was touched. No destructive DB command was run
(`db:push` is broken repo-wide → runtime `ALTER ... IF NOT EXISTS`).

## What changed (behaviour, by default = no-op)

### 1. Role guards on BOTH create endpoints (separate scopes)
- `POST /api/gm` → action `gm.create`. Enforced in two layers: the route guard
  is a **coarse gate** admitting any role in the union of
  `full/partial/loanGmAllowedInitiatorRoles` (+ override); after the canonical
  type is resolved the handler **narrows** to that type's specific list and
  returns `403 FORBIDDEN` (`details.gmType`) + a `gm.create_unauthorized_attempt`
  audit if the role is not permitted for that type. Defaults are identical across
  types (`["sales_executive"]`), so this is a no-op unless an admin diverges them.
- `POST /api/account/gm-entries` → **new** action `gm.create.account`, allowed
  initiators from **new** config `accountGmAllowedInitiatorRoles` (default
  `["account_manager","hod","super_hod","sales_manager"]` — preserves the
  account-team flow).
- Both also honour `gmCreateOverrideRoles` (default `["admin","super_hod"]`);
  `admin` bypass kept. Override creations and unauthorized attempts are audited.

### 2. Canonical GM type routing (FULL / PARTIAL / LOAN)
- Type is resolved canonically via `resolveCanonicalGmType()`:
  - `/api/gm`: derived from the existing `loanMode` (`none→FULL`,
    `installment→PARTIAL`, `loan→LOAN`), or an explicit `canonicalGmType`.
  - `/api/account/gm-entries`: derived from the existing `is_loan` /
    `is_partial_payment` flags, or an explicit `canonicalGmType`.
- Stored using the **existing** flag columns via `mapGmTypeToDbFlags()`. The DB
  `gm_type` value stays `'GM'` — no enum or write-shape change.
- Missing / invalid / ambiguous type → `400` with `code: GM_TYPE_REQUIRED` /
  `GM_TYPE_INVALID`. A `gm.type_set` audit is written after a successful insert.

### 3. Optional minimum-payment thresholds
- `checkGmCreationThreshold()` compares the USD payment amount
  (`customerDollar` on `/api/gm`, `amountUsd` on the account path) against
  `minimumPaymentThresholds[gmType][packageKey]`.
- Default `minimumPaymentThresholds = {}` ⇒ **always passes** (no enforcement).
- When configured and not met → `400` `code: MINIMUM_PAYMENT_NOT_MET`, with a
  `gm.threshold_validation_failed` audit.

### 4. Threshold re-check at approval transitions
- A module-level `enforceApprovalThreshold()` helper re-validates the stored GM
  amount against the configured threshold at the approval transitions:
  - `/api/gm-pool/:id/hod-approve`
  - `/api/gm-pool/:id/account-manager-approve`
  - `PATCH /api/account/gm-entries/:id/approve`
- It **short-circuits before any DB read** when no thresholds are configured, so
  the default path is unchanged. On failure → `400` + audit, the approval UPDATE
  is not run.
- **Fails closed** like the create path: if the workflow config cannot be loaded
  it returns `503 CONFIG_UNAVAILABLE` rather than silently allowing the approval.

### 5. LOAN creation gate
- `checkLoanGmEnabled()` gated behind `loanGmCreationEnabled` (default `true` =
  current behaviour). When `false` → `400` "Loan GM terms workflow not enabled
  yet." (`code: LOAN_GM_DISABLED`).

### 6. `created_by_role` capture
- The acting role (`req.user.activeRoleId ?? roleId`) is stored on insert by both
  endpoints in a new nullable `created_by_role` column.

## Files modified
- `shared/gm-sales-constants.ts` — new config keys `accountGmAllowedInitiatorRoles`,
  `gmCreateOverrideRoles`, `loanGmCreationEnabled` (+ defaults + descriptions +
  schema).
- `server/services/gm-sales-audit.ts` — new action constants `gm.type_set`,
  `gm.type_change_denied`, `gm.threshold_validation_failed`,
  `gm.create_unauthorized_attempt`.
- `server/utils/gm-sales-permissions.ts` — `GM_CREATE_ACCOUNT` action key; override
  roles honoured in `resolveAllowedRoles`; optional unauthorized-attempt audit.
- `server/services/gm-create-policy.service.ts` — **new** pure helpers
  `resolveCanonicalGmType`, `checkLoanGmEnabled`, `thresholdsConfigured`,
  `checkGmCreationThreshold`, `getInitialGmDbState`, `recheckGmThresholdAtApproval`.
- `server/gm-pool-routes.ts` — wired `POST /api/gm` + the two gm-pool approval
  re-checks.
- `server/account-routes.ts` — wired `POST /api/account/gm-entries` + the account
  approve re-check.
- `shared/schema.ts` + `server/db/ensure.ts` — `created_by_role text` column
  (schema + runtime `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- `client/src/pages/gm-pool-add-gm.tsx`,
  `client/src/pages/account-gm-entries.tsx` — create/approve mutations now throw
  on non-2xx and surface the backend `error` message (previously a non-2xx was
  silently treated as success).

## DB / config changes
- `ALTER TABLE drm.gm_entries ADD COLUMN IF NOT EXISTS created_by_role text` at
  startup. No existing column or enum altered; no destructive command run.

## Error shape
- The wrapped legacy endpoints continue to return a **string** `error` field
  (`{ error, code, details }`) so the existing FE keeps working; the FE was
  updated to read that message honestly instead of swallowing it.

## Defaults that preserve current behaviour
- `minimumPaymentThresholds = {}` → no threshold enforcement.
- `loanGmCreationEnabled = true` → LOAN creation allowed.
- Initiator role lists default to today's effective roles; override roles keep
  `admin` / `super_hod` working.

## Tests run
- `npm run check` — 0 errors.
- App boots (`Start application` workflow).
- Smoke tests — see the task summary.
