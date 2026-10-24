# Module — Admin Audit Logs

| Item | Value |
|------|--------|
| Legacy route | `/admin/audit-logs` |
| Next route | `src/app/(app)/admin/audit-logs/page.tsx` |
| UI | `src/modules/audit-logs/audit-logs-view.tsx` |

## API

| Method | Path | Backend |
|--------|------|---------|
| GET | `/api/audit-logs?page&pageSize&filters…` | `audit-log-routes.ts` — `requireRole(admin, super_admin, super_hod)` |

## Client guard

`route-access.ts` prefix `/admin/audit-logs` — same three roles. Nav: `canShowAuditLogsNav`.

## Smoke (no token)

```bash
npm run test:smoke-api
# Expect GET /api/audit-logs → 401
```
