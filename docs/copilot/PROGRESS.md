# WebExcels DRM Copilot V1 — Progress

Status key: `done` / `in-progress` / `blocked` / `not-started`

## M0 — Baseline inspection (done)

Verified against the live checkout on 2026-10-22, not assumed from the brief.

### Existing AI assistant (the thing we are upgrading, not duplicating)

- Launcher: `frontend/src/components/ai-assistant-button.tsx` — floating FAB, portaled to
  `document.body`, lazy-loads the panel on first click. No role gating.
- Panel: `frontend/src/components/ai-assistant-chat.tsx` — calls
  `apiRequest("POST", "/api/ai/chat", { message, context, conversationHistory })`.
- Context: `frontend/src/contexts/assistant-context.tsx` (user/role/screenData) +
  `frontend/src/contexts/screen-context.tsx` (current screen/visible data).
- Backend: `backend/src/server/routes/ai-routes.ts` → `backend/src/server/services/ai-assistant.ts`
  (OpenAI `gpt-4.1`). Dead duplicates `backend/src/server/ai-assistant.ts` /
  `backend/src/server/ai-analytics.ts` exist but are not imported — left untouched, out of scope.

### Audit hypotheses — all four confirmed

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| A | Chat trusts client-reported role/screenData | **Confirmed** | `ai-routes.ts` validates shape only (zod), no cross-check vs `req.user`; `services/ai-assistant.ts:33,46` interpolates `context.userRole` / `context.screenData` straight into the system prompt. |
| B | Identity defaults to a placeholder | **Confirmed** | `assistant-context.tsx:20-21`: `useState("Sales Executive")` / `useState("John Doe")`, never overwritten anywhere. App.tsx's real `/api/auth/me`-validated identity is never passed into `AssistantProvider`. |
| C | Latest user message sent twice | **Confirmed** | Frontend `ai-assistant-chat.tsx:64` already appends the new message into `conversationHistory`; backend `services/ai-assistant.ts:119-126` appends it again before calling OpenAI. |
| D | `apiRequest` doesn't throw on HTTP errors | **Confirmed** | `queryClient.ts:99-106`, comment: *"Do NOT call throwIfResNotOk here"* — returns the `Response` unconditionally. The chat component calls this directly, so a 4xx/5xx silently falls through instead of hitting its `catch`. |

**Decision:** Copilot V1 is a new, properly authorised surface (`/api/copilot/*`, new DB tables,
new panel content) reusing the existing **launcher** (FAB) and **assistant-context identity wiring**
(fixed to use real server-validated identity, since Copilot must never trust client-reported role).
The legacy `/api/ai/chat` keeps functioning exactly as today for whatever still calls it, but once
the button opens the new Copilot panel, nothing in the app calls it anymore; the route itself gets
one added guard so a direct call returns a documented deprecation response instead of running the
unauthorised flow (brief §4: *"old chat endpoint cannot bypass the new restrictions"*). OpenAI logic
is not touched.

### Auth / schema / migration conventions

- `authMiddleware` mounts at `routes.ts:264` (`app.use("/api", authMiddleware)` unless
  `MOCK_AUTH=true`). New Copilot routes register after line 311, alongside other feature routers,
  to inherit auth + IP allowlist + URL-permission checks automatically.
- `req.user` shape set by `auth.middleware.ts:120-126`: `{ userId, roleId, roles[], activeRoleId, ... }`.
  Role is `activeRoleId` first, falling back through `roleId`/`role`/`role_id`, normalized via
  `normalizeRole`. Copilot's identity/context resolver derives role from `req.user.activeRoleId`
  exclusively — never from the request body.
- `JWT_SECRET` has a dev fallback (`auth.service.ts:6`) but production boot is blocked by
  `assertSecretsOrExit` (`backend/src/server/config/validate-secrets.ts`, invoked from
  `server/index.ts:15`) if the secret is missing, weak, or the known dev string. Copilot adds its
  own analogous guard: refuse to activate (not refuse to boot) if `MOCK_AUTH=true` outside tests.
- DB: `backend/src/server/db.ts` exports `pool` + `db = drizzle(pool, { schema })`. Schema
  convention: single `drmSchema = pgSchema("drm")` namespace, `drmSchema.table("name", {...})`.
- **Migrations**: `drizzle-kit push` is noted repo-wide as broken (`routes.ts:461,467,473`); the
  de facto pattern other recent features use is boot-time idempotent `CREATE TABLE IF NOT EXISTS`
  (`ensureSchema()`), same approach already used for `backend/migrations/20260603_increment_management.sql`
  this week. Copilot follows the same convention: one additive SQL file +
  `ensureCopilotSchema()` executed once at startup, gated so it never touches an unspecified DB.

