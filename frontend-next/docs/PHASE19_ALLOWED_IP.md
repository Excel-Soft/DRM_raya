# Phase 19 — DRM Allowed IP (full CRUD on Next)

**Route:** `/dashboard/allowed-ip/drm-ip-list` (legacy `/allowed-ip/drm-ip-list` redirect)

## Parity with legacy `allowed-ip-list.tsx`

| Feature | API |
|---------|-----|
| List | `GET /api/settings/allowed-ips` |
| Create | `POST /api/settings/allowed-ips` |
| Update | `PATCH /api/settings/allowed-ips/:id` |
| Toggle active | `PATCH` with `{ is_active }` |
| Delete | `DELETE /api/settings/allowed-ips/:id` |

**Auth:** Express `allowedIpRoleGate` + Next `ROUTE_PERMISSIONS["/allowed-ip/drm-ip-list"]` (admin, super_admin, administrator, super_hod). Menu **Allowed IP**: admin, super_admin.

## Implementation

- `src/modules/allowed-ip/drm-ip-list-view.tsx` — PageHeader, DrmSection, DataTable, add/edit dialog, delete confirm
- `src/modules/allowed-ip/allowed-ip-api.ts` — error helper

Legacy Vite page not removed.

## Verify

```bash
npm run typecheck
npm run test:unit   # includes allowed-ip-api.test.ts
```

Manual: `:3000/dashboard/allowed-ip/drm-ip-list` as admin — add, toggle, edit, delete.
