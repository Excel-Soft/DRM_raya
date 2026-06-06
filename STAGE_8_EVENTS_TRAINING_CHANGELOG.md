# Stage 8 — Events, Reception Report, Training Alignment, Notice/Policy Audit

Scope: complete event persistence/workflow, connect the reception report to real
reception-meeting data, align/verify the training subcategory endpoint, and add
audit + role enforcement to notices and policies. DB is empty → every page renders
real-or-empty (no fabricated rows). Stages 1–7 untouched. No app redesign. No
reception meeting workflow changes.

## Files changed

### Backend
- `server/events-routes.ts` **(NEW)** — full Events backend (CRUD + speakers + menu
  + duties + report), idempotent table DDL, validation, status workflow, audit.
- `server/routes.ts` — import + `await registerEventsRoutes(app)` mounted after the
  auth + permission middleware (next to the Stage 7 DRM registrations).
- `server/stage3-reports-routes.ts` — replaced the empty `/api/reports/reception`
  stub with a real reception-meeting query (filters + pagination). `parseDateRange`
  now also accepts `dateFrom`/`dateTo` (still accepts `startDate`/`endDate`).
  `/api/reports/event` left untouched.
- `server/notice-routes.ts` — audit logging + managerial/HOD/admin role gate on
  create/update/delete/assign.
- `server/policy-routes.ts` — audit logging + role gate on create/delete (no PATCH
  route exists).

### Frontend
- `client/src/pages/events-add.tsx` — mock/local-state removed; real event CRUD +
  speaker CRUD; client validation; status select; "Venu" → "Venue" fixed (label +
  table header).
- `client/src/pages/events-menu.tsx` — event selector + menu-item CRUD wired to API.
- `client/src/pages/events-duty-planner.tsx` — event selector + duty CRUD wired to API.
- `client/src/pages/reports-event.tsx` — repointed to `/api/events/report`
  (persisted events) with date-range/type/status/venue/speaker filters, totals row,
  CSV export.
- `client/src/pages/reports-reception.tsx` — repointed to the now-real
  `/api/reports/reception` (reception meetings) with user/status/date filters +
  server-side pagination; columns adapted to meeting fields.
- `client/src/pages/training-center.tsx` — normalized the videos query cache key
  (the actual fetch already targeted the correct endpoint).

## APIs added / modified

### Events (all `/api/events*`, protected; auth required, fails closed)
- `GET    /api/events` — list `{data,total,page,pageSize}`; filters search, status,
  type, venue, dateFrom, dateTo; each row includes aggregated `speakers[]`.
- `POST   /api/events` — create (validated; `created_by` = req.user).
- `GET    /api/events/:id` — event + `speakers[]` + `menuItems[]` + `duties[]`.
- `PATCH  /api/events/:id` — update (`updated_by` = req.user).
- `DELETE /api/events/:id` — soft delete (`deleted_at`).
- `POST/PATCH/DELETE /api/events/:id/speakers[/:speakerId]`.
- `GET/POST/PATCH/DELETE /api/events/:id/menu-items[/:itemId]`.
- `GET/POST/PATCH/DELETE /api/events/:id/duties[/:dutyId]`.
- `GET    /api/events/report` — registered BEFORE `/api/events/:id` so it is not
  captured by the param route; filters dateFrom, dateTo, type, status, venue,
  speaker; returns `{data,total,page,pageSize, totals:{attendance,cost}}`.

### Reports
- `GET /api/reports/reception` — was an empty stub; now queries reception meetings
  from `drm.meetings` (LEFT JOIN customers) with dateFrom/dateTo, status, userId
  filters + pagination `{data,total,page,pageSize}`.

### Training
- No backend change. `GET /api/training/subcategories/:subId/videos` already exists
  and the frontend already called it; cache key normalized for clarity.

## DB changes (schema `drm`, raw idempotent DDL, no drizzle-kit push, no schema.ts edits)
New tables (created at startup via awaited `ensureEventsTables()`):
- `drm.events` — id uuid pk; name; event_type; event_date date; start_time/end_time
  text; venue; amount numeric(12,2); attendee_count int; map_url; status
  ('Draft' default); notes; created_by/updated_by → users(id) ON DELETE SET NULL;
  created_at/updated_at; deleted_at; + indexes.
- `drm.event_speakers` — event_id → events(id) ON DELETE CASCADE; speaker_name;
  topic; detail; start_time/end_time.
- `drm.event_menu_items` — event_id CASCADE; item_name; assigned_user_id →
  users(id) SET NULL; assigned_role; scheduled_date/time; status ('pending'); notes.
- `drm.event_duties` — same shape as menu items with `duty` instead of `item_name`.
No existing tables altered.

## Validation rules (Event create/update → 400 + message)
- `name` required.
- `event_date` must be a valid date.
- if both `start_time` and `end_time` provided → start must be before end.
- `attendee_count` integer ≥ 0.
- `amount` ≥ 0.
- `map_url` must be http(s) when provided.
- `status` ∈ {Draft, Completed, Cancelled}.
Client-side validation mirrors the backend in events-add.tsx.

