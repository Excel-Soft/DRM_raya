# PATCH 4 — STAGE 0: Baseline Audit & Scope Lock

> Audit-only. No business logic, financial workflows, schema, or module
> behavior was changed in this stage. The only files written are the three
> inventory documents (`PATCH4_BASELINE_AUDIT.md`, `PATCH4_ISSUE_MATRIX.md`,
> `OFFICE_ACCOUNTS_SUBMODULE_INVENTORY.md`).
>
> Audit date: 2026-06-16. Line numbers are indicative as of this date.

---

## 1. App run status

- **Active runtime:** `server/index.ts` (Express + Vite middleware) serving the
  `client/` SPA on **port 5000**. Confirmed running via the `Start application`
  workflow (`npm run dev`).
- Startup logs are clean: DB connects (`[db] connecting host=helium db=heliumdb`),
  HOD routes mount, accounts schema maintenance completes, server binds on
  `0.0.0.0:5000` (IPv6 bind falls back to IPv4 — expected, not an error).
- The legacy `src/` scaffold and `api:dev` / `auth:dev` scripts are **not** used.

## 2. npm check / build / test status

- `node -v` = **v20.20.0**, `npm -v` = **10.8.2**.
- `npm run check` (`tsc --noEmit`, strict) = **0 errors**. (The repo previously
  carried a ~57-error baseline; that was cleared in a prior task. Any new tsc
  error should now be treated as a regression.)
- `npm run build` = **succeeds** (`dist/index.js`, client bundle in `dist/public`).
- `npm test` (vitest) = **154 passing across 10 files**.
- `git status` = clean working tree at the start of this audit.

## 3. Database status

- `DATABASE_URL` is **set** (Replit-managed Postgres). Schema in use: **`drm`**.
- Verified (read-only `information_schema` query) that all module tables exist in
  the **`drm`** schema:
  `it_servers, it_domains, it_registries, it_hosting_packages, it_backups,
  today_posts, social_accounts, product_posting_data, support_tickets,
  support_messages, support_channel_config, service_complaints, account_heads,
  office_expenses, ledger_entries, donations, dollar_buying, dollar_buyers,
  cheques, invoices, business_customers, gm_entries, refund_gm_entries`.
- ⚠️ **`drm.vas_documents` was NOT found** under that name. The VAS Documents UI
  reads `/api/service/vas/documents`; the underlying table/source must be
  confirmed in Stage 1 (it may be named differently or sourced via a view/join).

## 4. Office Accounts sub-modules found

Two sidebar groups make up "Office Accounts":

**"Account" group** (`client/src/components/app-sidebar.tsx` L222–231, permKey `Account`):
Create GM (`/account/gm-entries`), Add Temp GM (`/account/temp-gm`), Add Refund GM
(`/account/refund-gm`), Donations (`/account/donations`), Make Invoice
(`/account/invoices`), Company Ledger (`/account/ledger`), AB Report
(`/account/ab-report`), Dollar System (`/account/dollar-system`).

**"Office Account" group** (`app-sidebar.tsx` L235–244, permKey `Office Account`):
Trial Balance Report (`/office/trial-balance-report`), Old Account Head
(`/office/old-account-head`), Chart of Account (`/office/chart-of-accounts`),
Account Head (`/office/account-head` — **commented out in sidebar**, L240, route
still live), Business Customer (`/office/business-customers`), Office Vas
(`/office/vas`), Office Expense (`/office/expenses`), Cheque System
(`/office/cheques`). VAS Documents route also exists at `/office/vas-documents`.

Full per-sub-module breakdown is in **`OFFICE_ACCOUNTS_SUBMODULE_INVENTORY.md`**.

## 5. Server Names (Domain Hosting) route / page / API found

- **Sidebar:** "Domain Hosting" group (`app-sidebar.tsx` ~L276–282, permKey
  `Domain Hosting`): Servers → `/it/servers`, Domains → `/it/domains`, Backup →
  `/it/backup`. Role map: `"Domain Hosting": ["admin","it_manager","developer"]`.
