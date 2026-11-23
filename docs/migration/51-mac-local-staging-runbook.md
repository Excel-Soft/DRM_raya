# Mac local → `drm_legacy_stage` (SSH tunnel)

Use this for **legacy login tests** against migrated data on the VPS. Do **not** point at Supabase production or empty `drm_postgres`.

## Prerequisites

- `DRM-WebExcels-Version-10` on your Mac
- `backend/.env` with `DATABASE_URL` ending in `/drm_legacy_stage`, host `127.0.0.1:55432`, `DATABASE_SSL=false`, `SKIP_SCHEMA_ENSURE=true`
- `drm_app` password in `.env` only (never commit)

## 1. SSH tunnel (separate terminal — keep open)

```bash
ssh -N -L 55432:127.0.0.1:5432 YOUR_USER@YOUR_VPS_HOST
```

Or an SSH config alias, e.g. `DRM-Raya-VPS`.

Verify:

```bash
nc -z 127.0.0.1 55432 && echo "tunnel ok"
```

## 2. Optional DB smoke check

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM drm.users;"
```

Expect **739** users when migration D1 is loaded and `drm_app` has access on `drm.*`.

If you see `permission denied for table users` on login, the VPS DBA must grant access on **`drm_legacy_stage`** to `drm_app` (Mac-only dev does not change VPS live app `.env`):

```sql
GRANT USAGE ON SCHEMA drm TO drm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA drm TO drm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA drm TO drm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA drm GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO drm_app;
```

(Run as `postgres` on the **staging** DB only.)

## 3. Run apps

From repo root:

```bash
chmod +x scripts/mac-dev-staging.sh
./scripts/mac-dev-staging.sh
```

Or two terminals:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

- Frontend: http://127.0.0.1:5173 (if port busy, `FRONTEND_PORT=5174 ./scripts/mac-dev-staging.sh`)
- Backend: http://127.0.0.1:5001

## 4. Login

Use **Email, username, or phone** on the login screen (e.g. `03459460942` or your migrated email).

Password = old DRM `webxl_login` password (bcrypt on staging).

## Out of scope (unless explicitly requested)

- VPS production `.env`, PM2, Nginx
- Loading more migration modules (invoices, follow-ups, GM)
- ETL against Supabase
- Modifying `legacy_archive` on VPS

See also:

- [50-d1-users-customers-execution.md](./50-d1-users-customers-execution.md)
- [52-mac-staging-issues-and-next-module-notes.md](./52-mac-staging-issues-and-next-module-notes.md) — full issue/fix log for next modules
