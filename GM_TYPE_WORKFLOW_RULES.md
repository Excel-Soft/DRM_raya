# GM Type Workflow Rules (Patch 5 Stage 2)

Canonical rules for how a GM's **type** is determined, who may create it, and how
the optional payment threshold is enforced. These rules are a thin wrapper over
the two existing GM-create paths and are config-driven; with the default config
they do not change current behaviour.

## Canonical GM types
| Canonical | `/api/gm` `loanMode` | Account flags (`is_loan` / `is_partial_payment`) | DB `gm_type` |
|-----------|----------------------|--------------------------------------------------|--------------|
| `FULL`    | `none`               | `0 / 0`                                           | `GM` (unchanged) |
| `PARTIAL` | `installment`        | `0 / 1`                                           | `GM` (unchanged) |
| `LOAN`    | `loan`               | `1 / 0`                                           | `GM` (unchanged) |

- Type may also be supplied explicitly as `canonicalGmType` (`FULL` / `PARTIAL` /
  `LOAN`); explicit value wins.
- The canonical type is **stored using the existing flag columns** (via
  `mapGmTypeToDbFlags`). The DB `gm_type` enum value stays `'GM'`.
- Missing → `400 GM_TYPE_REQUIRED`. Invalid/unknown → `400 GM_TYPE_INVALID`.
  Ambiguous flags (both `is_loan` and `is_partial_payment` truthy) **fail closed**
  with `400 GM_TYPE_INVALID` ("a GM cannot be both LOAN and PARTIAL") rather than
  being silently resolved by precedence.

## Who may create a GM
Resolution order for each create endpoint:
1. `admin` always bypasses.
2. Roles in `gmCreateOverrideRoles` (default `["admin","super_hod"]`) may create
   any type; the creation is audited as an override.
3. Otherwise the request must come from an allowed initiator role for that
   endpoint/type:

| Endpoint | Action key | Allowed-initiator config | Default |
|----------|-----------|--------------------------|---------|
| `POST /api/gm` (FULL)    | `gm.create` | `fullGmAllowedInitiatorRoles`    | `["sales_executive"]` |
| `POST /api/gm` (PARTIAL) | `gm.create` | `partialGmAllowedInitiatorRoles` | `["sales_executive"]` |
| `POST /api/gm` (LOAN)    | `gm.create` | `loanGmAllowedInitiatorRoles`    | `["sales_executive"]` |
| `POST /api/account/gm-entries` | `gm.create.account` | `accountGmAllowedInitiatorRoles` | `["account_manager","hod","super_hod","sales_manager"]` |

Unauthorized attempts → `401` / `403` and are audited
(`gm.create_unauthorized_attempt`).

## LOAN gate
- Controlled by `loanGmCreationEnabled` (default `true`).
- When `false`, creating a LOAN GM returns `400 LOAN_GM_DISABLED` ("Loan GM terms
  workflow not enabled yet."). FULL/PARTIAL are unaffected.

## Minimum payment thresholds
- Config: `minimumPaymentThresholds[gmType][packageKey] = number (USD)`.
- Compared amount: `customerDollar` on `/api/gm`, `amountUsd` on the account path.
- **Default `{}` ⇒ no enforcement** (every create passes).
- If a threshold exists and the amount is below it → `400 MINIMUM_PAYMENT_NOT_MET`
  with `details: { gmType, packageType, amount, threshold }`.
- **Re-checked at approval** on `hod-approve`, `account-manager-approve`, and the
  account `approve` transition. The re-check short-circuits (no DB read, no
  behaviour change) when no thresholds are configured.

## Audit actions (added this stage)
- `gm.type_set` — canonical type recorded after a successful create.
- `gm.type_change_denied` — a requested type change was rejected.
- `gm.threshold_validation_failed` — create/approval blocked by a threshold.
- `gm.create_unauthorized_attempt` — a create was attempted without permission.

## `created_by_role`
- The acting role at creation time is stored in `drm.gm_entries.created_by_role`
  (nullable `text`). Informational/audit only; it does not gate any later step.

## Initial DB state (unchanged)
- Every GM type still writes `status = 'Pending'`, `approval_status =
  'pending_hod'`. The richer canonical workflow stage is exposed by
  `getInitialGmDbState()` for audit/forward-compat only and is **not** written.
