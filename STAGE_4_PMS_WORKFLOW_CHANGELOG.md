# Stage 4 — PMS / Project / Task / Report / Product-Posting / Workflow

Production-readiness pass for the PMS and workflow screens: mock/fake data
removed, screens wired to real APIs with honest loading/empty/error states, a
reusable workflow timeline added, timer UX surfaced, and validation/security
gaps closed on the backend. No business-workflow, approval-logic, role, or
permission changes were made beyond validation and a security fix. No UI
redesign — only data sources, states, and small controls were changed within
the existing layouts.

## Screens converted to real data (mock removed)

- **pms-completed-projects.tsx** — Removed `COMPLETED_MOCK`. Now reads
  `GET /api/pms/projects?status=Completed` and resolves owner names from
  `GET /api/pms/users`. Columns with no real source (Time, Link) show `-`
  rather than fabricated values. Loading / error / empty states added.
- **pms-status.tsx** — Removed `MOCK_FALLBACK_TASKS` and all
  `task-mock` branches. Tasks/projects/time-logs come from the real PMS APIs.
  Removed the fabricated project-overview values (hardcoded `localhost` URL,
  phone, mobile, address, categories) — now real fields or `N/A`. Removed the
  orphaned `localStorage('dd-projects')` synthetic transfer write (its only
  reader was removed); modal-close behaviour preserved. Timer UX wired to the
  real timer endpoints (see below).
- **pms-task-history.tsx** — Removed `MOCK_HISTORY` and the localStorage
  synthesis. Now reads the real status-history list endpoint. Replaced
  `window.confirm(...)` with an AlertDialog + toast. Columns the list endpoint
  does not provide (company, QA/VM, links) render as empty / `N/A` rather than
  fabricated data (known limitation — no list-level source).
- **pms-tasks.tsx** — Removed `INITIAL_TASKS` and localStorage-only
  persistence. Wired to the task-templates APIs (list / create / delete) with
  query invalidation and toasts. Loading / error / empty states added.
- **pms-team-workspace.tsx** — Removed `FALLBACK_PERSON_OPTIONS` and
  `initialWorkspaces`; removed the `software_tasks` localStorage path. Wired to
  the real team-workspace assignments and project-tasks endpoints; create uses
  a real mutation with invalidation. Every `alert()` replaced with toast /
  inline messaging. Loading / error / empty states added.
- **product-posting-dashboard.tsx** — Removed the `mock_pp_approved_queue`
  localStorage fallback and the stale static-mock comment; the verify flow now
  uses `apiRequestJson` so backend errors surface honestly.

## Screen verified (already real, no change needed)

- **pms-project-report.tsx** — Already backed by
  `GET /api/dd-manager/project-report` with the full D&D column set. No mock
  present. Verified only.

## New reusable component

- **client/src/components/workflow-timeline.tsx** — Given a `taskId` + module,
  merges status-history + rework-history + evidence-link timestamps into one
  chronological timeline. Loading / error / empty states; invents no data.
  Embedded (where a real `taskId` is in scope, no redesign) in:
  qa-manager-widget, verification-manager-widget, product-posting-executive-widget.
  Not embedded in the software manager/executive dashboards, which operate on
  locally-derived rows without real PMS task IDs (would fetch meaningless data).

## Timer UX (pms-status)

- Wired to existing endpoints: `POST /api/tasks/:id/timers/start`,
  `/timers/stop`, `/complete`, `/extensions`.
- Visible running-timer state, start/stop controls, and a client-side
  one-active-timer-at-a-time rule with a clear blocking toast.
- Time-log history table fed by `GET /api/pms/tasks/:id/time-logs`.

## Settings canonicalization

- Canonical PMS settings route remains `/drm/pms-setting`.
- Added a deprecated alias: `/pms/settings` now redirects to `/drm/pms-setting`
  (wouter `<Redirect>`). No settings engine duplicated; nothing deleted.

## APIs added / modified

- No new endpoints. Existing endpoints reused.
- **Modified behaviour (validation/security only):**
  - `POST /api/product-posting/tasks/:taskId/verification-review` and the
    software equivalent — `action: "return"` now requires non-blank `remarks`
    (returns 400 otherwise). (QA return already enforced remarks.)
  - `POST /api/product-posting/tasks/:taskId/evidence-links` and the software
    equivalent — URL is trimmed and validated as `http`/`https` (400 on
    invalid), and duplicate URLs per task are rejected (409). Stored URL is the
    trimmed value. Frontend surfaces these messages via toast.

## DB changes

- None. No schema migrations, no tables added/dropped/altered.

## Security

- Fixed a SQL-injection-prone raw query in
  `server/routes/software-workflow-routes.ts` (assign-task invoice lookup) —
  replaced string interpolation with a parameterized `sql` query (matches the
  product-posting route pattern).

## Notifications

- Existing `NotificationService.notify(...)` calls for assignment, overtime,
  QA/verification return, and submission were verified to remain wired. No new
  notification events were added (none required that were low-risk); workflow
  transitions already notify the relevant manager/queue.

## Tests run

- `npm run check` — 58 type errors, all pre-existing server-side repository
  errors; below the 64 baseline; zero errors in any changed file.
- `npm run build` — succeeds (~30s, frontend + server bundle).
- Dev smoke: app restarts and serves on port 5000; `/api/auth/me` returns 401
  without a token (expected); unauthenticated UI renders the sign-in page;
  no runtime errors in workflow logs.
- Architect review run; the one severe finding (SQL injection above) was fixed,
  and the flagged fabricated pms-status values were removed.

## Unresolved / known limitations

- **pms-task-history**: company, QA/VM reviewer, and per-row links are not
  available from the status-history list endpoint, so they render empty/`N/A`.
  Surfacing them would need a new list-level endpoint (out of scope / would
  require backend additions).
- **Software manager/executive dashboards**: still operate on locally-derived
  task rows for some interactions, so the workflow timeline was not embedded
  there; converting them to real PMS task IDs is a larger follow-up.
- Pre-existing 58 server-side type errors remain (untouched; not part of this
  stage).
