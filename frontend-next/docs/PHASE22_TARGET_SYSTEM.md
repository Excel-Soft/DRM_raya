# Phase 22 — Target System module

All six legacy sidebar items migrated to `/dashboard/target-system/*`.

| Legacy | Next |
|--------|------|
| `/target-system/create` | `/dashboard/target-system/create` |
| `/target-system/set` | `/dashboard/target-system/set` |
| `/target-system/view` | `/dashboard/target-system/view` |
| `/target-system/daily` | `/dashboard/target-system/daily` |
| `/target-system/add-kwa` | `/dashboard/target-system/add-kwa` |
| `/target-system/kwa-history` | `/dashboard/target-system/kwa-history` |

- Views: `src/modules/target-system/*-view.tsx` (API parity `/api/target-system/*`).
- Shell: `TargetSystemShell` + `PageHeader` on each page; forms still legacy layout (DrmSection pass later).
- Guard: `ROUTE_PERMISSIONS["/target-system"]` — admin, sales_manager, hod, super_hod, account_manager.
- Menu perm: `menu-perm-roles.ts` excludes sales_assistant_manager from Target System (unchanged).
