# PATCH 6 — Action Permission Matrix

Single source of truth for backend **action permissions** enforced by
`requireActionPermission` (`server/middleware/action-permission.ts`), driven by
the registry in `server/config/action-permissions.ts`.

## How the guard resolves access

For a given `actionKey`, the guard merges the registry policy with any explicit
call-site options (**options win**), then enforces, in order:

1. **Authentication** — no `req.user` → **401** (audited if `audit`/`auditDenied`).
2. **Role gate** — if a role constraint is configured (`roles` and/or
   `allowRole`), the caller's *normalized* active role must satisfy it, **or**
   `adminOverride` must be set and the caller is a normalized `admin`.
   Otherwise → **403** (audited).
3. **Predicate gate** (code-only; never from the registry) — ownership /
   stage-status / segregation-of-duties. Fails **closed**. `adminOverride` does
   **not** bypass this gate.

If no role constraint and no predicate are configured, the action is
**authenticated-only** (unchanged behavior).

- Role comparison uses `normalizeRole()` on both sides (so `super_admin` /
  `administrator` collapse to `admin`, etc.).
- `adminOverride` defaults to **false** → least-privilege by default; admin is
  granted only where a policy explicitly opts in.
- Denied attempts (401/403) are recorded best-effort (`AuditLogService`, never
  throws) when `audit: true`, under action `"<key>.denied"`.

Role groups used below:
- **FULL_ACCESS** = `admin`, `super_hod`
- **INVOICE_WRITE** = `admin`, `account_manager`
- **SERVICE_WRITE** = `isServiceWriteRole` = any managerial role (service
  manager / assistant manager, HOD, super HOD, admin) **plus** `service_executive`
  (managerial set excludes executives, so the service executive is added back).

---

## Newly registered actions (this patch)

| Action key | Module | Allowed roles | adminOverride | Audit (denied) | Enforced at |
|---|---|---|---|---|---|
| `attributes.view` | attributes | *authenticated-only* | n/a | no | `GET /api/attributes/:category` |
| `attributes.create` | attributes | FULL_ACCESS | yes | yes | `POST /api/attributes` |
| `attributes.delete` | attributes | FULL_ACCESS | yes | yes | `DELETE /api/attributes/:id` |
| `invoice.update` | account | INVOICE_WRITE | yes | yes | `PATCH /api/account/invoices/:id` |
| `invoice.update_status` | account | INVOICE_WRITE | yes | yes | `PATCH /api/account/invoices/:id/status` |
| `invoice.delete` | account | INVOICE_WRITE | yes | yes | `DELETE /api/account/invoices/:id` |
| `service.followup.create` | service | SERVICE_WRITE | yes | yes | `POST /api/service/followups` |
| `service.followup.complete` | service | SERVICE_WRITE | yes | yes | `PATCH /api/service/followups/:id/complete` |
| `service.complaint.create` | service | SERVICE_WRITE | yes | yes | `POST /api/service/complaints` |
| `service.complaint.update` | service | SERVICE_WRITE | yes | yes | `PATCH /api/service/complaints/:id` |
| `service.complaint.assign` | service | SERVICE_WRITE | yes | yes | `PATCH /api/service/complaints/:id/assign` |
| `service.complaint.resolve` | service | SERVICE_WRITE | yes | yes | `PATCH /api/service/complaints/:id/resolve` |
| `service.complaint.close` | service | SERVICE_WRITE | yes | yes | `PATCH /api/service/complaints/:id/close` |
| `service.complaint.reopen` | service | SERVICE_WRITE | yes | yes | `PATCH /api/service/complaints/:id/reopen` |
| `service.dropout.create` | service | SERVICE_WRITE | yes | yes | `POST /api/service/dropouts` |
| `service.dropout.recover` | service | SERVICE_WRITE | yes | yes | `PATCH /api/service/dropouts/:id/recover` |
| `service.renewal.create` | service | SERVICE_WRITE | yes | yes | `POST /api/service/renewals` |

All of the above sit **behind** the global auth chain (auth → IP → URL
permission) before the per-action guard runs.

---

## Already-guarded actions — intentionally NOT duplicated in the registry

These actions already have dedicated, audited guards. Re-encoding their role
maps in the registry would risk drift that silently breaks live workflows, so
they are **documented here and left as-is** (no behavior change in this patch).

| Domain | Existing guard | Notes |
|---|---|---|
| GM sales create | `requireGmSalesActionPermission` (`utils/gm-sales-permissions`) | Config-backed GM sales action keys + `recordGmSalesAudit`. |
| Office / Accounts writes | `requireFinancialPermission` (`middleware/financial-permission`) | `FINANCIAL_ACTIONS`; this wrapper calls `requireActionPermission` with explicit roles, so the registry does not affect it. |
| Reports export / finalize | `requireReportPermission` (`middleware/report-permission`) | Report action gating. |
| Penalty create / decide / void / delete | Handler-level `canCreate` / `canDecide` / `canVoid` + `recordAuditLog` | Already fully role-gated **and** audited, including segregation-of-duties (cannot decide your own). Left untouched. |

---

## Backward compatibility

`requireActionPermission` keeps its original signature
`(actionKey, options?)`. The eight pre-existing importers (users, loan, leave,
overtime, attendance, DRM routes, plus the financial/report wrappers) pass their
own `roles`/`allowRole` explicitly, which **override** the registry — so their
behavior is unchanged. New code should import from
`server/middleware/action-permission.middleware.ts` (a one-way re-export; no new
implementation, no circular import).
