# Patch 2 — QA Checklist (Stage 9 sign-off)

Status key: **PASS** = verified this stage · **CODE** = verified by reading the
implementation (no behavior change needed) · **MANUAL** = requires an
authenticated interactive run-through (JWT-gated) for final human sign-off ·
**N/A** = not applicable, with reason.

Automated gate this stage: `tsc --noEmit` clean (56 pre-existing baseline
errors, 0 new) · `npm test` **125 passing / 8 files** · `npm run build` succeeds
· dev server boots and serves the SPA (unauthenticated routes correctly redirect
to sign-in, expected `401 /api/auth/me`).

| # | Check | Status | Evidence / Notes |
|---|---|---|---|
| 1 | **No mock/placeholder rows in any production (routed) page.** | PASS | Patch 2 routes render only live API data. `performance-graph.tsx` mock is deprecated/unrouted; `gm-report` city list is a filter dropdown (not records) and `gm-report` is not a Patch 2 route. No fabricated rows added. |
| 2 | **Backend errors are surfaced, never masked with fake data.** | PASS | All list/report queries expose `isError`; error branch shows an explicit message (no silent empty/fallback rows). |
| 3 | **Empty vs error vs loading states are distinct on every table.** | PASS | Each Patch 2 table has separate `isLoading` ("Loading…"), `isError` (red message), and empty ("No … found") branches. |
| 4 | **Error states offer a Retry.** | PASS | Retry buttons added to `salary-create` (preview + runs), `salary-report`, `reports-event`, `reports-reception`, mirroring the existing `raw-attendance` pattern (calls `refetch()`). |
| 5 | **Server exports re-apply list filters + role scope.** | CODE | raw-attendance, salary, reception, day-target, diagnose, bv exports all rebuild the same filter + scope predicates as their list endpoints (verified in route code). |
| 6 | **Export permission is never weaker than view, and not weakened by Patch 2.** | CODE | Export role sets ⊆ behavior of view per `report-permission.ts`; several reports make export *stricter* than view (HOD can view but not export raw-attendance/salary). No export guard changed. |
| 7 | **Client-side CSV (events) only exports already-visible rows.** | CODE | `reports-event.tsx` builds CSV from loaded, scoped rows — no broader data fetch; consistent with the gated view set. |
| 8 | **Terminal/destructive actions require explicit confirmation.** | PASS | Salary **Finalize** and **Cancel** now use an AlertDialog confirmation. Reversible actions (Generate, Approve) remain direct. |
| 9 | **Reason captured where the action is irreversible/audited.** | PASS | Salary finalize/cancel dialog includes an **optional reason** persisted by the status PATCH (audited). Penalty **void** (backend) **requires** a reason. Edit-att reject requires a reason (existing prompt). |
| 10 | **"Penalty" naming is correct (no "Plenty").** | PASS | Grep confirms "Plenty" appears nowhere; the label is "Penalty" throughout. |
| 11 | **"Edit Attendance" naming is correct (not "Edit Allotment").** | PASS | `reports-edit-att.tsx` heading is "Edit Attendance"; no "Allotment" string in the page. |
| 12 | **Confirmation dialogs cannot be dismissed into a partial/ambiguous state.** | PASS | AlertDialog has explicit Cancel/Confirm; pending action + reason cleared on close; confirm disabled while mutation in flight. |
| 13 | **Permission matrix is enforced server-side and documented.** | PASS | `PATCH2_PERMISSION_QA_MATRIX.md` written from live guard code; `report-permission.test.ts` asserts the middleware matrix. |
| 14 | **`admin` / `super_hod` retain full access; fail-closed for everyone else.** | PASS | `ALWAYS_ALLOWED` covers admin/super_hod on every report; guard returns 401/403 with sanitized envelope otherwise (unit-tested). |
| 15 | **BV report create restricts status fields by role.** | CODE | `bv-report-new.tsx` / `bv-reports` create+edit guarded by `requireReportPermission("bv_report","create"/"edit")`; approve/reject is a separate guarded action. |
| 16 | **Row-level scope (own/department) preserved for executives/managers.** | CODE | Reception/diagnose/penalty/bv handlers filter rows by caller identity/department; guard unchanged. Covered by stage8 + penalty + performance team tests. |
| 17 | **No unrelated features or schema/business-logic changes introduced.** | PASS | Stage 9 changes are UI-only (confirmation dialog + retry buttons) plus documentation. No API, schema, route, or permission changes. |
| 18 | **Build/typecheck/test/boot all green.** | PASS | See automated gate above: tsc 0 new errors, 125 tests pass, build OK, dev server boots. |

## Manual sign-off items (auth-gated — for human QA)

These require logging in as each role and are listed for the reviewer; they are
not blockers for code correctness (the underlying guards are unit-tested):

- **M-1** Log in as each role in the matrix and confirm view/export/create
  buttons appear/hide and that a denied action returns a clean 403 toast (no raw
  error). Priority: Accounts, HOD, HR, Reception executive (own-scope), Sales
  executive (own-scope).
- **M-2** Trigger a salary **Finalize** and a **Cancel** end-to-end; confirm the
  dialog, optional reason persistence, and that the run becomes terminal.
- **M-3** Force a report fetch error (e.g. revoke permission mid-session) and
  confirm the error state + working **Retry** on each updated page.
- **M-4** Confirm CSV exports open with the same filtered/scoped rows as the
  on-screen table for raw-attendance, salary, reception, day-target, diagnose, bv.

## Items intentionally **not** changed (with reason)

- Edit-att **reject** keeps `window.prompt` for its required reason — replacing it
  is cosmetic and risks regressing the locked-override flow (architect-confirmed).
- No penalty CSV export and no destructive penalty UI on the Patch 2 add-penalty
  pages — those pages are create + list only; adding export/void/delete controls
  would be new feature scope (see business confirmations in the final report).
