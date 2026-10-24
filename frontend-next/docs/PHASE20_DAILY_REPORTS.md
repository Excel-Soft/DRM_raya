# Phase 20 — Daily Added GM Report (Next.js)

**Legacy:** `/daily-reports/added-gm`  
**Next:** `/dashboard/daily-reports/added-gm`

## API

- `GET /api/reports/daily-added-gm?startDate=&endDate=&page=1&pageSize=100`
- Server scopes rows by role (non-managers see own entries; managers by department).

## Auth

- Registry: `ADMIN_ONLY` on legacy path.
- Next guard: prefix `/daily-reports` in `route-access.ts`.
- Sidebar menu **Daily Reports**: `admin`, `super_admin` (`menu-perm-roles.ts`).

## UI

- `PageHeader`, `DrmSection`, date filters, `DataTable` (emerald/zinc theme).
- Parity with legacy columns and date validation.

## Files

- `src/modules/daily-reports/daily-added-gm-report-view.tsx`
- `src/lib/navigation/daily-reports-routes.ts`
- `src/app/(app)/dashboard/daily-reports/added-gm/page.tsx`

Legacy Vite page not removed.
