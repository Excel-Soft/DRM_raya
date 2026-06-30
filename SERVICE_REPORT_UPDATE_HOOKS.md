# Service Report & Dashboard Update Hooks (Patch 7 — Stage 4)

How a service record's outbound bridges (GM / VAS / BV) and lifecycle activity
flow into the **reports** and **dashboards**, and exactly which dashboard numbers
are real vs. an honest `0`. This is the read-side companion to
`SERVICE_BRIDGE_DECISION.md` (the write side).

## Two sides of the same data

```
                 WRITE side (config-gated, OFF by default)
service record ──POST /api/service/{gm,vas,bv}──▶ canonical repo (BV/VAS)  ─┐
                                                  + link row in            │
                                                  drm.service_bridge_links │
                                                                           ▼
                 READ side (always viewable, NOT config-gated)   reports & dashboards
service bridge reports ◀──GET /api/service/{gm,vas,bv}-report──── drm.service_bridge_links
manager dashboard      ◀──GET /api/service/manager/*──────────── links + renewals + activities
```

**Key rule:** disabling a bridge blocks **creation** (the POST routes return
`403 "Service bridge is not enabled"`), but **never hides history**. Every read
endpoint stays open so previously-bridged records remain auditable even after a
flag is switched off.

## Bridge report endpoints (read-only)

| Endpoint | Source |
| --- | --- |
| `GET /api/service/gm-report` | `service_bridge_links` (target `gm`) ⟕ `gm_entries` |
| `GET /api/service/vas-report` | `service_bridge_links` (target `vas`) ⟕ `vas_reports` |
| `GET /api/service/bv-report` | `service_bridge_links` (target `bv`) ⟕ `bv_reports` |

Each joins the link row to its **source** service record + company
(`service_customers` ⟕ `customers`) and **LEFT JOINs** the canonical target
record. Response shape:

```jsonc
{
  "targetModule": "gm" | "vas" | "bv",
  "items": [ /* link rows + service + target fields */ ],
  "summary": { "total", "active", "superseded",
               /* gm:  */ "linked", "pending", "totalAmountUsd"
               /* vas/bv: */ "totalValueSold" }
}
```

Behaviour and safety:
- **Auth required** (global `/api` middleware) — no token ⇒ `401`.
- **Row-scoped** via `scopedUserIds`: managers see their department's links,
  executives only links they created (`created_by`).
- **GM pending links are shown honestly.** When `target_record_id` is `null`
  (`metadata.handoff = "pending_gm_creation"`) the row appears in `items` and is
  counted in `summary.pending` — never silently dropped or faked as created.
- **Per-target try/catch.** The canonical join runs first; if a target table has
  drifted the query degrades to a **links-only** view (logged) instead of `500`.
  All id joins are `::text`-cast (`service_bridge_links` ids are `varchar`,
  `service_customers`/`customers` ids are `uuid`).
- **No 501, ever.** Empty data returns `200` with `items: []` and a zeroed
  summary — never a stub message.

## Manager dashboard — real vs. honest zero

`server/service-manager-routes.ts`. Only metrics with a real source table are
computed; opaque metrics stay `0` rather than carry an invented formula.

| Endpoint / field | Status | Source |
| --- | --- | --- |
| `manager/stats.totalRevenue` | **real** | `SUM(service_renewals.amount)` |
| `manager/stats.{new,renew,vm,kwa,psa,sponsorBrand}` | honest `0` | no defensible service-scoped source |
| `manager/stats.{expire,inService}` | real | dynamic expiry over `service_customers` |
| `manager/queue-performance[].{gm,bv}` | **real** | active `service_bridge_links` per `created_by` |
| `manager/queue-performance[].{total,target,achieve,remain,aMinus,prediction}` | honest `0` | no service-scoped target source yet |
| `manager/current-month-graph[].count` | **real** | daily `service_activities` count for the month |
| `manager/team-work-performance` | honest `0` | no consolidated source table |

Executive dashboard (`service-executive-routes.ts`) is unchanged: its
`vm/kwa/psa/sponsorBrand` likewise stay honest `0`; `new/renew/expire/inService`
derive from the executive's own `service_customers` via dynamic expiry, and the
activities/targets/appointments endpoints already read real data.

> **Why honest zero, not a guessed formula.** `vm/kwa/psa/sponsorBrand`,
> per-user `target/achieve/prediction`, and the team-work rollup have no
> authoritative source table in the imported schema. Inventing a derivation would
> be a *fake* metric. Per the "no fake success" constraint they remain `0` until a
> real source is defined — at which point only the computation here changes, not
> the endpoint contract.

## Files
- `server/service-core-routes.ts` — the three `*-report` read endpoints +
  `serviceBridgeReport` helper, `summarizeBridgeReport`, `emptyBridgeSummary`.
- `server/service-manager-routes.ts` — defensible dashboard computations.
- `server/services/service-bridge.service.ts` — `drm.service_bridge_links` (the
  shared source for both write and read sides).