- **Routes** (`client/src/App.tsx`): `/it/servers` (L422 → `ItServers`),
  `/it/domains` (L423 → `ItDomains`), `/it/backup` (L424), `/it/system-report` (L425).
- **Page (Server Names):** `client/src/pages/it-servers.tsx` (titled
  "ADD SERVER / ADD DOMAIN"; lists servers, registries, hosting packages, domains).
- **Backend:** `server/it-assets-routes.ts`, mounted at `/api/it`
  (`server/routes.ts` L352). Repo: `server/repositories/it-assets.repository.ts`.
  Endpoints: `GET/POST/DELETE /api/it/servers`, `GET /api/it/registries` +
  `DELETE :id`, `GET /api/it/hosting-packages` + `DELETE :id`,
  `GET/POST /api/it/domains`, `GET/POST /api/it/backups`, `GET /api/it/system-report`.
- **Tables:** `drm.it_servers`, `drm.it_registries`, `drm.it_hosting_packages`,
  `drm.it_domains`, `drm.it_backups` (all present).

## 6. Social Media Posting route / page / API found

- **Routes** (`App.tsx`): `/social-media` (L270 → `SocialMedia`),
  `/drm/today-post` (L307), `/drm/all-social-accounts` (L310). Related:
  `/drm/bot-system`, `/drm/fb-post`, `/posting-data` (L408+).
- **Sidebar:** "Add Post/View Statistics" → `/social-media` (~L317);
  under "DRM Setting": Bot system (L204), Online Form (L205), Fb Post (L206).
- **Pages:** `client/src/pages/social-media.tsx` (**client-side mock**, no API),
  `client/src/pages/drm/today-post.tsx`, `client/src/pages/drm/all-social-accounts.tsx`,
  `client/src/pages/fb-post.tsx`, `client/src/pages/bot-system.tsx`.
- **Backend:** `server/today-post-routes.ts` (`/api/drm/today-posts`),
  `server/social-accounts-routes.ts` (`/api/drm/social-accounts`),
  `server/fb-routes.ts` (`/api/fb/send-message` — **mock**),
  `server/bot-routes.ts` (`/api/bot/*` — **mock**),
  `server/posting-data-routes.ts` (`/api/posting-data`).
- **Tables:** `drm.today_posts`, `drm.social_accounts`, `drm.product_posting_data`
  (all present; `today_posts`/`social_accounts` are created via runtime DDL inside
  their route files, not declared in `shared/schema.ts`).

## 7. Support routes / menu / API found

- **Sidebar:** "Support" group (`app-sidebar.tsx` L218–220, permKey `Support`):
  single item Tickets → `/support/tickets`.
- **Routes** (`App.tsx`): `/support/tickets` (L347), `/support/tickets/:id`
  (L348), `/support/complaints` (L349). Related service complaint route:
  `/service/complaint-list` (L337). Also registered in
  `client/src/routes/route-registry.ts` (~L271–273, L185).
- **Backend:** `server/support-routes.ts` (`registerSupportRoutes`, mounted
  `server/routes.ts` L267) — `/api/support/tickets` (+ `:id`, `:id/assign`,
  `:id/status`), `/api/support/messages`, `/api/support/channels`.
  `server/service-core-routes.ts` (`registerServiceCoreRoutes`, L277) —
  `/api/service/complaints`.
- **Tables:** `drm.support_tickets`, `drm.support_messages`,
  `drm.support_channel_config`, `drm.service_complaints` (all present).
- **Permissions/seed references:** `src/scripts/seed.ts` (role `support_agent`,
  `support` read/write perms, demo tickets), `client/src/hooks/useRouteProtection.ts`
  (`/support` prefix guard, ~L20), `client/src/lib/role-utils.ts` (~L45).

## 8. Server Names — crash / "not functioning" evidence

**Finding: the committed `it-servers.tsx` does NOT hard-crash (white-screen) in
the current state, and the `drm.it_*` tables all exist, so there is no
"relation does not exist" 500 on load.** The page is defensively coded:
`useQuery<any[]>(...)` defaults each list to `[]` (L19–33), every list is
re-guarded with `Array.isArray(...) ? ... : []` (L43), and every `.map` is
null-checked. A failed query therefore renders as an empty table, not a crash.

