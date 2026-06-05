# Mock / Static Screen Inventory

Pages/components in the active frontend (`client/src`) that contain hardcoded
mock data, sample/dummy arrays, localStorage-only state, or alert-only flows.
Derived from grep for `MOCK_`, `mockData`, `dummyData`, `localStorage`, `alert(`.
No code was changed in Stage 0 — this is an inventory only.

## A. Confirmed hardcoded mock data rendered as real content (P-priority)
These render fabricated data to the user as if it were live:

| File | Symbol | Behavior |
| :-- | :-- | :-- |
| `client/src/pages/drm/pms-setting.tsx` | `MOCK_ACTIVITIES` | Hardcoded activity list rendered in the table; row count and CSV/export all derive from the mock array. No API call. |
| `client/src/pages/reports-bv-pending-rc.tsx` | `MOCK_DATA` | Hardcoded report rows; "Total Records" and filters operate on the mock array. No API call. |
| `client/src/pages/service-pool-dashboard.tsx` | `mockData` | Hardcoded rows mapped directly into the table. |
| `client/src/components/performance-graph.tsx` | `mockData` | Chart series is a hardcoded array fed straight into the `LineChart`. |
| `client/src/pages/create-target.tsx` | `dummyData` | Hardcoded sample dataset. |

## B. Sample data used only for export (not display) — lower priority
These define a local array used to build a CSV/clipboard export; the on-screen
table is data-driven or empty. Still worth replacing with the real export source.

| File | Symbol | Behavior |
| :-- | :-- | :-- |
| `client/src/pages/service-private-pool.tsx` | `mockData` | Built inside export handlers (tab-dependent) for CSV/TSV download; guarded by length checks. |
| `client/src/pages/service-commission-verifications.tsx` | `mockData` (`[]`) | Intentionally empty (`// Currently empty matching screenshot, but ready for data`); export handlers short-circuit when empty. |

## C. localStorage usage in pages (review for source-of-truth)
Pages that read/write `localStorage` for workflow/UI state. Most are UI
preferences, but confirm none hold business data that should be server-backed:
- `client/src/pages/dd-executive-dashboard.tsx`
- `client/src/pages/dd-manager-dashboard.tsx`
- `client/src/pages/software-executive-dashboard.tsx`

## D. `alert()`-based flows (UX / non-toast feedback)
Pages using browser `alert()` (often for export/empty-state or quick feedback;
not necessarily mock, but flagged for UX consistency review):
- `it-manager-dashboard.tsx`, `marketing-manager-dashboard.tsx`,
  `hod-dashboard.tsx`, `software-manager-dashboard.tsx`,
  `product-posting-dashboard.tsx`
- Service pages: `service-commission-verifications.tsx`, `service-a-customer.tsx`,
  `service-b-customer.tsx`, `service-b-plus-customer.tsx`,
  `service-b-minus-customer.tsx`, `service-monthly-followup.tsx`,
  `service-due-vas-payment.tsx`, `service-not-follow-customer.tsx`,
  `service-dropout-customer.tsx`, `service-weekly-dropout.tsx`,
  `service-private-pool.tsx`, `service-assistant-manager-dashboard.tsx`

## E. Already cleaned (no action)
- `client/src/pages/drm/delay-projects-new.tsx` — comment notes the old
  hardcoded-mock variant was removed; the file now re-exports the real
  implementation.

## Notes / false positives excluded
- `"ToDo"`/`ListTodo`/`todo` status labels and icons across dashboards are normal
  status strings, **not** mock data.
- `hardcodedAllowed` / `DEPT_NAME_TO_ROLES` in `app-sidebar.tsx` is a permission
  role map (intentional), not mock business data.

## Recommendation
Prioritize replacing **Section A** screens (pms-setting, reports-bv-pending-rc,
service-pool-dashboard, performance-graph, create-target) with real API-backed
data, since they present fabricated values to users. Sections B–D are
review/cleanup items.
