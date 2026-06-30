# Patch 7 — Stage 4: Service & Communication Closure (Changelog)

Gap-closure stage, not a rebuild. ~90% of the Service Bridge / Service Lifecycle
/ Communication surface already shipped under "Patch 6 — Stage 5". Stage 4 closed
the remaining **genuine** gaps (report endpoints that were stubs, dashboard
metrics that returned nothing) and documented the result. No business workflow,
approval logic, role, permission, UI contract, or DB business structure changed.

## What already existed (verified, unchanged)
- **Bridge config** — `shared/service-bridge-constants.ts` (flags default
  `false`), `server/services/service-bridge-config.service.ts`.
- **Bridge writes** — `POST /api/service/{gm,vas,bv}` via `runBridge()`:
  `401` unauth / `403` disabled / `201` ok; BV+VAS use canonical repos, GM is
  link-only. Audit + notify, duplicate guard, override rules.
- **Strict validators** — `server/validators/service.validators.ts`,
  `communication.validators.ts` (fail-closed, no silent fallback).
- **Lifecycle state machine** — `server/services/service-lifecycle.service.ts`.
- **Communication model** — `drm.communication_logs` +
  `server/services/communication.service.ts`, timeline + reminders endpoints,
  best-effort logging from existing flows.

## What changed in Stage 4

### 1. Real bridge report endpoints (were stubs)
`server/service-core-routes.ts` — `GET /api/service/{gm,vas,bv}-report` now run
read-only queries over `drm.service_bridge_links` joined to the source service
record (`service_customers` ⟕ `customers`) with a per-target **LEFT JOIN** to the
canonical table (`gm_entries` / `vas_reports` / `bv_reports`).
- `ensureBridgeLinksTable()` runs first; all id joins are `::text`-cast.
- Row-scoped via `scopedUserIds`; **reads are NOT config-gated** — a disabled
  bridge blocks writes only, history stays viewable.
- GM `pending_gm_creation` links are shown honestly (counted in `summary.pending`,
  never faked as created).
- Per-target `try/catch` → degrades to a **links-only** view (logged) instead of
  `500`. Shape `{targetModule, items, summary}`; empty data ⇒ `200` with `items:
  []` + zeroed summary (no 501). `LIMIT 500`.
- Helpers added: `serviceBridgeReport`, `summarizeBridgeReport`,
  `emptyBridgeSummary`; imported `ensureBridgeLinksTable`.

### 2. Defensible dashboard metrics (honest 0 elsewhere)
`server/service-manager-routes.ts` — only metrics with a real source are now
computed:
- `stats.totalRevenue` = `SUM(service_renewals.amount)`.
- `queue-performance[].{gm,bv}` = active `service_bridge_links` per `created_by`.
- `current-month-graph[].count` = daily `service_activities` count for the month.
- `vm/kwa/psa/sponsorBrand`, `prediction`, `aMinus`, `team-work-performance`,
  `new/renew` stay **honest 0** (no defensible source table).
- Imports added: `pool`, `serviceRenewals`, `ensureBridgeLinksTable`.
- Executive dashboard (`service-executive-routes.ts`) untouched; its opaque
  metrics remain honest 0.

### 3. Verification (no code needed)
- **No dead frontend bridge buttons** — the client never calls
  `/api/service/{gm,vas,bv}` or the `*-report` endpoints; the service bridge is
  backend-only by design (config-gated, off by default). The client's
  `gm-report`/`bv-report`/`vas-report` pages are the **canonical** report modules
  (`/api/{gm,bv,vas}-reports`), unrelated to the service bridge.
- **Communication endpoints are real**, not stubs — `reminders/due`,
  `reminders/overdue`, timeline all backed by `CommunicationService`.

## DB changes
**None new.** `drm.service_bridge_links` is created at runtime by
`ensureBridgeLinksTable()` (repo-wide `db:push` is broken on a pre-existing FK
mismatch). No schema migration, no destructive change.

## APIs
- **Modified (stub → real):** `GET /api/service/gm-report`,
  `GET /api/service/vas-report`, `GET /api/service/bv-report`.
- **Modified (empty → defensible):** `GET /api/service/manager/stats`,
  `/api/service/manager/queue-performance`,
  `/api/service/manager/current-month-graph`.
- **Added:** none. **Removed:** none.

## Tests run
- `npm run check` → exit 0 (the prior ~57-error `tsc` baseline is now clean).
- Smoke suite via minted admin JWT against `localhost:5000`
  (`.local/smoke_stage4.mjs`), all passing:
  - reports `200` with `{targetModule, items:[], summary}` (correct per-target
    summary shape); report unauth `401`.
  - bridge writes `403 "Service bridge is not enabled"` (disabled default);
    bridge write unauth `401`.
  - dashboards `200` with honest numbers (revenue 0, queue `[]`, daily graph 0s,
    executive honest 0).
  - validator probe (followup empty body) `400 VALIDATION_ERROR` with
    required-field details.
- Workflow logs clean — GM report first call ran the target-join path (no
  `[ServiceBridgeReport]` fallback), confirming the join SQL is valid against the
  live schema.

## Drift / unresolved
- **GM bridge stays link-only** (carried from Patch 6 Stage 5) — see
  `SERVICE_BRIDGE_DECISION.md`. Honours "do not rewrite working services".
- **Honest-zero metrics** (`vm/kwa/psa/sponsorBrand`, per-user
  `target/achieve/prediction`, team-work rollup) have no authoritative source
  table; left at 0 rather than invented. Only the computation changes when a real
  source is defined.
- **Lifecycle machine is not wired to any route** — there is no status-changing
  endpoint in the imported app; the authority is ready for when one is added.
- Live service tables are currently empty, so smoke tests exercised the
  empty-data and gating paths; the target-join path is confirmed valid via logs.
