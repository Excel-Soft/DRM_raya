# Patch 6 — Stage 5: Service & Communication Changelog

Service → GM/VAS/BV bridges, strict service-lifecycle validators, the central
service-lifecycle state machine, and the (already-built) communication model.
All work is additive, config-gated with safe defaults, and preserves the imported
app's existing behaviour.

## Guiding constraints honoured
- **No user-facing 501** — the three bridge stubs that returned 501 now return a
  proper auth/gate/success contract.
- **Bridges disabled by default** — disabled ⇒ **403 "Service bridge is not
  enabled"**.
- **Do not rewrite working services** — BV/VAS reuse their canonical
  repositories; GM stays owned by the GM module (link-only bridge).
- **No destructive DB** — `db:push` is broken, so new tables/columns are created
  at runtime with `CREATE TABLE / INDEX IF NOT EXISTS`.
- **Never persist raw `req.body`** — only schema-validated fields reach repos;
  `customerId` is taken from the service record.

## Files changed
**New**
- `shared/service-bridge-constants.ts` — bridge flags + defaults (all `false`),
  target↔flag map, disabled message, admin zod patch schema.
- `server/services/service-bridge-config.service.ts` — `drm.service_bridge_config`
  key/value table (ensure/seed, `getConfig`/`getConfigValue`, admin `patchConfig`).
- `server/services/service-bridge.service.ts` — `drm.service_bridge_links` table,
  duplicate-active guard, `bridgeToBv`/`bridgeToVas` (real, via canonical repos),
  `bridgeToGm` (link-only), audit + notify.
- `server/services/service-lifecycle.service.ts` — central service-customer
  lifecycle state machine (validators + orchestrator).
- `server/patch6-stage5-service.test.ts` — 19 unit tests (validators, lifecycle,
  bridge error mapping, config-gate defaults).
- `SERVICE_BRIDGE_DECISION.md`, `SERVICE_LIFECYCLE_STATE_MACHINE.md`, and this
  changelog.

**Modified**
- `server/service-core-routes.ts` — replaced the three `POST /api/service/{gm,vas,bv}`
  501 stubs with a config-gated `runBridge` helper (401 unauth → 403 disabled →
  201 success → `mapServiceBridgeError`/`sendError`); wired the follow-up
  complete, complaint update/resolve/close, and dropout recover endpoints through
  the new Stage-5 validators (response shape preserved).
- `server/validators/service.validators.ts` — appended the Stage-5 schemas:
  `serviceFollowupCompleteSchema`, `serviceComplaintResolveSchema`,
  `serviceComplaintCloseSchema`, `serviceComplaintUpdateSchema`,
  `serviceDropoutRecoverSchema`, `serviceRenewalUpdateSchema` (+ inferred types),
  reusing the existing blank/null preprocess helpers.

## APIs added / modified
| Endpoint | Change |
| --- | --- |
| `POST /api/service/gm` | Was 501 stub → auth + GM-flag gate; enabled = **link-only** GM bridge (links to an existing GM entry or records pending handoff) + link row + audit + notify. |
| `POST /api/service/vas` | Was 501 stub → auth + VAS-flag gate; enabled = **real** VAS report via `vasReportsRepository.create` + link row + audit + notify. |
| `POST /api/service/bv` | Was 501 stub → auth + BV-flag gate; enabled = **real** BV report via `bvReportsRepository.create` + link row + audit + notify. |
| Follow-up complete / complaint update·resolve·close / dropout recover | Now validated by the Stage-5 schemas; **exact** required-field messages and previously-accepted bodies preserved. |

> `GET /api/service/vas-report` and `GET /api/service/bv-report` remain harmless
> **200** message stubs (informational, never 501).

## DB changes (runtime `IF NOT EXISTS`, additive)
- `drm.service_bridge_config (key, value jsonb, description, updated_by,
  updated_at)` — seeded with the three flags (all `false`).
- `drm.service_bridge_links (id, service_record_id, target_module,
  target_record_id, status, created_by, override_reason, metadata jsonb,
  created_at, updated_at)` with unique partial index
  `uq_service_bridge_active (service_record_id, target_module) WHERE status='active'`
  and an index on `service_record_id`.
- **No new columns on `service_customers`; no enum change.** The lifecycle machine
  reuses the existing `drm.service_customer_status` enum and (if/when wired) the
  existing `status` / `status_changed_at` columns.

## Service bridge behaviour
1. Unauthenticated ⇒ **401**.
2. Flag off (default) ⇒ **403 "Service bridge is not enabled"** (no 501).
3. Flag on ⇒ orchestrator runs, returns **201** `{success, link, target,
   supersededLinkId?}`.
4. One **active** link per `(service record, target)`; a second needs an override
   (managerial role + non-empty reason) which supersedes the prior link
   (`BRIDGE_EXISTS` 409 / `OVERRIDE_REASON_REQUIRED` 400 / `OVERRIDE_FORBIDDEN`
   403).
5. BV/VAS create real linked reports via canonical repos; GM is link-only. See
   `SERVICE_BRIDGE_DECISION.md`.

## Lifecycle rules
- Stored enum unchanged: `active, expiring, expired, renewed, upgraded, dropout,
  closed`. 12 logical states map onto it.
- **Permissive by default**: non-canonical moves warn, never reject; all reason
  rules off. Strict + per-rule flags are opt-in (`false` defaults). See
  `SERVICE_LIFECYCLE_STATE_MACHINE.md`.
- `changeServiceCustomerStatus` is the single chokepoint (validate → write →
  audit → notify). Audit/notify are best-effort.

## Communication model
The unified follow-up/communication model (`drm.communication_logs`, channels,
outcomes, reminder queue) was delivered in Stage 7 and is **documented, not
re-implemented**, in `COMMUNICATION_MODEL.md` (verified accurate this stage). No
code change was made to it in this stage.

## Known drift (explicit)
- **GM bridge is link-only**, not a real `gm_entries` creator — deliberate, to
  avoid forking the untested ~440-line GM financial pipeline ("do not rewrite
  working services"). BV/VAS meet the real-create acceptance; GM does not, by
  design.
- **Service-lifecycle state machine is built but unwired** — no existing endpoint
  mutates `service_customers.status`, so there was nothing to route through it.
  It is ready for a future status endpoint; current HTTP outcomes are unchanged.

## Tests
`server/patch6-stage5-service.test.ts` — 19 passing unit tests covering the
Stage-5 validators (exact messages + previously-valid bodies), the lifecycle
transition map / permissive-vs-strict behaviour / logical→status mapping, the
bridge error mapper, and the disabled-by-default config gate.
