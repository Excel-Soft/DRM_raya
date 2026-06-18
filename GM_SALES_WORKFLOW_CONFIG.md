# GM / Sales Workflow Configuration

Patch 5 introduces a safe, admin-controlled configuration source for GM/Sales
workflow rules. Values are stored in the `drm.gm_sales_workflow_config` key/value
table and read through `server/services/gm-sales-config.service.ts`. Defaults are
defined in `shared/gm-sales-constants.ts` (`GM_SALES_CONFIG_DEFAULTS`).

The table is created and seeded **idempotently at runtime**; existing values are
never overwritten on redeploy.

## Endpoints (admin-only)

| Method | Path                              | Purpose                       |
| ------ | --------------------------------- | ----------------------------- |
| GET    | `/api/gm-sales-workflow/config`   | Read the effective config     |
| PATCH  | `/api/gm-sales-workflow/config`   | Update one or more config keys |

Both require the `admin` role. They are mounted under the global `/api` auth
middleware, so a valid session is always required. All responses use the envelope
`{ success, data }` or `{ success: false, error: { code, message, details } }`.

`PATCH` accepts a partial object of the keys below; unknown keys are rejected
(`CONFIG_VALIDATION_FAILED`). Each change is audited (`gm_sales.config_update`).

## Config keys, types and defaults

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `serviceExecutiveCanCreateGM` | boolean | `false` | Until management confirms. |
| `serviceExecutiveCanCreateManualInvoice` | boolean | `false` | Until management confirms. |
| `gmInvoiceGenerationTiming` | `ON_GM_CREATION` \| `AFTER_FINAL_GM_APPROVAL` | `ON_GM_CREATION` | Preserves current behaviour; both supported. |
| `requireProductPostingWaitForListingQa` | boolean | `false` | If true, product posting waits for Listing-Page QA. |
| `verificationManagerRequiredAfterQa` | boolean | `true` | Reflects current product-posting behaviour. |
| `defaultProjectStatusAfterInvoiceApproval` | `ACTIVE` \| `DOCUMENTS_PENDING` \| `PENDING_PROJECT` \| `IN_EXECUTION` | `ACTIVE` | Preserves current behaviour. |
| `minimumPaymentThresholds` | `{ [gmType]: { [package]: number } }` | `{}` | Empty = no enforcement. |
| `fullGmAllowedInitiatorRoles` | string[] | `["sales_executive"]` | Roles allowed to initiate FULL GM. |
| `partialGmAllowedInitiatorRoles` | string[] | `["sales_executive"]` | Roles allowed to initiate PARTIAL GM. |
| `loanGmAllowedInitiatorRoles` | string[] | `["sales_executive"]` | Roles allowed to initiate LOAN GM. |

## Minimum payment threshold enforcement

`minimumPaymentThresholds` is a nested map keyed by GM type then package, e.g.:

```json
{ "PARTIAL": { "Gold": 500, "Silver": 250 } }
```

Enforcement is **presence-based**: if there is no entry for a given
`(gmType, package)`, no minimum is enforced (current behaviour). When an entry
exists and the amount is below it, `validateMinimumPaymentThreshold()` returns
`MINIMUM_PAYMENT_NOT_MET`. There is intentionally no global "enforcement enabled"
flag — an empty map disables enforcement entirely.

## Example PATCH

```bash
curl -X PATCH "$BASE/api/gm-sales-workflow/config" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "gmInvoiceGenerationTiming": "AFTER_FINAL_GM_APPROVAL" }'
```

## Reading config in code

```ts
import { getConfig, getConfigValue } from "../services/gm-sales-config.service";

const { config } = await getConfig();
const timing = await getConfigValue("gmInvoiceGenerationTiming");
```
