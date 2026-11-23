# Mac local + `drm_legacy_stage` — issues solved & migration notes

Reference for **next module migration** (D2, D3, …): what broke, what we fixed, and how to think about staging vs production app behavior.

## 1. Environment confusion (first)

| Issue | Fix / rule |
|-------|------------|
| Three DBs mixed | **Supabase** = production SQL dump (`drm`, ~279 tables). **`drm_postgres`** = almost empty. **`drm_legacy_stage`** = D1 migration (739 users, customers, attributes). Legacy login tests = **`drm_legacy_stage` only**. |
| Mac `.env` wrong DB | `DATABASE_URL` → `127.0.0.1:55432/**drm_legacy_stage**`, `DATABASE_SSL=false`. Do not use `drm_postgres` or Supabase for staging login. |
| VPS live config | Do **not** change live `.env`, PM2, Nginx — only Mac `backend/.env`. |

## 2. Network & tunnel

| Issue | Fix |
|-------|-----|
| Direct `db.*.supabase.co` / IPv6 | Mac SSH tunnel: `55432` → VPS `127.0.0.1:5432` (e.g. `DRM-Raya-VPS`). |
| Backend without tunnel | Run `nc -z 127.0.0.1 55432` first, then `npm run dev`. |

## 3. Postgres permissions (`drm_app`)

| Issue | Fix |
|-------|-----|
| `permission denied for table users` → login 500 | On VPS **`drm_legacy_stage` only**: `GRANT USAGE ON SCHEMA drm`, `SELECT/INSERT/UPDATE/DELETE ON ALL TABLES IN SCHEMA drm` to `drm_app`. |
| Login probe | Wrong password → **401**; DB read OK. `SELECT count(*) FROM drm.users` → **739**. |

## 4. Boot-time DDL vs migrated DB (`SKIP_SCHEMA_ENSURE`)

| Issue | Fix |
|-------|-----|
| Backend start: `ensureDbOnce`, copilot, promotions, accounts DDL | `SKIP_SCHEMA_ENSURE=true` in Mac `.env` — skip runtime DDL. |
| Every auth request: `ensureSalesTables` (CREATE/trigger on customers) | Skip when `SKIP_SCHEMA_ENSURE`; staging reads `drm.customers` (per-exec `sales_*` tables not in migration yet). |
| `menu_permissions` missing | `/api/drm/permissions` → `[]` instead of 500 when table missing. |
| `service_documents` ensure | Skip on staging where applicable. |

**Next migration rule:** Until staging schema is fully owned/aligned with app expectations, keep `SKIP_SCHEMA_ENSURE=true` on Mac; otherwise each boot/route may run DDL and fail.

## 5. Login / auth (legacy DRM)

| Issue | Fix |
|-------|-----|
| `03459460942` → “Invalid credentials” | Legacy login id is often **username**, not phone. Example: phone `03172770245`, username `03459460942`. |
| Code only matched `phone` column for digits | Digit input matches **username** and **phone** (normalized digits). |
| Frontend | Label “Email, username, or phone”, `type="text"`, no `minLength` on login password. |
| API | `POST /api/auth/login` — `email` field = identifier; bcrypt on `password_hash`. |

**Next migration rule:** Document `username` vs `phone` vs `email` in user migration notes; test login with all three.

## 6. “Old data” / wrong app on 5173

| Issue | Fix |
|-------|-----|
| 5173 LeadPilot + DRM clash | DRM: `FRONTEND_PORT=5174` or `mac-dev-staging.sh` (5173 busy → use 5174). |
| Backend 5001 down | Clear site data / stale React Query; ensure backend running. |
| Qamar Saddique etc. on Supabase | That was dump data, not `drm_legacy_stage`. |

## 7. Dashboard APIs — 500 flood after login

**Root cause:** Staging schema partial — missing tables/columns, wrong names (`follow_ups`, `todo_tasks`, `product_posting_invoices`, …).

**Pattern:** `backend/src/server/utils/safe-dashboard-fallback.ts` — when `SKIP_SCHEMA_ENSURE=true` and PG errors `42P01`, `42703`, `42501`, … → empty/zero JSON, not 500.

**Endpoints to cover incrementally** (examples):

- `/api/sales/overview`, `targets/summary`, `targets/ab`, `targets/vas`
- `/api/sales/activity-plan`, `important-metrics`
- `/api/dashboard/sales-executive/customer-monthly`
- `/api/dashboard/followups`
- `/api/sales/quotations/my-summary`
- `/api/product-posting` (list → `{ data: [] }`)

**Next migration rule:** For each new module, either migrate tables/columns on staging **or** add soft-fail on that route so the dashboard does not break.

## 8. `/api/sales/appointments/today`

| Issue | Fix |
|-------|-----|
| `column a.ends_at does not exist` | Staging `drm.appointments`: `id`, `assigned_to`, `customer_id`, `starts_at`, `notes`, `is_deleted`, `created_at` only. |
| Fix | Legacy SELECT when `SKIP_SCHEMA_ENSURE`; route try/catch — appointments fail → still try follow-ups; overall **200** + array. |

**Next migration rule:** When migrating appointments, add `ends_at`, `location`, `manager_status` **or** keep legacy repository branch until aligned.

## 9. Repo artifacts (team sync)

| Item | Purpose |
|------|---------|
| `backend/.env.staging-tunnel.example` | Template: `drm_legacy_stage`, `SKIP_SCHEMA_ENSURE` |
| `scripts/mac-dev-staging.sh` | Tunnel check + backend/frontend start |
| `docs/migration/50-d1-users-customers-execution.md` | D1 counts |
| `docs/migration/51-mac-local-staging-runbook.md` | Mac steps + GRANT note |
| `.gitignore` | `!.env*.example` so templates commit |

## 10. Checklist — next module migration (D2, D3, …)

1. Load data on **`drm_legacy_stage`**; Mac `.env` points there.
2. **Grants:** `drm_app` on new tables (at least `SELECT` for read-only dev).
3. **Schema diff:** app columns/tables vs dump (`42703` = missing column).
4. Mac `.env`: `SKIP_SCHEMA_ENSURE=true` until DDL owner is aligned.
5. **Login / users:** test username, phone, email.
6. **Dashboard routes:** Network tab — on 500, migrate **or** soft-fallback.
7. **Per-user tables** (`sales_<uuid>`): create in migration **or** scope queries to `drm.customers`.
8. **Support 404:** `SUPPORT_MODULE_ENABLED` off → expected; not a migration blocker.
9. **Secrets:** never commit passwords; rotate if shared in chat.

## 11. What works on staging today

| Works (D1 loaded) | Often empty / soft-fail until next modules |
|-------------------|--------------------------------------------|
| Login (legacy id + password) | GM, quotations workflow, targets, posting invoices |
| Users count, customers browse (migrated tables) | Menu permissions, todos, some follow-up joins |
| Queries that match partial schema | Full sales-exec dashboard KPIs |

## 12. Quick verify after each migration batch

```bash
# tunnel open
psql "$DATABASE_URL" -c "SELECT count(*) FROM drm.users;"
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:5001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"YOUR_ID","password":"..."}'
# expect 200 or 401, not 500
```

## Mind-set

**App** = full greenfield schema + DDL on boot. **Staging** = legacy/partial schema + `drm_app` grants. **Mac dev** = tunnel + `drm_legacy_stage` + `SKIP_SCHEMA_ENSURE` + soft-fail on missing pieces until migration catches up per module.

---

**Follow-up:** Module-by-module priority (follow-ups, quotations, GM) can be a separate doc once D2 scope is chosen.