## Event status workflow
Implemented the core lifecycle **Draft / Completed / Cancelled** only.
`Approved` and `Published` are intentionally NOT implemented — there is no
confirmed business approval workflow for events yet (per the task's "if approval
is not approved by business yet" branch). They can be added later as a gated
transition.

## Audit behavior
- `ActivityLogService.log({userId, action, resourceType, resourceId, details})`
  (writes to `activity_logs`).
- Events: create/update/delete logged (resourceType `event`).
- Notices: create/update/delete/assign logged (resourceType `notice`).
- Policies: create/delete logged (resourceType `policy`).
- Role enforcement: notice and policy mutations now require a managerial/HOD/admin
  role (`isManagerialRole`) → 401 if unauthenticated, 403 if not authorized. GET
  endpoints remain open to any authenticated user. Existing response shapes
  preserved.
- Events: ALL mutation endpoints (event/speaker/menu-item/duty create/update/
  delete) are gated by `canManageEvents` (`isManagerialRole`) via a shared
  `denyEventMutation` guard → 401 unauthenticated, 403 non-managerial. Event read
  endpoints (list, report, detail, menu-item list, duty list) remain open to any
  authenticated user. (Added in response to code review.)

## Test results
- `npx tsc --noEmit`: no NEW errors in any changed file. Remaining errors are the
  pre-existing baseline in `server/debug-routes.ts` and `server/reports-routes.ts`
  (untouched this stage).
- `npm run build`: passes (built in ~30s).
- Clean workflow restart on port 5000; `ensureEventsTables()` ran without error;
  all four `drm.event*` tables confirmed present.
- Endpoint protection (unauthenticated): `GET /api/events`, `GET /api/events/report`,
  `POST /api/events`, `GET /api/reports/reception` all return 401 (protected, not
  public, not 404).
- All six edited frontend pages hot-reloaded with no LSP/runtime errors.

## Notification helper (task G) & communication log (task H)
- Task G (notification abstraction): the shared `NotificationService` (in
  `server/services/notification-service.ts`) already centralizes notification
  creation and is reused across task assignment, QA/rework, verification, HR
  approvals, service follow-ups, and salary/increment/penalty decisions. Rather
  than introduce a parallel `createNotification` and risk breaking existing
  notifications, the Stage 8 module was wired into that same abstraction:
  `server/events-routes.ts` now fires a fire-and-forget `NotificationService.notify`
  on **event duty assignment** (duty create with an assignee, and reassignment via
  PATCH) — the "event duty assignment" target named in task G. Verified live: a
  duty assigned to a user creates a `drm.notifications` row
  ("You have been assigned an event duty: …").
- Task H (communication_logs): intentionally NOT added. No external
  email/SMS/WhatsApp provider is configured, and the spec says not to add
  providers. An empty log table with no producer would be dead code, so it is
  deferred until a real internal/external channel exists.

## Re-verification (live authenticated smoke)
A later pass ran live authenticated smoke (admin JWT) against every Stage 8
endpoint — the HTTP smoke the original pass could not do. All green, no runtime
bugs found:
- Events: `GET /api/events` (200), `POST` create (201), `POST` speaker/menu-item/
  duty (201 each), `GET /api/events/:id` returns persisted `speakers[]`,
  `menuItems[]`, `duties[]`, `PATCH` status→Completed (200), invalid times →
  400, `DELETE` soft delete (200).
- `GET /api/events/report` (200), `GET /api/reports/reception` (200, empty),
  `GET /api/training/tree` + `/summary` (200), `GET /api/notices` + `/api/policies`
  + `/api/notifications` (200).
- Duty assignment notification verified (notifications count incremented).
- `npm run check`: unchanged baseline (57 pre-existing errors; none new, none in
  `events-routes.ts`).

## Known limitations
- DB is empty → all pages show empty states until data is entered. No authenticated
  HTTP/visual smoke test (no dev admin password); verified via build/boot/DDL/
  auth-guard probes.
- Event status limited to Draft/Completed/Cancelled (Approved/Published deferred,
  see above).
- `reports-event.tsx` now reports persisted **events** (`drm.events`) rather than
  the previous meeting log (`/api/reports/event` over `drm.meetings`). The old
  meetings endpoint is left intact and unused by this page.
- `reports-reception.tsx` columns changed from payment-style (Amount/Method) to
  reception-meeting fields (Company/Person/Type/Date/Start/End/Duration/Status),
  because reception data lives in `drm.meetings`, not a payments source.
- `drm.meetings` has no dedicated "reception" discriminator (reception-routes
  treats all meetings rows as reception meetings); the reception report mirrors
  that same semantics.
- Event menu/duty `status` enum is loose text (pending/in_progress/completed/
  cancelled) — not constrained at the DB level.
