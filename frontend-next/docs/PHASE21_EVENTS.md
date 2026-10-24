# Phase 21 — Events module

Migrated legacy Vite pages to Next.js under `/dashboard/events/*`.

| Legacy | Next |
|--------|------|
| `/events/add` | `/dashboard/events/add` |
| `/events/menu` | `/dashboard/events/menu` |
| `/events/duty-planner` | `/dashboard/events/duty-planner` |

- Views: `src/modules/events/*-view.tsx` (API parity with `/api/events/*`).
- Nav: `events-routes.ts`, sidebar shows all three items as **NEXT**.
- Guard: `ROUTE_PERMISSIONS["/events"]` matches legacy `route-registry.ts` roles.
- Dev: `instant = false` on events layout + pages (client-heavy forms).
- UI: emerald/zinc — `PageHeader`, `DrmSection`, `DrmInlineActions`, `Field` + `drmFieldClass`, `DataTable` (`events-ui.tsx` shared helpers).
