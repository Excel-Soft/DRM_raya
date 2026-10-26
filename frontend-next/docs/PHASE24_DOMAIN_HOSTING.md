# Phase 24 — Domain Hosting module

Legacy **Domain Hosting** sidebar (Servers, Domains, Backup) migrated to `/dashboard/it/*`.

| Legacy | Next |
|--------|------|
| `/it/servers` | `/dashboard/it/servers` |
| `/it/domains` | `/dashboard/it/domains` |
| `/it/backup` | `/dashboard/it/backup` |

- Routes: `src/lib/navigation/domain-hosting-routes.ts`
- Views: `src/modules/domain-hosting/it-servers-view.tsx`, `it-domains-view.tsx`, `it-backup-view.tsx`
- Shell: `DomainHostingShell` + `PageHeader`; layout `instant = false` under `src/app/(app)/dashboard/it/`
- Nav: three children (Backup added; was missing in early Next nav)
- Guard: `ROUTE_PERMISSIONS["/it"]` via `toLegacyGuardPath` (`/dashboard/it/servers` → `/it/servers`)
- Dependency: `xlsx` for server/domain export on Servers & Domains screens

UI (Phase 24 theme): all three screens use `DomainHostingShell`, `DrmSection`, `Field` + `drmFieldClass`, `DataTable` (domains + backup), zinc/emerald dialogs via `domain-hosting-shared.tsx` (attribute, quotation, domain form). Servers page: sectioned layout (register domain, domain list, servers, registries, packages) with shared modals.
