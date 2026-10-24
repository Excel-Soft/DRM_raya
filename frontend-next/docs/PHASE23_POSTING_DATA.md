# Phase 23 — Posting Data module

All seven legacy sidebar items migrated to `/dashboard/posting-data/*`.

| Legacy | Next |
|--------|------|
| `/posting-data/add-products` | `/dashboard/posting-data/add-products` |
| `/posting-data/add-keywords` | `/dashboard/posting-data/add-keywords` |
| `/posting-data/view-keywords` | `/dashboard/posting-data/view-keywords` |
| `/posting-data/view-products` | `/dashboard/posting-data/view-products` |
| `/posting-data/data-verify` | `/dashboard/posting-data/data-verify` |
| `/posting-data/link-report` | `/dashboard/posting-data/link-report` |
| `/posting-data/restricted-keywords` | `/dashboard/posting-data/restricted-keywords` |

Also redirects: `/posting-data` → add-products; `/posting-data/keywords` → view-keywords; `/posting-data/verified` → view-products; `/team-report/link-report` → link-report.

- Views: `src/modules/posting-data/posting-data-core.tsx` (six screens), `link-report-view.tsx` (team-report API).
- Shell: `PostingDataShell` + `PageHeader` per route; layout `instant = false`.
- Nav: `posting-data-routes.ts`, full sidebar children in `navigation-config.ts`.
- Guard: existing `ROUTE_PERMISSIONS["/posting-data"]` (via `toLegacyGuardPath` on dashboard URLs).

UI: all screens use `DrmSection`, `Field` + `drmFieldClass`, `DataTable`, `PdStatTile` (add products), emerald primary buttons — aligned with Target System / Events.
