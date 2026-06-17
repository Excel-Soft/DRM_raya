# Patch 4 — Stage 4: Domain Hosting "Server Names"

Crash fix (ISS-01, P0) + real CRUD / search / status / permissions for the IT
"Server Names" feature, reusing the existing `it_servers` table and
`/api/it/servers` routes (architect-confirmed). No new parallel table/engine was
created, no mock data, no plaintext secrets, additive DB only.

## 1. Crash cause (ISS-01, P0)

`client/src/pages/it-servers.tsx` declared three `useMutation` hooks **after** an
early `if (isLoading) return <Loader/>` return. On the first render `isLoading`
is `true`, so the component returned before those hooks ran; once the queries
resolved and the component re-rendered past the guard, React saw additional
hooks and threw **"Rendered more hooks than during the previous render."**

**Fix:** moved all `useMutation` hooks (and the new server mutations/handlers)
**above** the `if (isLoading)` early return so the hook order is identical on
every render. The servers query now also exposes `isError` / `refetch` /
`isFetching` for a real error + retry state.

## 2. Files changed

- `client/src/pages/it-servers.tsx`
  - Crash fix: all mutation hooks hoisted above the loading guard.
  - New full-width **Server Names** section: search, status filter, refresh,
    add/edit dialog, table (No / Name / Host-IP / Provider / Status / Actions),
    inline per-row status change, edit, soft-delete (confirm), loading / empty /
    error+retry states, inline validation. Toasts fire only after API success.
  - Removed the redundant cramped bottom-left "Add Server" list card; bottom grid
    collapsed from 3 to 2 columns (Registry, Hosting). The domain form's server
    dropdown still uses the same `serversList` and keeps working.
- `server/it-assets-routes.ts`
  - Server CRUD handlers: list, get, create, update, status, soft-delete.
  - `requireRole` gates (READ vs WRITE), host/name/status validation, duplicate
    active-name → 409, invalid host/name → 400, bad status enum → 400.
  - `AuditLogService` records create / update / status-transition / delete.
  - Registered on both `/api/it/servers` (canonical) and `/api/it/server-names`
    (alias to the same handlers).
- `server/repositories/it-assets.repository.ts`
  - `SERVER_STATUSES`, `normalizeServerStatus`, `ListServersOptions` exports.
  - `listServers` (filters `deleted_at IS NULL` by default), `getServer`,
    `findActiveServerByName` (dup check), `updateServer`, `softDeleteServer`.
    Existing `createServer` / hard `deleteServer` retained.
  - `ensureItSchema`: idempotent `ALTER TABLE it_servers ADD COLUMN IF NOT EXISTS`
    for the additive columns.
- `shared/schema.ts`
  - `itServers`: added `notes`, `deletedAt`, `createdBy`, `updatedBy`,
    `deletedBy` (plain `uuid`/`text`, **no FK refs** to avoid the known broken
    `db:push` FK mismatch).

## 3. APIs

Canonical `/api/it/servers` (alias: `/api/it/server-names`):

| Method | Path                          | Access | Notes |
|--------|-------------------------------|--------|-------|
| GET    | `/`                           | READ   | Lists non-deleted; supports search/status |
| GET    | `/:id`                        | READ   | Single server |
| POST   | `/`                           | WRITE  | Create; dup active name → 409; invalid → 400 |
| PATCH  | `/:id`                        | WRITE  | Update fields |
| PATCH  | `/:id/status`                 | WRITE  | Status transition; enum-validated |
| DELETE | `/:id`                        | WRITE  | Soft delete (sets `deleted_at`) |

- **Status** is stored as text but normalized at the API to
  `ACTIVE | INACTIVE | SUSPENDED | ARCHIVED`; legacy `Active`/`Inactive` are
  mapped. New inserts default to `ACTIVE`.
- **Host / IP** is the existing `it_servers.ip` column (no separate column added).

## 4. DB changes (additive, non-destructive)

Added to `it_servers` via both `shared/schema.ts` and idempotent
`ensureItSchema` ALTERs: `notes`, `deleted_at`, `created_by`, `updated_by`,
`deleted_by`. No columns dropped, no data migrated, no FK constraints added.
Soft delete = set `deleted_at`; archived rows are hidden from lists and ignored
by the duplicate-name check (so a name is reusable after delete).

## 5. Permissions

- **READ**: admin, super_admin, super_hod, it_manager, it_admin, domain_manager,
  developer.
- **WRITE**: same set **minus** developer.
- All mutations are audited via `AuditLogService`.

## 6. Tests / verification

- `npm run check` → **0 TypeScript errors**.
- `npm test` → **154 / 154 passing**.
- Runtime API smoke (admin + developer JWTs against the live server) → **15/15**:
  list, alias list, developer READ 200, create (status normalized), duplicate
  active name → 409, invalid host → 400, missing name → 400, bad status enum →
  400, valid status transition, update, developer WRITE → 403, soft delete,
  soft-deleted row hidden from list, name reusable after soft delete.

## 7. Known limitations / unresolved

- The partial unique index for DB-level duplicate-name enforcement was
  deliberately **not** added (it risked rolling back the whole additive DDL
  batch); duplicate enforcement is **application-level** in the create/update
  handlers instead.
- `npm run db:push` remains broken repo-wide due to a pre-existing FK type
  mismatch; schema is applied via the runtime `ensureItSchema` ALTERs, not push.
- The frontend filters/search client-side over the fetched list; the API also
  supports server-side `search`/`status` params for other consumers.
