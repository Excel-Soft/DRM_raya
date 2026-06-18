# Patch 5 — Stage 1 Foundation Changelog

GM/Sales Workflow **foundation only**. No existing business workflow, approval
logic, role, permission, UI, API behaviour or DB business structure was changed.
New code is additive and (except for the admin config endpoints) is **not yet
wired** into existing GM/invoice routes — that happens in later, management-
confirmed stages.

## Files added
- `shared/gm-sales-constants.ts` — canonical Patch 5 enums (GM type, invoice type,
  GM workflow stages, invoice statuses, project initial statuses, invoice
  generation timing), the existing DB enum values, fallback-safe mapping helpers,
  Zod schemas, the config schema and the safe default config.
- `server/utils/api-response.ts` — `{ success, error: { code, message, details } }`
  envelope helpers (`errorEnvelope`, `successEnvelope`, `sendError`, `sendSuccess`,
  `zodIssues`). For new / Patch 5 routes only.
- `server/services/gm-sales-config.service.ts` — owns `drm.gm_sales_workflow_config`
  (idempotent ensure + seed; `getConfig`, `getConfigValue`, `patchConfig`).
- `server/services/gm-sales-audit.ts` — `GM_SALES_AUDIT_ACTIONS` (controlled action
  strings), `recordGmSalesAudit()` and `auditActorFromReq()`.
- `server/services/gm-sales-validation.service.ts` — 10 pure validation functions.
- `server/validators/gm.validators.ts`, `payment.validators.ts`,
  `project-routing.validators.ts` — Zod schemas (new).
- `server/utils/gm-sales-permissions.ts` — `requireGmSalesActionPermission()` +
  `GM_SALES_ACTION_KEYS`.
- `server/routes/gm-sales-workflow-routes.ts` — admin-only config API.

## Files modified (non-breaking, additive only)
- `server/services/activity-service.ts` — `recordAuditLog()` gains an optional
  `activeRole` field, serialized into the `details` JSON (no DB column change).
- `server/services/audit-log.service.ts` — `AuditLogInput` gains optional
  `activeRole`.
- `server/validators/invoice.validators.ts` — **appended** Patch 5 schemas
  (`manualInvoicePayloadSchema`, `invoiceApprovalReadinessSchema`,
  `invoicePaymentReadinessSchema`). All previously-exported workflow schemas are
  unchanged.
- `server/routes.ts` — imports and mounts the new router at
  `/api/gm-sales-workflow`.

## DB / config changes
- New table `drm.gm_sales_workflow_config` (key/value): `key TEXT PK`,
  `value JSONB`, `description TEXT`, `updated_by VARCHAR`, `updated_at TIMESTAMPTZ`.
  Created and seeded at runtime via `CREATE TABLE IF NOT EXISTS` +
  `INSERT ... ON CONFLICT DO NOTHING` (repo-wide `db:push` is broken). No existing
  table or enum was altered. No destructive command was run.
- Seeded with the safe defaults in `GM_SALES_WORKFLOW_CONFIG.md`.

## Validators added
`validateGmCreatePayload`, `validateGmType`, `validateMinimumPaymentThreshold`,
`validatePartialReceiptPayload`, `validateLoanGmTerms`, `validateManualInvoicePayload`,
`validateInvoiceApprovalReadiness`, `validateInvoicePaymentReadiness`,
`validateInvoiceToProjectPayload`, `validateProductPostingDependency`.
All are pure, return `{ ok, code?, message?, details? }`, never throw on bad input,
and are **not** attached to existing routes in this stage.

## Permission helper added
`requireGmSalesActionPermission(actionKey, options)` — Express middleware. Static
baseline role map + config-driven initiator roles for GM-create / manual-invoice;
optional ownership/status callbacks. Fails closed (401 / 403 / 503). `admin`
bypasses. Action keys live in `GM_SALES_ACTION_KEYS`. Used only on the new admin
endpoints this stage.

## Audit behaviour
Reuses the existing `AuditLogService` / `drm.activity_logs` (no new table). Added an
optional `activeRole` field (into `details` JSON). `recordGmSalesAudit()` enforces a
controlled action vocabulary and derives the actor/role from the request
(`req.user.activeRoleId ?? req.user.roleId`). Config updates are audited via
`gm_sales.config_update`.

## Management confirmations still pending
These remain at their behaviour-preserving defaults until management confirms (see
`PATCH5_MANAGEMENT_CONFIRMATION_REQUIRED.md`):
- `serviceExecutiveCanCreateGM` (default false)
- `serviceExecutiveCanCreateManualInvoice` (default false)
- `gmInvoiceGenerationTiming` (default ON_GM_CREATION; AFTER_FINAL_GM_APPROVAL supported)
- `requireProductPostingWaitForListingQa` (default false)
- `verificationManagerRequiredAfterQa` (default true — current behaviour)
- `defaultProjectStatusAfterInvoiceApproval` (default ACTIVE)
- `minimumPaymentThresholds` (default empty = no enforcement)
- `full / partial / loanGmAllowedInitiatorRoles` (default `["sales_executive"]`)
- Project initial statuses `DOCUMENTS_PENDING` / `PENDING_PROJECT` have no DB enum
  value yet and would require a confirmed schema change before use.

## Tests run
- `npm run check` — 0 errors.
- App boots (`Start application` workflow).
- Smoke tests — see the final task summary.
