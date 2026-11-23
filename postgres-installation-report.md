# PostgreSQL Installation Report — Contabo VPS (DRM)

**Completed:** 2026-11-04 (UTC)  
**Related audit:** [postgres-installation-audit.md](./postgres-installation-audit.md)

---

## 1. Installed PostgreSQL version

| Item | Value |
|------|--------|
| Version | **PostgreSQL 16.15** (Ubuntu / PGDG package `postgresql-16`) |
| Cluster | `16/main` on port **5432** |
| Extensions meta | `postgresql-contrib-16` installed |

---

## 2. Installation status

| Step | Status |
|------|--------|
| Server packages installed | **Done** |
| Service enabled on boot | **Yes** (`systemctl is-enabled postgresql`) |
| Service running | **Yes** (`active`) |
| Localhost-only listen | **Yes** (`listen_addresses = localhost`) |
| Extra config drop-in | `/etc/postgresql/16/main/conf.d/99-drm-local-only.conf` |

---

## 3. Database name

**`drm_postgres`**

Includes schema **`drm`** (owner: `drm_app`) for future app migrations, plus default **`public`**.

---

## 4. Application username

**`drm_app`** (non-superuser, login role)

---

## 5. Connection hostname and port

| Parameter | Value |
|-----------|--------|
| Host | `127.0.0.1` (localhost only) |
| Port | `5432` |
| Database | `drm_postgres` |
| User | `drm_app` |

**Not for production Supabase:** The live DRM backend still uses the existing remote `DATABASE_URL` in `backend/.env` — **unchanged** by this install.

---

## 6. Credential file location

| Item | Value |
|------|--------|
| Path | **`/root/.drm-postgres-credentials`** |
| Permissions | `600` (root read/write only) |
| Contents | `HOST`, `PORT`, `DATABASE`, `USER`, `PASSWORD` |

**Password is not stored in this report or in Git.**  
View on server (root only): `sudo cat /root/.drm-postgres-credentials`

---

## 7. PostgreSQL service status

```
systemctl is-active postgresql  → active
systemctl is-enabled postgresql → enabled
pg_lsclusters                   → 16/main online
```

---

## 8. Security configuration

| Control | Setting |
|---------|---------|
| Listen addresses | `localhost` only (`127.0.0.1`, `::1`) |
| Public `0.0.0.0:5432` | **Not listening** |
| Password encryption | **scram-sha-256** |
| Application role | `drm_app` — not superuser |
| UFW | Unchanged (was inactive at audit) |
| SSH / Nginx | Unchanged |

---

## 9. Verification results

| Check | Result |
|-------|--------|
| PostgreSQL active | **Pass** |
| `drm_app` → `drm_postgres` on `127.0.0.1` | **Pass** (`SELECT current_database(), current_user`) |
| Port 5432 not on public interface | **Pass** (bind `127.0.0.1` / `::1` only) |
| MySQL/MariaDB | **Still inactive** (was not running before) |
| Nginx config checksum | **Unchanged** (before/after `b2783448…`) |
| Nginx service | **active** |
| PM2 `drm-backend` | **online** (uptime preserved, no deliberate restart) |
| Application `.env` | **Not modified** |
| MySQL-to-PostgreSQL migration | **Not performed** (as requested) |

---

## 10. Warnings and notes

1. **Two PostgreSQL targets:** Production app today uses **Supabase** (remote). This local instance is for **new/isolated DRM PostgreSQL work** on the VPS — point a *separate* dev/staging env at `127.0.0.1` when ready; do not swap production `.env` without a planned cutover.
2. **No swap** configured on the VPS (7.8 GiB RAM). Monitor memory if you run heavy imports locally.
3. **Express still listens on `*:5001`** (pre-existing). This task did not change that.
4. **Credential handling:** Share `/root/.drm-postgres-credentials` only via secure channels; never commit passwords to the repo.

---

## Next steps (optional, out of scope)

- Restore a dev copy from `backups/*.sql` into `drm_postgres` when the other developer is ready.
- Run DRM schema migrations against local DB using a **dedicated** env file (e.g. `backend/.env.local.postgres`), not production `.env`.
- Configure automated `pg_dump` backups for `drm_postgres` once in use.
