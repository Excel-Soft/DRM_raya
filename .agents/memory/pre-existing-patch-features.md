---
name: Patch-stage features often already exist
description: Why you must recon before "implementing" a Patch 3 stage — several were already shipped in an earlier patch.
---

# A "new" Patch stage may already be built

Before building any "PATCH N STAGE X: implement <feature>" request in this repo,
recon first: grep `shared/schema.ts` for the table, `server/*routes*.ts` /
`server/services/*` for the service, and `client/src/pages/**` for the screens.
Several Patch 3 stages describe features that were already delivered end-to-end
in an earlier patch.

**Why:** the Penalty engine ("Patch 3 Stage 6") was already fully implemented as
*Patch 2 Stage 2* — `drm.penalties` table, `penalty.service.ts`,
`penalty-routes.ts` mounted behind auth+URL-permission, and both front-end pages
(`drm/add-penalty.tsx`, `service-add-penalty.tsx`) wired to the live API with no
mock data. Rebuilding would have created a duplicate engine (which the specs
explicitly forbid). Same caution applies to invoices and reports (see
`invoice-tables-dual.md`, `report-authorization-systems.md`).

**How to apply:** treat such specs as reconcile + gap-fill + document tasks.
Diff the spec's required surface (endpoints, query params, columns, audit
actions) against what exists, implement only the genuine gaps additively, and
state plainly in the changelog/summary what already existed vs what you added.
