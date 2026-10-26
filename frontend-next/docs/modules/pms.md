# PMS (Project Management System) — migration module doc

Assigned scope per the non-finance migration brief: Tasks, Running Projects, Approvals, Team
Workspace, "other PMS sidebar items." Do not confuse with DRM Setting's `/drm/pms-setting`
(already migrated, unrelated admin config page — skipped here).

**Status: 8 of 10 real pages migrated** (all 8 sidebar-visible pages — the two orphaned,
not-in-sidebar pages remain). See [Implementation status](#implementation-status).

## Route inventory (source of truth: live `frontend/src/App.tsx` + `app-sidebar.tsx`, not the
generated route matrix alone — two discrepancies vs. the matrix are called out below)

| # | Legacy path | Sidebar label | Legacy component | In sidebar? | Canonical Next path |
|---|---|---|---|---|---|
| 1 | `/pms/tasks` | Task System | `PmsTasks` (`pms-tasks.tsx`) | yes | `/dashboard/pms/tasks` **(built)** |
| 2 | `/pms/status` | Project Report | `PmsStatus` (`pms-status.tsx`) | yes | `/dashboard/pms/status` **(built)** |
| 3 | `/pms/running-projects` | Running Projects | `PmsRunningProjects` | yes | `/dashboard/pms/running-projects` **(built)** |
| 4 | `/pms/approvals` | Pending Project | `PmsPendingApprovals` | yes | `/dashboard/pms/approvals` **(built)** |
| 5 | `/pms/task-history` | Task Complete | `PmsTaskHistory` | yes | `/dashboard/pms/task-history` **(built)** |
| 6 | `/pms/complete-closed-projects` | Complete and Closed Project | `PmsCompleteClosedProjects` | yes | `/dashboard/pms/complete-closed-projects` **(built)** |
| 7 | `/pms/team-workspace` | Team Workspace | `PmsTeamWorkspace` | yes | `/dashboard/pms/team-workspace` **(built)** |
| 8 | `/pms/project-report` | Project Report (2nd item, same label as #2) | `PmsProjectReport` | yes | `/dashboard/pms/project-report` **(built)** |
| 9 | `/pms/completed-projects` | — | `PmsCompletedProjects` | **no** (URL-only, orphaned) | `/dashboard/pms/completed-projects` (not built) |
| 10 | `/pms/task-templates` | — | `PmsTaskTemplates` | **no** (URL-only, orphaned) | `/dashboard/pms/task-templates` (not built) |

Alias, not PMS — `/dd-manager/project-report` redirects to `/pms/project-report` (already handled
by legacy app, no Next work needed until #8 is built).

**Not PMS, despite being adjacent in the route matrix / route registry** (flagging so nobody
re-investigates this): `/projects` is a legacy redirect to `/drm/delay-project` (DRM Setting
module). `/projects/upcoming` renders `drm/upcoming-project.tsx` and calls
`/api/hod/projects/upcoming` (HOD module, `hod-routes.ts`) — unrelated backend, unrelated owner.

**Pre-existing UX bug, not introduced by migration**: the sidebar has two menu items both
labelled "Project Report" (#2 `/pms/status` and #8 `/pms/project-report`), pointing at two
different pages with different content. Recommend relabeling #2 to something like "Project
Status Board" during its migration pass — flagging for Habib's sign-off since it's a copy change
on a shared label, not implementing it unilaterally here.

**Correction to an earlier assumption in this doc**: `pms-tasks.tsx` and `pms-status.tsx` (#1 and
#2) were first assessed (via an upstream research pass, not a direct diff) as near-duplicate
forks differing only in header text, with a plan to consolidate into one parameterized view.
**A direct `diff` of the two files disproves this.** `pms-status.tsx` has real, independent
behavior `pms-tasks.tsx` does not:
- A full filter bar (department/city/status/date-range, draft-vs-applied state, "View" button)
  against `GET /api/pms/department-status`'s broader query-param set.
- Auto-applied department filtering for non-admin managers based on role (an `useEffect` that
  guesses a department string from the role name).
- A **stricter, separate** view-gating rule for the project "Eye" action
  (`canViewProjectDetails`), scoped to exactly 9 IT/SEO-SMM/DD/Product-Posting roles — explicitly
  excluding admin, unlike `pms-tasks.tsx` where the Eye/Details action has no such restriction.

Conversely, `pms-tasks.tsx` has the required-links submit-gate (`linksRequirementMet`,
`finishingTaskFilesRes` query) that `pms-status.tsx` lacks entirely.

Blindly merging these would have silently dropped the filter bar and the stricter view-gate from
one page, or bolted the links-gate onto a submit flow it was never built for. Implemented
`/pms/tasks` (Task System) on its own, faithfully, using `src/modules/pms/task-system-view.tsx`.

**Update: `/pms/status` is now also built**, as its own standalone page
(`src/modules/pms/project-status-view.tsx`) with its own distinct filter bar and the stricter
`canViewProjectDetails` gate — not reconciled with Task System's rules, since that reconciliation
is a product decision for Habib, not something to guess at. The two pages' large shared surface
(timer ticking, Files/AddLinks modals, rejection/overtime dialogs, the same task-detail helpers)
was factored out into `src/modules/pms/task-shared.tsx` so this duplication is real code sharing,
not two independent copies of ~300 lines of modal logic — a refactor, not a behavior merge.

## Canonical path decision

Every other migrated module in this app canonicalizes at `/dashboard/<module>/<slug>` (see
`target-system-routes.ts`, `attendance-routes.ts`, etc.). The pre-existing placeholder entries in
`navigation-config.ts`'s `pms` group and `route-access.ts`'s `"/pms"` key used bare `/pms/*` —
that was a draft placeholder from before this module had any real Next pages, not a deliberate
alternate convention (confirmed: `NEXT_MIGRATED_PATHS` had no PMS import at all prior to this
change). **Decision: PMS follows the standard `/dashboard/pms/*` convention**, same as every
other module. `route-access.ts`'s `"/pms"` prefix key does not need to change — `guard-path.ts`'s
`toLegacyGuardPath()` strips the `/dashboard` prefix before the lookup, so `/dashboard/pms/*`
already resolves to the existing `"/pms"` ROUTE_PERMISSIONS entry correctly.

One pre-existing discrepancy worth Habib's awareness, not changed here: `route-access.ts`'s
`"/pms"` role list includes `sales_executive`, `seo_smm_manager`, `seo_smm_executive`,
`complaint_manager` and `manager`; `menu-perm-roles.ts`'s `PMS` list (and the legacy
`app-sidebar.tsx` permKey list it was ported from) does not include `sales_executive` at all.
Net effect: those roles can reach a migrated PMS page directly by URL even though the PMS menu
item itself would stay hidden for them. This predates this work; left as-is (not mine to
widen/narrow someone else's permission boundary without a decision).

## Global backend auth posture (`backend/src/server/routes/pms-routes.ts`)

`app.use("/api/pms", authMiddleware)` is the **only** blanket guarantee for the entire module —
"logged in," nothing more. `checkUrlPermission` (the DB-driven `drm.url_permissions` gate) runs
ahead of it globally but defaults to **allow** when no rule row exists for a path, which is the
case for essentially all of `/api/pms/*` today. Every handler re-confirms `req.user` individually;
role/ownership checks were retrofitted onto *some* handlers (tagged `SEC-003` in code comments)
but not others. This is the literal shape of the module's known `PMS-APPROVALS-AUTH` /
`AUTH-APPROVALS-01` backlog items (`docs/talha-parallel-tasks.md`,
`docs/route-matrix/auth-mapping-backlog.json`) — concrete findings below, organized per page.
**None of these are changed by this pass** — per migration-brief scope, Express auth changes
require Habib's explicit approval. Documenting precisely so nothing is silently ported forward
with false confidence.

## Per-page detail

### 3. Running Projects — `/pms/running-projects` → `/dashboard/pms/running-projects` (BUILT)

- **Legacy**: `frontend/src/pages/pms-running-projects.tsx` — read-only table, client-side
  search, Copy/Excel/PDF export, no pagination.
- **API**: `GET /api/pms/department-status?status=Active&onlyActiveWork=true`
  (`pms-routes.ts:420-571`). Response: `{ id, company, project, status, time, assign, date,
  links: {url,label}[] }[]`. `onlyActiveWork=true` adds a `sales_executive`-only SQL filter
  (project has ≥1 task `InProgress`) — confirmed live against the running dev DB (see Testing).
  Role/department scoping is inline per-request (own `ROLE_DEPT_VARIANTS` copy in this file, not
  shared with the other 4 call sites of the same pattern elsewhere in the file).
- **Auth**: login only, no extra role gate on this specific endpoint (acceptable here — it's
  read-only and already department/ownership-scoped server-side).
- **Next**: `src/modules/pms/running-projects-view.tsx` (`RunningProjectsPage`), route at
  `src/app/(app)/dashboard/pms/running-projects/page.tsx`. Reused `DataTable`, `DrmSection`,
  `PmsShell` (new, `src/modules/pms/pms-ui.tsx`, mirrors `TargetSystemShell`), and the shared
  `src/lib/export/export-utils.ts` (`exportToCSV`/`exportToExcel`/`exportToPDF`) instead of
  porting the legacy page's hand-rolled fake-XLS/`window.print()` export — same three user-facing
  actions (Copy / Excel / CSV / PDF), real file formats under the hood. Workflow unchanged:
  search-filter, no pagination (matches legacy — legacy never paginated this list either).
- **Known gap carried forward unmodified**: none specific to this endpoint beyond the global
  posture above.

### 1. Task System — `/pms/tasks` → `/dashboard/pms/tasks` (BUILT)

- **Legacy**: `pms-tasks.tsx` (1,394 lines) — project list (table view when nothing selected,
  card list once a project is picked) → task detail panel with Add Task form (manager-only),
  per-task timer start/stop with live countdown, submit confirmation, overtime request, rejection
  reason viewer, Time Log History, and a role-conditional "Details" modal (`FilesModal` with
  drag-drop upload + free-text detail for most executives, `AddLinksModal` link-count-gated form
  for Product Posting executives specifically).
- **APIs**: `GET /api/pms/department-status` (bare, no filters — shared endpoint with Running
  Projects), `GET /api/pms/project-tasks/:projectId`, `GET /api/pms/tasks/meta` (`{projects,
  users, priorities}` — verified live), `GET /api/pms/tasks/:id/time-logs`, `POST /api/pms/tasks`
  (create), `POST /api/tasks/:id/timers/start|stop`, `POST /api/tasks/:id/complete`, `POST
  /api/tasks/:id/extensions` (overtime), `GET/POST /api/tasks/:id/files`, `GET /api/auth/me`
  (role gate for Add Task / timer visibility). All verified live against the running dev DB with
  a minted admin JWT — response shapes match the ported types exactly.
- **Known gap carried forward unmodified**: `NotificationService.notify(...)` on task
  assignment/reassignment is a literal `Proxy` no-op stub — task-assignment notifications are
  silent no-ops today, same as on legacy. Not fabricated as working in the port.
- **Next**: `src/modules/pms/task-system-view.tsx` (`TaskSystemPage`, plus the co-located
  `AddLinksModal`/`FilesModal` helper components), route at
  `src/app/(app)/dashboard/pms/tasks/page.tsx` (wrapped in `<Suspense>` for `useSearchParams()`,
  which still reads `?projectId=` to preselect a project exactly like the legacy
  `URLSearchParams` read). The legacy `RichTextEditor`'s `contentEditable`/`execCommand` rich-text
  toolbar was replaced with a plain `Textarea` for the "Detail" field — legacy itself strips all
  HTML tags back to plain text before submitting (`description.replace(/<[^>]*>/g, "")`), so no
  formatting capability was actually being preserved end-to-end; this is a presentation
  simplification with zero workflow change, not a feature cut.

**Bug found and fixed post-ship**: the live page crashed on mount with React's "Maximum update
depth exceeded" (screenshot-reported). Root cause: `const { data: projectTasks = [], ... } =
useQuery(...)` — while the query is disabled (no project selected yet, so `data` stays
`undefined`), that inline `= []` default literal creates a **new** array reference on every
single render. The ticker-baseline `useEffect` depends on `projectTasks`, so it saw a changed
dependency every render, called `setTickerBaselines` with a freshly-constructed object every
time, which triggered another render — an infinite loop bounded only by React's own safety check.
Fixed by hoisting the fallbacks to stable module-level constants (`EMPTY_PROJECTS`, `EMPTY_TASKS`,
`EMPTY_TIME_LOGS`) so the reference stays identical across renders when data is genuinely absent.
Applied the same pattern proactively in the new `/pms/status` page below, which shares this exact
query shape.

### 2. Project Report (status) — `/pms/status` → `/dashboard/pms/status` (BUILT)

- **Legacy**: `pms-status.tsx` (1,473 lines). Same task-detail/timer/files machinery as Task
  System, wrapped in a different list page: a filter bar (Department — auto-applied and locked
  for non-admin managers based on a role→department guess; City; Status; Start/End Date) with a
  draft-vs-applied "View"/"Reset" flow, and a `canViewProjectDetails` gate on the row-level
  Eye/Details action restricted to exactly 9 IT/SEO-SMM/DD/Product-Posting roles (admin
  deliberately excluded — confirmed real, not an oversight, via direct diff against
  `pms-tasks.tsx`). The submit-confirmation dialog here always shows the generic message — no
  required-links gate, unlike Task System.
- **API**: same `GET /api/pms/department-status`, now with its full query-param set
  (`department`/`city`/`status`/`startDate`/`endDate`) exercised, plus the same task/timer/files
  endpoints as Task System.
- **Next**: `src/modules/pms/project-status-view.tsx` (`ProjectStatusPage`), importing
  `FilesModal`/`AddLinksModal`/helpers from the new shared `task-shared.tsx` rather than
  duplicating them. Built from the start with the stable-empty-array pattern (see the Task System
  bugfix note above) since it shares the identical query/effect shape.

### 4. Pending Project (Approvals) — `/pms/approvals` → `/dashboard/pms/approvals` (BUILT — read this before touching it)

**The sidebar label is misleading.** This page has **no Approve/Reject UI**. It is a
document-upload page: projects in `Documents Pending`/`Active`/`OnHold`, each with an "Upload
Documents" modal (Package, Minisite URL, Phone, Mobile, Address, Reference, Categories, Detail,
single file). No required-field validation beyond `maxLength`.

- **List API**: `GET /api/pms/pending-documents` (`pms-routes.ts:274-417`). Reads
  `drm.projects` joined across `customers`, invoices, `users`, `project_financials`,
  `product_posting_workflows`, `project_details`. `hodApprovedAt`/`accountsApprovedAt` are sourced
  from invoice columns, not a dedicated approvals table.
- **Upload API**: `POST /api/projects/:id/documents` (multipart, `project-doc-routes.ts:31-223`,
  mounted separately at `/api/projects`, not `/api/pms`). Real disk storage via multer (15MB).
  **Auth gap**: `if (!req.user) 401` only — no ownership/role check. Any authenticated user can
  upload onto any project id.
- **The actual approve/reject action lives elsewhere**: `PUT
  /api/projects/documents/:id/verify` (`project-doc-routes.ts:234-281`), called from
  `dd-manager-dashboard.tsx` / `product-posting-dashboard.tsx` — sibling manager dashboards, not a
  `/pms/*` page, out of this module's scope but flagging because it's the thing that actually
  flips the status this page displays. **Same auth gap**: login-only, any role can approve/reject
  any project's documents.
- **Dormant parallel REST family** also exists (`/api/pms/approvals*`,
  `pms-routes.ts:1985-2184`, backed by `drm.project_approvals` / `projectApprovalsRepository`) —
  **confirmed unused by any current frontend page.** Per-endpoint auth, concretely:

  | Endpoint | Auth beyond login | Finding |
  |---|---|---|
  | `GET /approval-stats` | none | global pending/approved/rejected counts leak to any user |
  | `GET /approvals/:id` | none (`findById` unscoped) | IDOR — read any approval record by id |
  | `POST /approvals/:id/approve`\|`reject` | `canDecideApproval()` — managerial role OR
    `approverUserId === self`, plus status-already-decided guard | **properly fixed** (tagged
    `SEC-003`) |
  | `GET /projects/:id/approvals` | none (`findByProjectId` unscoped) | IDOR — any project's full
    approval history readable by any authenticated user |
  | `POST /projects/:id/approvals` (create) | **none at all** | **worst finding in the module**:
    `insertProjectApprovalSchema` only omits `id/createdAt/updatedAt/approverUserId/approvedAt/
    rejectionReason` — NOT `status`/`approvedBy`. Any authenticated user can `POST` a record that
    already reads `status:"Approved", approvedBy:<self>`, completely bypassing the
    `canDecideApproval` gate protecting the sibling endpoint. |

  This two-faced shape (live upload-and-verify flow with zero role gate; dormant generic-approvals
  REST family with approve/reject fixed but list/detail/create left open) **is** the concrete
  content of the `PMS-APPROVALS-AUTH` / `AUTH-APPROVALS-01` backlog tickets — now fully specified
  instead of a vague "needs audit" note.
- **Implementation stance**: port the page the legacy app actually ships (document upload), not
  the sidebar label's implication of an approve/reject screen. Do not add a frontend-only
  approve/reject control against the dormant REST family — that would be inventing a workflow the
  legacy app never shipped, and would expose the unfixed `create`/`list-by-project`/`detail` IDORs
  to a real UI surface for the first time. Needs Habib's decision before any of that family is
  wired to a page.
- **Next**: `src/modules/pms/pending-project-view.tsx` (`PendingProjectPage`). Ported the
  document-upload workflow exactly (status/badge logic, `isVerifiedNow`/`sentToManager` priority
  rules, re-upload lock, department label mapping), using the shared `export-utils.ts` for
  Copy/Excel/CSV/PDF in place of the legacy fake-XLS/`window.print()`. Live-verified
  `GET /api/pms/pending-documents` against the dev DB — shape matches exactly.

### 5. Task Complete (history) — `/pms/task-history` → `/dashboard/pms/task-history` (BUILT)

Manager review queue (approve → `Completed`, reject → `Blocked`+reason) + history feed with
Send-to-QA / Send-to-Verification / Close / Reassign actions. Best-gated page in the module:
`GET /tasks/pending-review` silently empties for non-managers (server-enforced, not just
hidden), `send-to-qa`/`send-to-verification`/`close` all check `isManagerialRole()` plus a
state-machine guard. `PATCH /task/:id/status` delegates the manager/ownership check into
`pms-transition.service.ts` (a genuinely-fixed former stub — safe to port its logic as-is).
**Next**: `src/modules/pms/task-history-view.tsx` (`TaskHistoryPage`) — sortable columns ported
as clickable `DataTable` headers (`DataTableColumn.header` accepts a `ReactNode`, so the sort
button lives directly in the header cell rather than needing a bespoke table). Both
`/api/pms/task-history` and `/api/pms/tasks/pending-review` live-verified with real rows.

### 6. Complete and Closed Project — `/pms/complete-closed-projects` → `/dashboard/pms/complete-closed-projects` (BUILT)

Read-only, best-built endpoint alongside Task History: `GET
/api/pms/complete-closed-projects` correctly 403s non-managers server-side
(`pms-routes.ts:2847-2849`) with its own department filter. **Next**:
`src/modules/pms/complete-closed-projects-view.tsx`. Live-verified with real completed-task rows.

### 7. Team Workspace — `/pms/team-workspace` → `/dashboard/pms/team-workspace` (BUILT)

Slack-style workspaces → channels (projects) → tasks. `GET
/api/pms/team-workspace/assignments` is real-SQL, properly scoped (`sales_manager` → owned
projects, others → `project_assignments` membership). **Auth gap**: the *unused-by-this-page*
`POST`/`DELETE /api/pms/projects/:id/team[/:assignmentId]` (add/remove any user from any
project's team) and `GET /api/pms/team-workspace` (singular — roster enumeration) have no
role/ownership check, login only. **Next**: `src/modules/pms/team-workspace-view.tsx`
(`TeamWorkspacePage`). The legacy page's "Add Workspace"/"Add Channel" actions are purely
informational (they don't create anything server-side either — workspaces/channels are derived
entirely from project assignments); preserved as the same toast-only no-ops rather than silently
dropped or given new backing the legacy app never had. Live-verified
`GET /api/pms/team-workspace/assignments` (returned an empty set for the admin test user, which
is a correct empty-state result, not a broken call — admin owns no project assignments).

### 8. Project Report — `/pms/project-report` → `/dashboard/pms/project-report` (BUILT)

Best-built endpoint in the whole module — `canViewProjectReport()` (`isManagerialRole`) 403s
executives server-side, validates dates, clamps `limit` to an allow-list. Shared handler also
backs `/api/dd-manager/project-report` and `/api/reports/projects`; the legacy page actually
calls the `dd-manager` path, not `/api/pms/project-report` — ported against that same live path.
**Next**: `src/modules/pms/project-report-view.tsx` (`ProjectReportPage`), using the shared
`PaginationBar` component in place of legacy's hand-rolled numbered-page footer (same
prev/next/showing-X-of-Y capability). Live-verified: 56 total rows across 6 pages for the test
date range, `pagination` object shape matches exactly.

### 9. Completed Projects — `/pms/completed-projects` (NOT BUILT, orphaned from sidebar)

Read-only; `time`/`link` columns are hardcoded `"-"` in the legacy page (never wired to real
data — port as the same static placeholder, don't invent data the legacy page never had).
**Confirmed data-scoping stub**: `GET /api/pms/projects` calls `getDepartmentFilterUserIds()`
(`dashboard-routes.ts:31-41`), a literal stub that always returns `null` → every managerial role
(not just true admins) sees unfiltered cross-department data. Two sibling call sites in this same
file (`running-projects`/`summary`) already manually bypass this stub for `sales_manager`; this
endpoint and `GET /api/pms/tasks` do not have that workaround applied. Port the page as-is; do
not attempt to fix the stub (backend change, needs Habib's approval) — but do not quietly build a
nicer frontend on top of it either without this note traveling with the PR.

Decide with Habib before building: carry this page forward with a sidebar entry, or leave it
URL-only like today.

### 10. Task Templates — `/pms/task-templates` (NOT BUILT, orphaned from sidebar)

Full CRUD (React Hook Form + zod) for reusable task templates. **Auth gap**: every handler
(`GET/POST/PATCH/DELETE /api/pms/task-templates*`) is login-only — any authenticated user can
create/edit/soft-delete global templates. Also: the department `<Select>` options in the legacy
page ("Sales Department", "Marketing Department", …) don't match any real `department_type`
value used elsewhere in this backend file (`PRODUCT_POSTING`, `SEO_SMM`, `DND`, `IT`, `SOFTWARE`,
`SERVICE`) — department filtering is effectively non-functional against real data today. Note:
`frontend/src/pages/pms-settings.tsx` (plural, distinct from the singular `pms-setting.tsx` DRM
Setting page) is dead/unrouted — not part of this module, don't port it.

## Other confirmed stubs/dead backend surfaces (not fixed, documented per brief §6)

- `AuditLogService` — same `Proxy` no-op pattern as `NotificationService`, never even imported in
  `pms-routes.ts`. PMS actions leave no audit trail today, stub or otherwise.
- `POST /api/pms/department-assignment` — comment literally says "For now, just log and return
  success... persists nothing."
- `GET /api/pms/department-stats` — always returns `{}`.
- `GET/POST /api/pms/settings` — only `projectCreationMode` persists (real, gated
  `isManagerialRole` on write); every other field round-trips without being saved.
- `GET /api/pms/running-projects` (+ `/summary`, `/financials`, `/payments`, `PATCH .../status`,
  `pms-routes.ts:1629-1985`) — a fuller "running projects with financials" REST surface that no
  frontend page calls. Confirmed dead via grep across all pages. Decide with Habib whether to
  port (richer feature) or leave dormant before touching it.
- `hod-routes.ts`'s `GET /projects/upcoming` and `/projects/delayed` sit **above**
  `router.use(requireHod)` — same "per-handler auth not fully extracted" shape as the PMS
  findings, just in a different file. Out of this module's scope (HOD, not PMS) but flagging
  since it's the identical failure pattern and easy to fix alongside if Habib wants a combined
  pass later.

## Implementation status

| Page | Status |
|---|---|
| Running Projects | **Done** — view, route, nav entry, legacy redirect, tests, typecheck, build pass; live API verified |
| Task System | **Done** — view, route, nav entry, legacy redirect; live API verified; one post-ship infinite-render bug found via browser testing and fixed (see §1 bugfix note) |
| Project Report (status, `pms-status.tsx`) | **Done** — own filter bar + stricter view-gate, not reconciled with Task System (needs Habib's product decision on that); shares `task-shared.tsx` modal code |
| Pending Project (Approvals) | **Done** — view, route, nav entry, legacy redirect; full auth-gap breakdown documented; live API verified |
| Task Complete (history) | **Done** — view, route, nav entry, legacy redirect; live API verified (task-history, pending-review) |
| Complete and Closed Project | **Done** — view, route, nav entry, legacy redirect; live API verified |
| Team Workspace | **Done** — view, route, nav entry, legacy redirect; live API verified |
| Project Report | **Done** — view, route, nav entry, legacy redirect; live API verified (pagination confirmed against 56 real rows) |
| Completed Projects | Documented, not built — needs Habib decision on sidebar visibility |
| Task Templates | Documented, not built |

All 8 built pages: `npm run typecheck` clean, full `npm test` 137/137 passing, production build
(`next build --webpack`) compiles all 8 new routes as static pages with zero errors.

## Files touched this pass

- `src/lib/navigation/pms-routes.ts` (new — 8 route constants, sidebar-paths array, legacy-redirect array)
- `src/lib/navigation/pms-routes.test.ts` (new)
- `src/lib/navigation/migrated-routes.ts` (added PMS import + spread)
- `src/lib/navigation/legacy-redirects.ts` (added PMS import + spread)
- `src/lib/navigation/navigation-config.ts` (all 8 PMS nav hrefs now import canonical constants;
  "Project Report (alt)" / `PMS_PROJECT_REPORT` nav entry removed from the sidebar per explicit
  request — the page itself stays fully built and reachable at `/dashboard/pms/project-report`,
  only the nav link is hidden for now)
- `src/modules/pms/pms-ui.tsx` (new — `PmsShell`, re-exports `DrmSection` et al.)
- `src/modules/pms/running-projects-view.tsx` (new)
- `src/modules/pms/project-report-view.tsx` (new)
- `src/modules/pms/complete-closed-projects-view.tsx` (new)
- `src/modules/pms/team-workspace-view.tsx` (new)
- `src/modules/pms/task-history-view.tsx` (new)
- `src/modules/pms/pending-project-view.tsx` (new)
- `src/modules/pms/task-shared.tsx` (new — `FilesModal`, `AddLinksModal`, shared task-detail
  helpers/types, factored out of Task System and reused by Project Report/status)
- `src/modules/pms/task-system-view.tsx` (new — now imports shared modal code instead of
  duplicating it; fixed a post-ship infinite-render bug, see §1)
- `src/modules/pms/project-status-view.tsx` (new)
- `src/app/(app)/dashboard/pms/layout.tsx` (new)
- `src/app/(app)/dashboard/pms/{running-projects,project-report,complete-closed-projects,
  team-workspace,task-history,approvals,tasks,status}/page.tsx` (new, 8 route files)
- `package.json` (`test:navigation` script now includes `pms-routes.test.ts`)
- `docs/modules/pms.md` (this file)
