# Stage 5 — Service Department Full Backend Integration

This stage converted the remaining mock/static surfaces of the Service
Department to real API-backed data or honest empty states. No service UI was
redesigned, no service customer/report rows were faked, and no leave/loan/
penalty engines or commission formulas were invented.

## Summary

Discovery established that the large majority of the Service Department was
already real and registered:

- Backend routes `server/service-reports-routes.ts` (customers by grade,
  follow-ups monthly/not-followed, dropouts report/weekly, payments due,
  dashboard counts, documents CRUD + verify) and `server/service-core-routes.ts`
  (complaints lifecycle, follow-ups, dropouts, renewals) are real and registered
  in `server/routes.ts`.
- 17 of 19 service pages already used `useQuery` + `apiRequest` with real
  loading/empty/pagination/filter handling.
- `service-manager-dashboard.tsx` was already honest: its top cards read from the
  real `/api/service/manager/stats` endpoint with a `0` fallback (revenue/kwa/psa
  etc. return `0` by design until their source data exists).

Only two pages still contained fabricated literal data; both were fixed to
follow the existing honest pattern (real values, `0`/empty fallback).

## Files changed

- `server/repositories/service-reports.repository.ts`
  - Extended `dashboardCounts()` to also return real BV/VAS document counts
    (`documents: { bv, vas }`), scoped by uploader to match the document list.
  - Fixed a scope bug in the due-payments count: it interpolated `${scopeSql}`
    (a full `WHERE ...` clause) after an existing `WHERE`, producing invalid
    double-`WHERE` SQL (500) for scoped non-admin users. Now appends the scope
    with an `AND ... = ANY($1)` clause, matching the sibling count queries.
- `client/src/pages/service-assistant-manager-dashboard.tsx`
  - Removed fabricated `topSelling` literals (`"22(0)"`, `"1(799)$"`, etc.) and
    wired the cards to the real `/api/service/manager/stats` endpoint with a `0`
    fallback, mirroring the manager dashboard.
  - Removed fabricated `targetData` chart constants and rebuilt the chart from
    real `/api/service/dashboard/counts` data (grade A/B+/B/B- counts, open +
    in-progress complaints, dropouts, due follow-ups, due payments). Bars were
    relabeled honestly to reflect the real series.
  - Wired the "BV Document" / "VAS Document" stat cards (previously hardcoded
    `"0"`) to the new real `counts.documents.bv` / `counts.documents.vas`.
  - Added `ServiceManagerStats` type and `documents` field to
    `ServiceDashboardCounts` type.
- `client/src/pages/service-private-pool.tsx`
  - Replaced the fabricated `mockData` follow-up array with an empty array.
  - Removed the two hardcoded mock `<TableRow>`s (Al khar store / GGS Digital /
    B+) from the tracing table body; it now always shows the existing
    "No companies found" empty state.
  - Changed the fabricated "Alibaba Membership (1)" tab count to "(0)".
  - Removed the fabricated "GGS Digital (1)" and "B+ (1)" summary chips, leaving
    the generic "All" chip.
  - (Architect follow-up) Replaced fabricated rows in `CustomerAttributeView`
    history tabs (Contact History, Company History, Quotation History, Quotation
    Templates — Invoice History was already an empty state) with honest empty
    states, keeping the same table headers/tabs. Also converted the WhatsApp/
    Email template-picker modal (previously a hardcoded "Ramzan Offer" / sample
    email row) to an honest "No templates available." empty state.

## APIs added / modified

- Modified: `GET /api/service/dashboard/counts` — response now includes a real
  `documents: { bv, vas }` object (BV/VAS document counts scoped by uploader).
- No new endpoints were created. The assistant dashboard now also consumes the
  already-existing `GET /api/service/manager/stats`.

## DB changes

- None. No schema, migration, table, column, or enum changes. The document
  counts are computed by querying the existing `drm.service_documents` table.

## Service pages converted (mock/static -> real or honest)

- `service-assistant-manager-dashboard.tsx` — top cards, target chart, and
  BV/VAS document counts now backed by real endpoints (`0`/empty fallback).
- `service-private-pool.tsx` — tracing follow-up table and its tab/summary
  counts no longer render fabricated rows; honest empty state shown.

(The other 17 listed service pages were already real and were left unchanged.)

## Tests run

- `npm run check` (tsc): no new type errors introduced in changed files. The
  only error reported in a changed file (`service-private-pool.tsx`
  `setDuplicateModalOpen` inside `CustomerAttributeView`) is pre-existing and
  identical at HEAD — it is an out-of-scope baseline issue, not a boot blocker
  (Vite/esbuild does not type-check). The remaining ~baseline tsc errors live in
  unrelated files (reports-routes, call-sessions, customers, permissions,
  project-* repositories) and predate this stage.
- Workflow `Start application` restarted cleanly: server serving on port 5000,
  no startup errors. `GET /api/service/dashboard/counts` responds (auth-gated).

## Unresolved / known limitations

- `service-manager-routes.ts` `/api/service/manager/stats` intentionally returns
  `0` for `totalRevenue`, `vm`, `kwa`, `psa`, `sponsorBrand` because no invoice/
  GM revenue source is yet wired to service customers. The assistant and manager
  dashboards display these honest `0`s rather than inventing figures.
- `service-private-pool.tsx` follow-up sub-view (`FollowupListView`) has no
  dedicated backend; it now shows an honest empty state. The VAS commission
  tier table elsewhere on the assistant dashboard remains a static reference
  rate-card (no config table exists to source it from).
- The private-pool follow-up / appointment creation forms remain local-state /
  alert stubs; wiring them to `POST /api/service/followups` requires a customer
  picker (the forms collect free-text company names, not customer IDs) and was
  left unchanged to avoid creating mismatched data. Their pre-filled
  `defaultValue="Al khar store"` inputs are form scaffolding, left as-is.
- `CustomerAttributeView`'s "Quotation Templates" tab no longer renders a row,
  so its `QuotationTemplateModal` is currently unreachable from that view (the
  modal component is retained, not deleted). Wiring real quotation/template data
  requires endpoints that do not exist for this view.
- A pre-existing tsc error (`setDuplicateModalOpen` referenced out of scope in
  `CustomerAttributeView`) exists at HEAD and is unrelated to this stage; left
  untouched (out of scope, not a boot blocker).
- `service-core-routes.ts` GM/VAS/BV endpoints remain stubs (pre-existing,
  outside Stage 5 scope).
