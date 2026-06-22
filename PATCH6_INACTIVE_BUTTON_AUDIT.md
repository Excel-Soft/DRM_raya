# PATCH 6 — Stage 9 Inactive / No-Op Button Audit

Date: 2026-06-22. Goal: on **active (reachable) screens**, no button may be a
silent no-op or fake success. "Reachable" is judged against the live router
(`client/src/App.tsx`) and sidebar (`client/src/components/app-sidebar.tsx`).

**Status legend:** Fixed / Mitigated (already) / Dev-only demo / Open / Deferred.

## 1. Inert (`onClick={() => {}}`) handlers
| File / route | Control | Reachable? | Action | Status |
|---|---|---|---|---|
| `pages/it-manager-dashboard.tsx` (`/dashboard/it-manager`, internal) | "Edit Domain" icon | Yes (admin/it_manager) | Removed the no-op handler; rendered disabled (`aria-disabled`, `cursor-not-allowed`, dimmed, `title="Edit Domain — not available yet"`). | **Fixed** |
| `pages/it-manager-dashboard.tsx` | "Account Details" icon | Yes | Same as above (`title="Account Details — not available yet"`). | **Fixed** |

> The two adjacent icons in the same cell ("View Detail" → `setActiveView`,
> "Follow Up" → `setFollowupOpen`) are wired and were left unchanged.

## 2. Fake-success handlers (no backing API)
| File / route | Control | Old behaviour | Action | Status |
|---|---|---|---|---|
| `pages/dd-manager-dashboard.tsx` (`/dashboard/dd-manager`, internal) | Reject (reason modal) for raw `PRODUCT_POSTING` workflow item | `toast("Project returned successfully (Mock)")` then closed the modal as if it succeeded | Replaced with honest destructive toast: *"Reject not available — Returning a project at this workflow stage isn't supported yet."* No fake success; no new API added. | **Fixed** |
| `pages/dd-manager-dashboard.tsx` | Verify-flow reject branch (`Data Not Verified`) | `toast("Project returned successfully (Mock)")` | Same honest destructive toast. | **Fixed** |

## 3. `console.log`-only handlers
| File / route | Control | Reachable? | Action | Status |
|---|---|---|---|---|
| `components/public-pool.tsx` | "Claim Lead" → `console.log` | **No** — only referenced by `components/examples/PublicPool.tsx`; live `/customers/public-pool` uses `DynamicPublicPool` → real pages | Documented as dev-only demo; retained per repo preference. | **Dev-only demo** |
| `components/customer-list.tsx` | "View" → `console.log` | **No** — only referenced by `components/examples/CustomerList.tsx` | Documented as dev-only demo; retained. | **Dev-only demo** |
| `pages/office-old-account-head.tsx` | "Search" → `console.log` | **No** — `/office/old-account-head` redirects to `/office/chart-of-accounts`; not in live sidebar | Page unreachable; no code change. | **Mitigated (already)** |

## 4. Destructive actions without a confirmation dialog
Confirmed by searching for `onClick={() => *Mutation.mutate(...)}` (delete / void /
cancel / reverse / remove). Only the plan-named page is fixed this stage; the rest
are documented honestly and deferred (a broad confirm-dialog sweep is out of the
bounded Stage-9 scope). **All of these already surface backend errors honestly via
`mutationRequest`/`apiRequestJson` — none fake success.**

| File / route | Destructive action | Status |
|---|---|---|
| `pages/allowed-ip-list.tsx` (`/allowed-ip/drm-ip-list`, admin) | Delete allowed IP | **Fixed** — `AlertDialog` confirm added |
| `pages/admin-dashboard.tsx` | Delete user | **Deferred** |
| `pages/chart-of-accounts.tsx` | Delete account head | **Deferred** |
| `pages/general-ledger.tsx` | Reverse ledger entry | **Deferred** |
| `pages/journal-voucher.tsx` (x2) | Cancel voucher | **Deferred** |
| `pages/office-expenses.tsx` | Delete expense | **Deferred** |
| `pages/account-refund-gm.tsx` | Delete refund entry | **Deferred** |
| `pages/account-donations.tsx` | Delete donation | **Deferred** |
| `pages/account-gm-entries.tsx` (x2) | Delete entry / remove member | **Deferred** |
| `pages/loan-request.tsx` | Delete loan | **Deferred** |
| `pages/leave-request.tsx` | Cancel request | **Deferred** |
| `pages/overtime-submission.tsx` | Delete record | **Deferred** |
| `pages/salary-bonuses.tsx` | Remove bonus | **Deferred** |
| `pages/posting-data.tsx` | Delete restricted item | **Deferred** |
| `pages/it-servers.tsx` (x2) | Delete registry / hosting package | **Deferred** |
| `pages/events-add.tsx` (x2), `events-menu.tsx`, `events-duty-planner.tsx` | Delete event / speaker / menu / duty | **Deferred** |

> Pages already using `AlertDialog` for destructive/confirm flows (left unchanged):
> `drm/add-penalty.tsx`, `overtime-submission.tsx`, `pms-task-history.tsx`,
> `pms-task-templates.tsx`, `salary-create.tsx`, `salary-report.tsx`.
