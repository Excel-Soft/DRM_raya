# Service-Executive GM / Manual-Invoice Permission Matrix

**Patch 5 Stage 7 (P13).** This documents the *current, enforced* server-side
authorization for GM creation and manual-invoice creation, as covered by
`server/patch5-stage7-role-matrix.test.ts`. Stage 7 added **no new transition
logic** — it documents and tests the gates already wired in earlier patches and
makes the two Service-Executive switches discoverable to the UI via
`GET /api/gm-sales-workflow/ui-config`.

The server is always the source of truth. The frontend gating added in Stage 7
(hiding the Add-GM / manual-invoice surfaces for a Service Executive when the
flags are off) is convenience only; the endpoints below re-check on every call.

## Config flags (admin-managed, `drm.gm_sales_workflow_config`)

| Flag | Default | Effect |
| --- | --- | --- |
| `serviceExecutiveCanCreateGM` | `false` | When on, a `service_executive` may create GMs via `POST /api/gm`. |
| `serviceExecutiveCanCreateManualInvoice` | `false` | When on, a `service_executive` may create manual invoices via `POST /api/invoices`. |

## `POST /api/gm` — GM creation

Guard: `requireGmSalesActionPermission(GM_CREATE)` (coarse entry gate = union of
all per-type initiator lists), then a per-type narrow check once the canonical
type (FULL / PARTIAL / LOAN) is resolved. Default initiator config:
`full/partial/loanGmAllowedInitiatorRoles = [sales_executive]`,
`gmCreateOverrideRoles = [admin, super_hod]`.

| Role | Result (default config) | Notes |
| --- | --- | --- |
| `admin` | ✅ Allowed | Hard bypass. |
| `super_hod` | ✅ Allowed | Via `gmCreateOverrideRoles`. |
| `sales_executive` | ✅ Allowed | Default initiator for all three types. |
| `service_executive` | ⚙️ Conditional | Allowed **only** when `serviceExecutiveCanCreateGM = true`; else `403`. |
| `sales_manager` | ❌ `403` | Not a FULL/PARTIAL/LOAN initiator on this route. |
| `hod` | ❌ `403` | Creates Account GMs via the account route, not this one. |
| `account_manager` | ❌ `403` | Creates Account GMs via the account route, not this one. |
| _(unauthenticated)_ | ❌ `401` | Never a silent `404`/`200`. |

> Account GMs use a separate route guarded by `GM_CREATE_ACCOUNT`
> (`accountGmAllowedInitiatorRoles = [account_manager, hod, super_hod,
> sales_manager]`). That route is out of scope for this matrix.

## `POST /api/invoices` — manual invoice creation

Guard: `requireManualInvoiceCreator()` (no `extraAllowedRoles` on this route).
Always admits `admin`, `sales_executive`, `sales_manager`.

| Role | Result | Notes |
| --- | --- | --- |
| `admin` | ✅ Allowed | |
| `sales_executive` | ✅ Allowed | |
| `sales_manager` | ✅ Allowed | |
| `service_executive` | ⚙️ Conditional | Allowed **only** when `serviceExecutiveCanCreateManualInvoice = true`; else `403`. |
| `hod` | ❌ `403` | |
| `account_manager` | ❌ `403` on `/api/invoices` | Admitted on the **account** invoice route via `extraAllowedRoles: [account_manager]`. |
| _(unauthenticated)_ | ❌ `401` | Never a silent `404`/`200`. |

## Fail-closed guarantees

- If the workflow config cannot be loaded, both guards fail **closed**
  (`503 CONFIG_UNAVAILABLE`), never open.
- Every Service-Executive denial is recorded as a GM/Sales audit event.
- Admitted roles that send an incomplete body fail later with `400` validation —
  they are *not* `403`, which is exactly how the tests distinguish "passed the
  permission gate" from "blocked by it".

## Frontend (convenience only)

- `useServiceExecutiveCreateGates()` reads `ui-config` + the caller's role and
  returns `{ canCreateGm, canCreateManualInvoice }`. Always-allowed roles bypass.
- The Add-GM toggle in the GM pool is hidden when `canCreateGm` is false.
- A Service Executive has no manual-invoice creation surface in the UI today
  (the product-posting sales widget excludes the role, and `/account/invoices` is
  account-only), so no manual-invoice button needed hiding.
