# Patch 4 — Production Readiness Checklist

Pre-deployment checklist for Patch 4 (ISS-01 Domain Hosting, ISS-02 Support
deactivation, ISS-03 Social Media Posting, ISS-04 Office Accounts).

## 1. Automated gates (all green this stage)
- [x] `npm run check` (tsc) — 0 errors.
- [x] `npm run build` — success (Vite client + esbuild `dist/index.js`).
- [x] `npm test` (vitest) — 10 files, 154 tests passed.
- [x] App boots on port 5000 (`Start application` workflow running).
- [x] Unauthenticated API smoke — all Patch 4 endpoints 401; `/api/support/*` 404.

## 2. Environment / configuration
- [ ] `DATABASE_URL` points at the intended database (dev uses Replit Postgres,
      `drm` schema; production must use the production `DATABASE_URL`).
- [ ] **🔴 BLOCKER — committed secret.** A real `JWT_SECRET` value is hard-coded in
      the `.replit` `[env]` block, and `server/auth.service.ts` falls back to a
      hardcoded `"dev-secret-key-change-in-production"`. Move `JWT_SECRET` to
      Replit-managed Secrets, **rotate** the value, and remove it from `.replit`
      before production. (Rotating invalidates existing sessions — expected.)
- [ ] Support flags **left OFF** for this phase: `SUPPORT_MODULE_ENABLED` and
      `VITE_SUPPORT_MODULE_ENABLED` unset/`false`.
- [ ] Audit all other env entries in `.replit` for any further committed secrets.

## 3. Database
- [ ] Confirm `drm` schema tables exist in production: `account_heads`,
      `office_expenses`, ledger tables, `cheques`, `donations`, `invoices`,
      `business_customers`, `gm_entries`/`refund_gm_entries`, `dollar_buyers`/
      `dollar_buying`, `it_servers`/`it_domains`/`it_backups`, `social_accounts`,
      social-posts table, `support_*` (retained).
- [ ] **Confirm `vas_documents` source/table** (flagged unconfirmed in baseline).
- [ ] Apply any new columns via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
      (runtime DDL) — **do not** use `npm run db:push` (broken repo-wide on a
      pre-existing FK type mismatch).

## 4. Permissions / audit (carry-over findings)
- [x] Office Accounts hardened routes (`office-account-routes.ts`): role-guarded + audited.
- [x] Domain Hosting **Server Names** (`/servers`, `/server-names`): role-guarded + audited.
- [x] Social Media/Accounts: scoped 403 + audited + notified.
- [ ] **Decision needed:** legacy `account-routes.ts` (invoices/donations/gm/
      dollar ancillary CRUD) is authenticated-only with no audit — confirm
      acceptable or schedule a hardening follow-up before relying on it for
      sensitive finance.
- [ ] **Decision needed:** Domain Hosting `/domains`, `/registries`,
      `/hosting-packages`, `/backups`, `/system-report` are authenticated-only
      (no role guard, no audit) — confirm or harden to match Server Names.

## 5. Functional sign-off (needs an authenticated session per role)
- [ ] Office Accounts: create/edit/delete/post/reverse/export per sub-module.
- [ ] Domain Hosting: create/edit/duplicate-reject/invalid-host-reject/status/
      soft-delete as IT roles; 403 as non-IT.
- [ ] Social Media: draft → submit → approve/reject → schedule/publish; past-date
      rejection; cross-user 403.
- [ ] Support: confirm Inactive page + hidden nav for all roles.

## 6. Pre-existing fake/static data (flagged, not fixed this stage)
- [ ] `it-domains.tsx`: Excel/CSV/PDF export shows a fake "exported successfully"
      toast (no file produced); "Invoice Quotation" dialog shows a static `0.00`.
      Make real or remove before relying on them.
- [ ] `account-routes.ts`: dollar stats use a hardcoded `* 280` rate fallback;
      AB report query injects hardcoded IDs. Confirm intended or replace.

## 7. Known non-blockers
- Large client bundle warning (`index-*.js` > 500 kB) — performance only, not a
  failure. Consider code-splitting later.
- Social "publish" is a status transition + notification, **not** an external
  posting integration (by design this phase).

## 8. Rollback
- Replit checkpoints cover code + DB; roll back to the pre-deploy checkpoint if a
  regression appears. Support can be toggled back off via the two env flags
  without a code change.