### Known pre-existing risks confirmed (out of scope — not touched by Copilot)

Per brief §4/§7 ("do not silently redesign business policy", "document as existing risks"):

- `backend/src/server/routes/middleware/financial-permission.ts` and
  `.../middleware/action-permission.middleware.ts` are pass-through stubs (always `next()`) —
  financial and "admin-only audited" route guards across account/office-account/CRM/reports routes
  currently enforce nothing.
- `backend/src/server/routes/services/audit-log.service.ts` and
  `.../routes/services/activity-service.ts` are no-op stub proxies — writes through ~10 route files
  are silently not audited. (Not to be confused with the *real*
  `backend/src/server/services/activity-service.ts`, which does write `activityLogs` — Copilot's
  own audit log uses the real one.)
- `account-routes.ts:211-234`, `enforceLoanPartialFinalApprovalGate` — the receipt-sum/remaining-
  balance check is disabled behind a `/* BYPASS FOR TESTING */` comment; partial/full GM payment
  entries are currently treated as fully paid unconditionally.
- Copilot's financial read tool (`get_approved_service_options`) only ever reads `drm.services`
  (`is_active` catalogue), never these approval paths, so it cannot inherit the bypass.

### Tool → real backing map (read tools)

| Tool | Backing | Scope check today |
|---|---|---|
| `get_my_work_summary` | No single endpoint. New query joins `projectAssignmentsRepository.findByUserId` (`pms-routes.ts` path) + `service_followups` (`service-core-routes.ts:166`) + `drm.follow_ups` by `assigned_to`. | New: filter by `req.user.userId` only. |
| `search_authorised_customers` | `CustomersRepository.findByUserId` / `.search` (`customers.repository.ts:155,383`). | Already scopes non-managers to `owner_user_id`/`created_by` — reused as-is. |
| `get_customer_summary` | `customersRepository.findById` + `getFollowUpDetails` + `getCustomerGmEntries` (`customers.repository.ts:139,415,858`). | **Gap found:** the live HTTP routes only check `req.user` truthiness, not ownership. Copilot's wrapper adds the same `owner_user_id`/manager check `findByUserId` already uses, rather than reusing the under-scoped HTTP path. |
| `get_workflow_status` | `workflow-status.service.ts` is a stub. New read-only query over `quotations` (`save_status,hod_status`), `gmEntryStatusEnum`, `projectStatusEnum`/`taskStatusEnum` (`schema.ts:26,29,1196`). | New: scoped to records the caller already owns/can view via the same checks as #2/#5. |
| `get_project_summary` | `ProjectsRepository.findByOwner` / `findAllWithStats` (`projects.repository.ts:104,186`, includes `taskStats`). | Owner/assignee scoped already. "Missing evidence" has no existing concept — reported as `unavailable`, not invented. |
| `get_approved_service_options` | `ServicesRepository.listActiveWithSubservices()` (`services.repository.ts:224`), `is_active=true` is the closest thing to "approved". | Read-only catalogue, no per-user scope needed. |
| `search_approved_guidance` | **No existing versioned/approved corpus.** `policies` table is flat config, `trainingModules` has no approval/version field. Tool returns `unavailable: no approved guidance corpus configured` rather than reading training/notice content and mislabeling it "approved". | N/A |
| `prepare_draft` | No `drafts` table exists anywhere (checked) — new Copilot-local table, no collision. | New table, owner-scoped by `conversation_id` → `user_id`. |
| Optional write: create follow-up | Reuse `POST /api/sales/followups` logic (`sales-routes.ts:3747-3980`): inserts into `drm.follow_ups` with `assigned_to = created_by = req.user.userId`, gated by `assertCanEditCustomer`. **Not** `followUpsRepository.create` (that path is manager-only via `/api/manager/followup`). | Extracted into a shared service function called by both the HTTP route and the Copilot action, so behavior/authorization stays identical. |

## M1 — Auth/context, scoped repositories, persistence (done)

- `backend/migrations/20261022_copilot_core.sql` + matching `shared/schema.ts` tables: conversations, messages, runs, tool_calls, drafts, audit_log, action_proposals, action_executions. Additive only, applied automatically at boot via `ensureCopilotSchema()`.
- `services/copilot/identity.ts` resolves identity from `req.user` only; `isCustomerInScope`/`resolveAllowedEmployeeIds` reuse the same owner/department rule the rest of the app already enforces.
- All 8 read tools implemented in `services/copilot/tools/`, each mapped to a real repository/table (see the tool → backing table in the M0 section above) with its own scope check.

