# PATCH 7 — Active-Screen UI/UX Audit (Stage 8, Section C · UI-001)

**Date:** 2026-06-30. Grep-driven audit of the **active** client surface
(`client/src`) for mock data, no-op controls, fake success, and missing states.
"Active" = reachable through a route registered in `client/src/App.tsx`.
Action legend: **fixed** · **hidden** · **dev-only** · **acceptable** · **open**.

## Findings

| # | File | Route | Issue | Active? | Action / disposition |
|---|---|---|---|---|---|
| 1 | `components/performance-graph.tsx` (`mockData`, L9/L27) | — | LineChart bound to a hard-coded `mockData` array | **No** — component imported by **nothing** in `client/src` (only its own examples twin) | **open (not user-visible)** — dead/unused component; recommend deletion; retained under no-delete policy |
| 2 | `pages/create-target.tsx` (`dummyData`, L12) | `/target-system/create` | leftover `dummyData` array | **Yes**, but **not rendered** — table renders real `targets` from `/api/target-system/targets` with loading + empty states (L319–350) | **open (dead variable)** — not shown to users; recommend removal |
| 3 | `pages/it-manager-dashboard.tsx` (`alert("Duplicate search initialized.")`, L766) | IT manager dashboard | no-op fake-action button (alert, no API) | **Yes** | **open** — tracked under UI-001; not rewired this stage to honor the no-UI-rewrite constraint; recommend hide/disable-with-reason or wire to real search |
| 4 | `pages/user-reports.tsx` (`// TODO: implement loan payment submission`, L1251) | user reports | unimplemented submit path | **Yes** | **open** — submit path incomplete; recommend disable control until backend exists |
| 5 | `pages/it-manager-dashboard.tsx` `window.print` L1190; `alert("Table data copied")` L1216 | IT manager dashboard | print + clipboard utility | Yes | **acceptable** — real browser utilities, not no-ops |
| 6 | `pages/software-manager-dashboard.tsx` `alert(error.message)` L802; `alert("Please select a decision")` L809 | software manager | ad-hoc validation/error messaging via `alert()` | Yes | **acceptable** — surfaces **real** errors/validation (not fake success); cosmetic upgrade to `FieldError` recommended |
| 7 | `pages/service-*.tsx` (≈14 pages) `alert("Table data copied to clipboard!")` + `window.print` | service report pages | clipboard/print confirmations | Yes | **acceptable** — genuine utility actions tied to real data; not no-op |
| 8 | `pages/dd-manager-dashboard.tsx` L277; `components/verification-manager-widget.tsx` L152; `components/qa-manager-widget.tsx` L717 | DD/QA/verification | comments noting **removed** `localStorage` mock queues | Yes | **fixed (prior stage)** — now backend-driven; comments are historical |
| 9 | Empty `=> {}` submit/click handlers | — | — | — | **none found** (grep clean) |
| 10 | `console.log` in `app-sidebar`, `lead-pools`, `notification-dropdown`, etc. | various | dev logging (not handler bodies) | Yes | **dev-only / acceptable** — diagnostics, not user-facing controls |

## Requirements check (Section C acceptance)

| Requirement | Status | Notes |
|---|---|---|
| No active submit button is a no-op | **Mostly met** | 2 genuine exceptions open: #3 (fake "Duplicate search"), #4 (loan-payment TODO). All other submits call real APIs. |
| Field-level validation on active forms | **Met (code-verified)** | zod on write endpoints; client `FieldError` component; invalid input → 400 (server) |
| Confirmation dialogs for destructive/approval actions | **Partial** | `AlertDialog` present on many flows; some reverse/delete paths lack confirm (tracked OFF-006, DOM-002) |
| Loading / empty / error / unauthorized states | **Mostly met** | e.g. create-target shows loading + empty; 401/403 handled centrally via `apiRequest`; a few raw `fetch` pages (API-001 Partial) |
| API failure never shows fake data | **Met** | queries throw on `!res.ok`; no silent mock fallback found on active screens (mock arrays #1/#2 are not rendered) |
| Invalid actions disabled with reason | **Partial** | many controls gate on role/state; #3/#4 are the open exceptions |

## Disposition summary
- **No fake-success-with-fabricated-data controls render on active screens.** The two
  mock arrays found (#1, #2) are **dead code**, not displayed. Two inert controls do
  exist and are recorded **open** below: #3 shows an `alert()` instead of performing a
  real search, and #4 is an unimplemented submit (TODO). Neither displays fabricated
  data or a false success state; both are visibly non-functional and tracked, not
  silently passed off as working.
- **2 genuine open items** (#3 no-op alert button, #4 loan-payment TODO) are recorded
  **open** under UI-001 rather than silently rewritten, honoring the additive /
  no-UI-rewrite constraint. Neither shows fake data; both are visibly inert controls.
- **UI-001 status: Partial** — active screens are honest (real data, real errors,
  proper empty/loading), with the two inert controls and a few confirm-dialog gaps
  remaining.
