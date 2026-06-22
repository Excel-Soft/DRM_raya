# PATCH 6 — Stage 9 Active-Screen UI/UX Audit

Date: 2026-06-22. Scope: make **active (reachable) screens** production-safe — no
fake success, no inert buttons, no mock rows presented as real data, no missing
validation, no blank screens. Behaviour-preserving; **no** new business features,
**no** reintroduced mock, **no** hidden backend failures, **no** marking
future-phase screens complete.

**Status legend:** Fixed / Mitigated (already) / Already-OK / Open / Deferred /
Out-of-scope.

> **"Active" = reachable in the live app.** The live router is `client/src/App.tsx`
> and the live sidebar is `client/src/components/app-sidebar.tsx`.
> `client/src/routes/route-registry.ts` is an **inspection/documentation artifact**
> and is in places stale (e.g. it still marks redirected/legacy routes
> `sidebarVisible:true`); it is **not** the live router or sidebar. Findings below
> are classified against the live router/sidebar, not the registry.

## 1. Reusable infrastructure confirmed (reused, not recreated)
| Concern | Existing infra | Notes |
|---|---|---|
| Loading/Empty/Error/Validation/Pagination/Export states | `client/src/components/report/report-states.tsx` | Used across report pages. No Unauthorized variant (see §2). |
| Table row states | `client/src/components/data-table-state.tsx` | `DataTableStateRow`. |
| Field validation | `client/src/components/ui/field-error.tsx` | `FieldError` + `validationMessages`. |
| Destructive confirm | `client/src/components/ui/alert-dialog.tsx`, `approval-action-modal.tsx` | Standard shadcn AlertDialog. |
| Feature gating | `client/src/lib/feature-flags.ts` | `isSupportModuleEnabled`; Stage 9 adds `isDemoModeEnabled` (Section F). |

## 2. Global guarantees (no per-page duplication needed)
- **Unauthorized (401):** handled centrally in `client/src/lib/queryClient.ts`
  (`handleUnauthorized` clears the token and redirects to `/auth`). Page-level 401
  states are therefore unnecessary; **403** (forbidden action) surfaces as an honest
  error toast via `mutationRequest`/`apiRequestJson`, which throw the backend's
  message instead of faking success.
- **No silent fallbacks on writes:** `mutationRequest`/`apiRequestJson` throw on any
  non-2xx so React Query `onError` fires; mutations report real failures.

## 3. Findings (active / reachable screens)
| ID | File / route | Issue | Classification | Action |
|---|---|---|---|---|
| UIX-01 | `pages/dd-manager-dashboard.tsx` (`/dashboard/dd-manager`, internal) | Reject of a raw `PRODUCT_POSTING` workflow item showed `toast("Project returned successfully (Mock)")` — **fake success** with no API. | **Fixed** | Replaced both occurrences with an honest destructive toast: *"Reject not available — Returning a project at this workflow stage isn't supported yet."* No new API, no false success, modal no longer auto-closes as if it worked. |
| UIX-02 | `pages/it-manager-dashboard.tsx` (`/dashboard/it-manager`, internal) | Two `onClick={() => {}}` icon buttons (Edit Domain, Account Details) — inert affordances. | **Fixed** | Converted to disabled, non-interactive controls (`aria-disabled`, `cursor-not-allowed`, dimmed, `title="… not available yet"`). See `PATCH6_INACTIVE_BUTTON_AUDIT.md`. |
| UIX-03 | `pages/allowed-ip-list.tsx` (`/allowed-ip/drm-ip-list`, admin, sidebar-visible) | Delete fired immediately on click — destructive action with no confirmation. | **Fixed** | Wrapped delete in an `AlertDialog` confirmation naming the IP/CIDR; mutation runs only on confirm. Page already had Loading/Error/Empty states (retained). |
| UIX-04 | `pages/it-servers.tsx` Add Domain (`/it/servers`) | Add-Domain submit validation. | **Already-OK** | `submitDomainForm` already validates required domain, hostname format (`DOMAIN_HOSTNAME_RE`), and expiry-before-activation, rendering `domainFormError` (lines ~517–518). No change. |
| UIX-05 | `pages/office-account-head.tsx` (OFF-001) | Hardcoded `CATEGORIES_DATA` mock chart-of-accounts with non-persisting Add/Edit modals. | **Mitigated (already)** | `App.tsx` redirects `/office/account-head` → `/office/chart-of-accounts` (Stage 7). The mock page is **unreachable**. Component file retained per repo preference ("do not delete backup/scratch files"). No code change. |
| UIX-06 | `pages/office-old-account-head.tsx` (OFF-002) | `console.log` Search stub, static "No records found". | **Mitigated (already)** | `App.tsx` redirects `/office/old-account-head` → `/office/chart-of-accounts`; not present in the live sidebar. **Unreachable.** (`route-registry.ts` still lists it `sidebarVisible:true`, but that file is documentation, not the live sidebar.) No code change. |
| UIX-07 | `components/public-pool.tsx`, `components/customer-list.tsx` | Render hardcoded mock arrays; buttons `console.log` only. | **Dev-only demo (not active)** | Referenced **only** by `components/examples/*`; not mounted on any live route. The live `/customers/public-pool` uses `DynamicPublicPool` → real `ServicePublicPool`/`LeadPools`. Retained per repo preference. See `PATCH6_PRODUCTION_MOCK_GUARD.md`. |
| UIX-08 | `pages/it-manager-dashboard.tsx` domain/invoice tables | Tables render hardcoded `domainDetailsData` / `threeMonthExpireData`. | **Open (internal demo)** | Dashboard is `isInternal:true` (sidebar-hidden, admin/it_manager only). Wiring its tables to real APIs is a new feature, out of bounded Stage-9 scope. Documented; mock guard available (`isDemoModeEnabled`). |
| UIX-09 | Multiple pages — immediate destructive `.mutate` in `onClick` | Delete/void/cancel/reverse fire without a confirm dialog (see `PATCH6_INACTIVE_BUTTON_AUDIT.md` §3 for the full list). | **Deferred** | Only `allowed-ip-list` (named in the approved plan) is fixed this stage. A broad destructive-confirmation sweep across the remaining pages is out of the bounded Stage-9 scope and is documented for a follow-up. All such mutations already surface backend errors honestly (no fake success). |

## 4. What was explicitly NOT changed
- No business workflow, approval logic, role, permission, or formula was altered.
- No mock data was wired to look real; no future-phase screen was marked complete.
- No backup/scratch/demo files were deleted.
- `route-registry.ts` and Stage-8 docs / permission matrices were not modified.