## M2 — Provider adapter, tool dispatcher, response contract (done)

- `@anthropic-ai/sdk` added as a real dependency (not a dev/implicit one). `provider/anthropic-provider.ts` is the only adapter, behind `provider/provider.interface.ts`.
- `tool-registry.ts` is the single allowlist/dispatch point; unknown tools and malformed args are rejected before any handler runs.
- `copilot.service.ts` is the turn orchestrator: rate limit, active-turn limit, tool-round loop, cumulative token budget, persistence of every message/run/tool-call, and the typed `TurnResponse` contract (conversationId, runId, answer, evidence, drafts, warnings, mode, usage).
- `routes/copilot-routes.ts` exposes `/api/copilot/{capability,conversations,ask,drafts,activity,actions/followup/*}`, registered in `routes.ts` right after the (now-retired) `/api/ai` mount.

## M3 — Panel integration (done)

- Fixed the confirmed "John Doe" bug: `assistant-context.tsx` now requires real `userName`/`userRole` props, supplied by `App.tsx`'s own `/api/auth/me`-validated state.
- New `components/copilot/copilot-panel.tsx`: Ask/Drafts/Activity tabs, identity line, capability-gated empty states, evidence chips linking to real app routes, draft cards with DRAFT status + missing-fields, activity log with outcome badges.
- `ai-assistant-button.tsx` now lazy-loads `CopilotPanel` instead of the old chat component (same launcher, same lazy-mount behavior).
- `lib/copilot-api.ts`: every call explicitly checks `res.ok` and throws — the exact bug class hypothesis D found does not reproduce in the new client.
- Legacy `/api/ai/chat` now returns `410` with a `migrateTo` pointer instead of running its old client-trusting logic.

## M4 — Optional follow-up action (done, with one noted gap)

- `followup-action.ts`: propose → (hash+expiry+pending check) → atomic claim → real `insert into drm.follow_ups` (same shape as `POST /api/sales/followups`, reusing the same `assertCanEditCustomer` check) → unique execution record.
- Default `COPILOT_ALLOW_FOLLOWUP_CREATE=false`; routes return `403` when off regardless of auth.
- **Gap, not silently assumed solved**: `targetRecordVersion` (the "stale record" check from brief §7) is threaded through the schema/persistence layer but not yet populated or checked in `proposeFollowupAction`/`confirmFollowupAction` — see TEST_REPORT.md "Not covered". Treat this as incomplete, not merely untested.
- **Gap**: impersonation is not yet specially blocked for this write — see SECURITY.md.

## M5 — Tests, builds, docs (done)

- 33 new automated tests across 4 files, all passing against the real dev DB (no production data written — DB-touching tests mock the pool where they'd otherwise write). Full breakdown + honest coverage-vs-brief table in TEST_REPORT.md.
- Fixed a pre-existing gap (missing `vitest.config.ts` path alias) that had been silently preventing every DB-backed backend test — Copilot's and pre-existing ones alike — from running at all.
- `tsc --noEmit` and the real `vite build` / `esbuild` bundle both verified clean (0 new errors/failures) on frontend and backend.
- Docs: this file, IMPLEMENTATION.md, SECURITY.md, TEST_REPORT.md, ACTIVATION.md, `backend/copilot.env.example`.

## Final status by capability (brief §9 format)

| Capability | Status |
|---|---|
| Authenticated, scoped Copilot panel | implemented and tested |
| 8 read tools mapped to real data | implemented and tested |
| Persistent conversations/drafts/audit | implemented and tested |
| Source references on every answer | implemented and tested |
| Usage limits (rate/tokens/rounds/active-turns) | implemented, partially tested (see TEST_REPORT.md) |
| Optional confirmed follow-up write | implemented, tested, **one known gap** (stale-record check not wired) — do not enable `COPILOT_ALLOW_FOLLOWUP_CREATE` until that gap and the impersonation check are closed |
| Legacy chat retirement | implemented and tested |
| Activation/rollback docs | implemented |

**This release was not activated anywhere** — `COPILOT_ENABLED` defaults to
`false` and no real API key/allowlist has been configured in any environment
by this work. Writing these files does not mean the feature is live; see
ACTIVATION.md for what an operator still has to do.
