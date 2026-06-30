# Service Bridge Decision (Patch 6 — Stage 5)

How the Service module hands a service record off to GM, VAS and BV, why every
bridge is **disabled by default**, and why the GM bridge is **link-only**.

## TL;DR
- Three bridges: `POST /api/service/gm`, `POST /api/service/vas`,
  `POST /api/service/bv`.
- All three are **config-gated and OFF by default**. While disabled they return
  **403 `{"error":"Service bridge is not enabled"}`** — never a user-facing 501.
- **BV** and **VAS** create a *real* linked report through the **canonical
  repository** the BV/VAS routes already use. **GM** is **link-only**: it records
  the linkage (and can attach to an existing GM entry) but does **not** fork the
  GM financial-creation pipeline.
- Every successful bridge writes a row in `drm.service_bridge_links`, with a
  unique index that blocks a second *active* link per `(service record, target)`.

## Why disabled by default
Cross-module creation (especially GM, which is financial) is a management
decision, not a developer default. The flags live in
`drm.service_bridge_config` and default to `false`
(`SERVICE_BRIDGE_CONFIG_DEFAULTS`). Turning one on is an explicit, admin-only,
audited config change. This satisfies the Patch 6 "management confirmation
required" constraint and keeps the imported app behaving exactly as before until
someone deliberately opts in.

| Flag (config key) | Gates | Default |
| --- | --- | --- |
| `serviceBridgeGmEnabled` | `POST /api/service/gm` | `false` |
| `serviceBridgeVasEnabled` | `POST /api/service/vas` | `false` |
| `serviceBridgeBvEnabled` | `POST /api/service/bv` | `false` |

Read effective values via `getConfigValue(key)`; update them (admin-only) via
`patchConfig()` in `server/services/service-bridge-config.service.ts`.

## Endpoint contract
1. **Auth** — no `req.user` ⇒ **401** `{"error":"Not authenticated"}`.
2. **Gate** — flag off ⇒ **403** `{"error":"Service bridge is not enabled"}`.
3. **Enabled** ⇒ run the orchestrator, return **201**
   `{"success":true, link, target, supersededLinkId?}`.
4. **Errors** — `ServiceBridgeError` is mapped to its `{status, code, error}`
   envelope via `mapServiceBridgeError`; anything else falls through to the
   shared `sendError`.

The raw `req.body` is **never** persisted directly. Each orchestrator forwards
only schema-validated fields to the canonical repository (the repos' zod insert
schemas strip unknown keys), and `customerId` is taken **authoritatively from the
service record**, so the caller cannot spoof it.

## Why BV / VAS are "real" but GM is "link-only"
- **BV** uses `bvReportsRepository.create(userId, payload)` and **VAS** uses
  `vasReportsRepository.create(userId, payload)` — the *exact* code paths their
  own routes use. Reusing the repository means **zero duplicated business logic**
  and full validation, so enabling these bridges produces a genuine, correct
  linked report.
- **GM has no reusable creator.** The canonical GM entry is produced by a large,
  response-interleaved, test-less route handler in `gm-pool-routes.ts` (≈440
  lines) that mixes validation, financial math, status history and side-effects
  with the HTTP response. The hard constraint for this task is **do not rewrite
  working services**. Forking or extracting that pipeline under time pressure
  would risk the financial core. Therefore the GM bridge **records the linkage**
  and, when the caller passes an existing `gmRecordId`/`gmId`, **links to that
  already-created GM entry** (validated to exist). GM creation itself stays owned
  by the GM module.

### GM handoff states (in the link row metadata)
- `handoff: "linked"` — the bridge attached the service record to an existing,
  validated GM entry (`target_record_id` set).
- `handoff: "pending_gm_creation"` — the bridge recorded intent; the GM entry is
  still to be created in the GM module (`target_record_id` null).

> **DRIFT (explicit):** the plan's T004 acceptance ("enabled GM creates a real
> `gm_entry` via canonical logic") is intentionally **not** met. The GM bridge is
> link-only by design, to honour the higher-priority "do not rewrite working
> services" / "no destructive change to the financial pipeline" constraints. BV
> and VAS meet their "real create" acceptance. If a reusable, tested GM creator is
> later extracted, `bridgeToGm` can call it without changing the route or config
> contract.

## The link table — `drm.service_bridge_links`
Created at runtime (`ensureBridgeLinksTable`) because repo-wide `db:push` is
broken on a pre-existing FK mismatch.

| Column | Notes |
| --- | --- |
| `id` | uuid PK, `gen_random_uuid()` |
| `service_record_id` | `service_customers.id` (source) |
| `target_module` | `gm` \| `vas` \| `bv` |
| `target_record_id` | created/linked report or GM id (nullable for pending GM) |
| `status` | `active` (default) \| `superseded` |
| `created_by` | actor user id |
| `override_reason` | reason captured when replacing an existing active link |
| `metadata` | jsonb (source module, ids, GM handoff state) |
| `created_at` / `updated_at` | timestamptz |

**Duplicate guard.** A unique partial index
`uq_service_bridge_active (service_record_id, target_module) WHERE status='active'`
permits at most one active link per target. Creating another active link for the
same target requires an **override**, which needs **both** a managerial role
**and** a non-empty `overrideReason`; the prior link is then marked
`superseded`. Missing reason ⇒ 400 `OVERRIDE_REASON_REQUIRED`; non-managerial ⇒
403 `OVERRIDE_FORBIDDEN`; no override flag ⇒ 409 `BRIDGE_EXISTS`.

## Bridge reports (read side — Patch 7 Stage 4)
The write endpoints above are config-gated; the **read** endpoints are not.
`GET /api/service/{gm,vas,bv}-report` query `drm.service_bridge_links` (joined to
the source service record and LEFT-joined to the canonical target table) so a
disabled bridge blocks **creation** while previously-linked history stays
**viewable and auditable**. They are auth-protected, row-scoped via
`scopedUserIds`, return `{targetModule, items, summary}` (empty ⇒ `200` zeroed,
never 501), show GM `pending_gm_creation` links honestly, and fall back to a
links-only view if a target table has drifted. Full contract in
`SERVICE_REPORT_UPDATE_HOOKS.md`.

## Audit & notification
Every successful bridge records an audit event
(`service_bridge.<target>.create`) via `AuditLogService` and notifies the
Accounts and HOD roles via `NotificationService`. Both are **best-effort** and
never throw to the caller, so a logging/notify hiccup can't fail a committed
bridge.

## Files
- `shared/service-bridge-constants.ts` — flags, defaults, target↔flag map,
  disabled message, zod patch schema.
- `server/services/service-bridge-config.service.ts` — `drm.service_bridge_config`
  (ensure/seed, getConfig/getConfigValue, admin patchConfig).
- `server/services/service-bridge.service.ts` — `drm.service_bridge_links`,
  duplicate guard, `bridgeToBv` / `bridgeToVas` (real) and `bridgeToGm`
  (link-only), audit + notify.
- `server/service-core-routes.ts` — the three config-gated POST endpoints.
