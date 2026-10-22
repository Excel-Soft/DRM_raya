# WebExcels DRM Copilot V1 — Security

## Identity & access

- Every `/api/copilot/*` route sits behind the existing global `authMiddleware` (JWT-verified) **and** independently checks `req.user`, Copilot's own runtime availability, and the per-user allowlist (`requireCopilotAccess` in `copilot-routes.ts`) before doing anything else.
- Identity is resolved exclusively from `req.user.activeRoleId`/`userId` (`identity.ts`). Client-supplied role, department, `x-acting-role`, or screen data are never read for authority — verified in `copilot-routes.test.ts` ("a forged x-acting-role header does not change what the capability endpoint reports").
- The allowlist (`COPILOT_ALLOWED_USER_IDS`) is a set of real `drm.users` UUIDs, checked by id, never by role label — `isUserAllowed` tests confirm a token claiming `"admin"` gets no special treatment.
- Empty allowlist = nobody can use Copilot (deny-all default), independent of `COPILOT_ENABLED`.
- Copilot refuses to be considered "configured" (and so will not activate) if `MOCK_AUTH=true` outside `NODE_ENV=test`, or if `JWT_SECRET` is the known dev default or under 32 characters — `getCopilotAvailability` + its tests.
- Impersonation sessions: `identity.ts` surfaces `impersonatorId` from the token but Copilot does not special-case it to grant extra authority; no tool or the follow-up action distinguishes an impersonated session from a normal one, and since M1 ships with writes off by default (`COPILOT_ALLOW_FOLLOWUP_CREATE=false`), there is no operational-write path to disable specifically for impersonation yet. **Before turning `COPILOT_ALLOW_FOLLOWUP_CREATE=true` on, add an explicit `identity.impersonatorId` check in `followup-action.ts` to block writes during impersonation** — this is a known gap to close before that flag ever flips to true, not something this release silently assumed was safe.

## Scope enforcement

- `search_authorised_customers` reuses `CustomersRepository.findByUserId`'s existing scoping (owner/created_by for non-managers, department for managerial roles, unrestricted for full-access).
- `get_customer_summary` does **not** reuse the live HTTP detail routes (`GET /api/sales/customers/:id` and friends) because M0 found they only check `req.user` truthiness, not ownership. It applies its own `isCustomerInScope` check mirroring `findByUserId`'s rule instead.
- `get_workflow_status` / `get_project_summary` apply the equivalent owner/full-access check per record type (quotation `created_by`, GM `salesPersonId`, project `ownerUserId`).
- `prepare_draft` and the follow-up action are always scoped to the calling user's own `userId` — there is no "create a draft/follow-up for someone else" parameter.
- Conversations, messages, drafts, and audit entries are all queried `WHERE user_id = <resolved identity>` — there is no list-all endpoint.

## Untrusted content

- The system prompt explicitly instructs the model to treat all tool results as untrusted data, not instructions, and never to let embedded text change tools/policy/recipients/authority (`copilot.service.ts`'s `SYSTEM_PROMPT`).
- Evidence links (`sourceRefs`) are built server-side inside each tool handler from the record it actually fetched — the model never supplies a route or id that reaches the UI directly; `copilot.service.ts` only forwards what a tool returned.
- `prepare_draft`'s saved `sourceRefs` are likewise built from the caller-supplied `relatedCustomerId`/`relatedProjectId`, not from free text the model wrote.

## Tool surface

- `tool-registry.ts` is the **only** place a tool name is resolved. Unknown names are denied before any handler executes; zod validates every argument before a handler body runs, so a malformed call never reaches a repository or SQL call (`copilot-tool-registry.test.ts`).
- No tool accepts raw SQL, a generic URL, a shell command, or arbitrary code. The widest surface is `search_authorised_customers`' free-text `query`, which is passed into the existing repository's parameterized search — the same path the live HTTP route already uses.

## Known pre-existing risks (NOT touched by this release)

Found during M0 and deliberately left as-is, per the brief ("document as existing risks rather than silently redesigning business policy"):

- `src/server/routes/middleware/financial-permission.ts` and `.../middleware/action-permission.middleware.ts` are pass-through stubs — financial/"admin-only audited" route guards across account/office-account/CRM/reports routes currently enforce nothing.
- `src/server/routes/services/audit-log.service.ts` and `.../routes/services/activity-service.ts` are no-op stubs — roughly 23 unrelated route files' audit logging is currently a silent no-op. Copilot's **own** audit log (`copilot_audit_log`) uses the real `src/server/services/activity-service.ts`-style direct-DB-write pattern, not either stub, and is unaffected by this gap.
- `account-routes.ts`'s `enforceLoanPartialFinalApprovalGate` has its receipt-sum check disabled behind a `/* BYPASS FOR TESTING */` comment — partial/full GM payment entries are currently treated as fully paid unconditionally. No Copilot tool reads or writes this path.
- None of the above are reachable from any Copilot tool or the follow-up action; they're recorded here so they aren't rediscovered as a surprise later.

## What a compromised/malicious tool result cannot do

- Cannot call another tool (the model can only request a tool call; `tool-registry.ts` dispatches, the tool result never re-enters as a new request on its own).
- Cannot change the active user's identity, scope, or the allowlist.
- Cannot issue a real business write — the only write path (`prepare_draft`) only ever inserts into Copilot's own `copilot_drafts` table, and the follow-up action requires a separate, explicit, hash-bound user confirmation after the model proposes it.

## Rate/resource limits enforced (configurable, see copilot.env.example)

`maxToolRounds`, `maxOutputTokens`, `maxTotalTokensPerTurn` (cumulative, not just a round count), `requestTimeoutMs`, `rateLimitPerMinute` (per user, rolling 60s), `maxActiveTurnsPerConversation` (default 1 — a second concurrent `/ask` on the same conversation is rejected with `409 turn_in_progress`), `maxToolResultCharacters`, `maxMessageCharacters`.