The reported "crashing / not functioning properly" is explained by **functional
defects**, not a render exception:

1. **Dead "Submit" button** — `it-servers.tsx` L191–193: the Submit button has
   **no `onClick`/`onSubmit` handler**, and there is **no create `useMutation`**
   for servers or domains (only `delete*` mutations exist). Adding a server/domain
   does nothing.
2. **Uncontrolled form inputs** — all form fields (Company, Domain Name, Registry,
   SSL, Hosting, dates, cPanel user/pass; L102–187) have no `useState`/`value`/
   `onChange`, so user input is never captured.
3. **No validation** — none of the issue's required validations exist on the
   frontend: server name, IP/host, provider, domain link, status, duplicates.
4. **No error/empty distinction** — only a loading spinner (L35–41); API failures
   silently show "No domains found" / "No servers listed".
5. **Backend handlers lack try/catch** — `server/it-assets-routes.ts` L10–78: each
   handler `await`s the repo and `res.json(...)` with no error handling, so any DB
   error becomes an unhandled 500 (surfaced silently on the FE per #4).
6. **No in-page permission enforcement** — access is gated only by the sidebar
   `permKey "Domain Hosting"`; the route/page itself is not role-guarded.
7. **Latent DDL risk** — `it-assets.repository.ts` `ensureItSchema()` (L6–66)
   issues **unqualified** `create table if not exists it_servers ...` while Drizzle
   queries `drm.it_*`. Currently harmless (tables already exist in `drm`), but it
   is a schema-qualification mismatch to fix in Stage 1.

> If the user is instead reproducing a crash on the **`/it/domains`** page
> (`it-domains.tsx`), that page should be re-checked in Stage 1; it was reported
> by exploration to map over domain data and is the secondary surface of this
> feature.

## 9. Broken / mis-wired API connections found

- **Social Media (mock):** `social-media.tsx` stores posts in local `useState`
  (L14) and never calls any backend — refresh wipes data. `fb-post.tsx` posts to
  `/api/fb/send-message`, which `server/fb-routes.ts` (L17) only logs and returns
  success. `server/bot-routes.ts` returns `{}` / placeholder (L17, L34).
- **Social Media routing mismatch:** the sidebar "Add Post/View Statistics" points
  to the **mock** `/social-media`, while the real CRUD backend exists for
  `/drm/today-post` and `/drm/all-social-accounts`.
- **Server Names:** create path entirely missing (see §8.1–8.2).
- **Office — Old Account Head:** `office-old-account-head.tsx` `handleSearch`
  only `console.log`s (no fetch); page shows static "No records found".
- **Office — Trial Balance Report:** `office-trial-balance.tsx` `handleGenerate`
  only logs filters; no report API call.
- **Office — Business Customers:** FE calls `/api/office/business-customers`, but
  backend (`office-account-routes.ts` ~L313) returns results mapped from the
  `customers` table rather than a dedicated `business_customers` source — verify
  intended source in Stage 1.

## 10. Mock / static / fake-success behavior found

- **Pure mock pages:** `social-media.tsx` (local state only), `fb-post.tsx` +
  `fb-routes.ts` (mock send), `bot-system.tsx` + `bot-routes.ts` (placeholder).
- **Static UI with no backend:** `office-old-account-head.tsx`,
  `office-trial-balance.tsx`.
- **Fake-success toasts:** none confirmed in Office Accounts so far —
  `office-expenses.tsx` correctly awaits the API and uses `onSuccess`/`onError`.
  Stage 1 should still verify each create/approve flow individually.
- **Cosmetic stubs in Server Names:** row action buttons toast "under
  construction" / "Refreshing domain status..." without performing the action
  (`it-servers.tsx` L262, L266).

## 11. Permissions gaps found

- **Server Names:** route/page not role-guarded; only sidebar `permKey` gating.
- **Support:** to be hidden this phase — sidebar entry (L218–220), `/support/*`
  routes (App.tsx L347–349), `/service/complaint-list` (L337), the `/support`
  prefix in `useRouteProtection.ts`, and any `support_agent` menu visibility must
  be disabled while leaving code/tables intact.
- **Social Media:** mock pages perform actions with no permission checks.
- **Office Accounts:** permission coverage is per-route and inconsistent; Stage 1
  must confirm each sub-module enforces role checks on both FE route guard and
  backend endpoint (especially financial writes).

## 12. Audit (logging) gaps found

- An `ActivityLogService` / audit-log facility exists and is best-effort
  (`/admin/audit-logs` is in the sidebar). Stage 1 must verify that financial
  mutations (GM/refund/donation/invoice/expense/cheque/dollar) and IT-asset
  create/delete write audit entries. Server Names create/delete (`it-assets`
  repo) currently has **no audit logging**.

## 13. Raw / unvalidated financial update risks found

- **Office Expenses POST** (`office-account-routes.ts` ~L96–101): Zod validates
  types via `insertOfficeExpenseSchema.parse`, but there is **no business-rule
  validation** (e.g., amount bounds, or that a referenced cheque has sufficient
  balance — balance is only computed on GET, not enforced on POST).
- General risk across Account/Office Account writes: confirm server-side amount
  validation and approval/status gating before any Stage-2 changes. **No financial
  workflow is to be modified in Stage 0/1 audit.**

## 14. Recommended implementation order

1. **ISS-01 (P0) Server Names** — add controlled form state + create mutations
   for servers/domains, wire Submit, add validation (name/IP/host/provider/domain/
   status) + duplicate guard, add loading/error/empty states, wrap backend GET/POST
   in try/catch, fix the `ensureItSchema()` schema-qualification, add role guard +
   audit logging.
2. **ISS-04 (P0) Office Accounts** — sub-module by sub-module per the inventory:
   wire the two static pages (Old Account Head, Trial Balance), confirm each
   CRUD/report/export, add missing validation/permission/audit, verify the VAS
   documents source, harden financial writes (no behavior change without sign-off).
3. **ISS-03 (P1) Social Media Posting** — consolidate to the real
   `today-post`/`social-accounts` backend, repoint the sidebar away from the mock
   `/social-media`, add platform/account/content/media/schedule validation and
   status tracking; decide scope for actual publish/schedule execution.
4. **ISS-02 (P2) Support** — hide sidebar entry + guard/disable `/support/*` and
   `/service/complaint-list` routes (block direct URL) while keeping code + tables.

## 15. Files likely to change (by issue)

- **ISS-01:** `client/src/pages/it-servers.tsx`, `client/src/pages/it-domains.tsx`,
  `server/it-assets-routes.ts`, `server/repositories/it-assets.repository.ts`,
  `shared/schema.ts` (only if a column is genuinely missing).
- **ISS-02:** `client/src/components/app-sidebar.tsx`, `client/src/App.tsx`,
  `client/src/hooks/useRouteProtection.ts`, `client/src/routes/route-registry.ts`.
- **ISS-03:** `client/src/pages/social-media.tsx`,
  `client/src/pages/drm/today-post.tsx`,
  `client/src/pages/drm/all-social-accounts.tsx`, `client/src/components/app-sidebar.tsx`,
  `server/today-post-routes.ts`, `server/social-accounts-routes.ts`
  (and `fb-routes.ts`/`bot-routes.ts` only if those features are in scope).
- **ISS-04:** `client/src/pages/office-old-account-head.tsx`,
  `client/src/pages/office-trial-balance.tsx`, `client/src/pages/office-expenses.tsx`,
  `client/src/pages/business-customers.tsx`, `client/src/pages/account-*.tsx`,
  `client/src/pages/chart-of-accounts.tsx`, `client/src/pages/cheque-system.tsx`,
  `client/src/pages/vas-documents.tsx`, `client/src/pages/dollar-system.tsx`,
  `server/office-account-routes.ts`, `server/account-routes.ts`,
  `server/reports-routes.ts`.

---

### Out-of-scope note (security, pre-existing)

`.replit` contains a hardcoded `JWT_SECRET`. This predates Patch 4 and is **not**
part of this audit's changes, but per project policy secrets must live in
Replit-managed env. Recommend moving it to Replit Secrets and rotating it
(separate from Patch 4).
