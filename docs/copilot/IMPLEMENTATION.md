# WebExcels DRM Copilot V1 — Implementation

Status: **implemented and tested**, pending real credentials/allowlist to actually turn on in any environment (see ACTIVATION.md). Nothing in this release was claimed working without the live checks recorded in TEST_REPORT.md.

## What this is

An embedded, permission-scoped operational assistant panel. It reads real DRM
records through eight narrow, typed, scope-checked tools, answers questions
with cited evidence, saves drafts the user must act on manually, and can
optionally (default off) create one follow-up on the user's explicit
confirmation. It replaces the insecure legacy WebX-AI chat in the UI; it does
not run a second DRM or touch the business database schema beyond its own
additive tables.

## Files changed/added

### Backend
- `src/shared/schema.ts` — appended 8 Copilot tables (additive; see migration).
- `migrations/20261022_copilot_core.sql` — the additive migration.
- `src/server/services/copilot/`
  - `config.ts` — env-driven config, availability gate, allowlist check.
  - `identity.ts` — server-side identity/scope resolution (never trusts client input).
  - `ensure-schema.ts` — boot-time idempotent DDL (matches this repo's convention; drizzle-kit push is unreliable here).
  - `persistence.ts` — all conversation/message/run/tool-call/draft/audit/proposal/execution CRUD.
  - `types.ts` — shared tool contract types.
  - `tool-registry.ts` — the allowlist + dispatcher. This is the only place a tool name is resolved and called.
  - `tools/*.ts` — the 8 read tools, each independently scope-checked.
  - `provider/provider.interface.ts` — vendor-agnostic provider contract.
  - `provider/anthropic-provider.ts` — the only adapter, using `@anthropic-ai/sdk` directly (no Claude Code / shell spawn).
  - `copilot.service.ts` — the turn orchestrator (limits, tool-round loop, persistence, audit).
  - `followup-action.ts` — M4's propose/confirm/execute state machine.
- `src/server/routes/copilot-routes.ts` — `/api/copilot/*`, registered after `authMiddleware`.
- `src/server/routes/ai-routes.ts` — legacy `/api/ai/chat` now returns `410` with a migration pointer instead of running its old insecure logic.
- `src/server/routes.ts` — wires `ensureCopilotSchema()` + `registerCopilotRoutes(app)`.
- `backend/copilot.env.example` — the config template.
- `vitest.config.ts` — **new**; see TEST_REPORT.md — fixes a pre-existing path-alias gap that silently prevented every DB-backed backend test (not just Copilot's) from running at all.
- `src/server/tests/copilot-*.test.ts` — new tests (see TEST_REPORT.md).

### Frontend
- `src/contexts/assistant-context.tsx` — `AssistantProvider` now **requires** `userName`/`userRole` props instead of owning its own placeholder state (fixes the confirmed "John Doe" bug).
- `src/App.tsx` — passes its real, `/api/auth/me`-validated `userName`/`userRole` into `AssistantProvider`.
- `src/lib/copilot-api.ts` — typed client; every call explicitly checks `res.ok` and throws (the legacy chat's silent-failure bug does not reproduce here).
- `src/components/copilot/copilot-panel.tsx` — the new panel (Ask/Drafts/Activity).
- `src/components/ai-assistant-button.tsx` — now lazy-loads `CopilotPanel` instead of the old chat component.
- `src/components/examples/AIAssistantChat.tsx` — unrelated orphaned example file; updated only to keep compiling against the now-required `AssistantProvider` props.

## Architecture notes

- **Identity**: every Copilot route calls `resolveCopilotIdentity(req)`, which reads only `req.user` (set by the existing `authMiddleware` from a verified JWT) plus one DB lookup for department/branch. Nothing reads `req.body`, `x-acting-role`, or any client-supplied role/screenData for authority.
- **Tools**: the model only ever sees `tool-registry.ts`'s 8 JSON Schemas. No raw SQL, no generic HTTP fetch, no shell, no arbitrary code execution tool exists. Unknown tool names and malformed arguments are rejected before any handler runs (see `copilot-tool-registry.test.ts`).
- **Provider**: `copilot.service.ts` depends only on `ProviderAdapter` (`provider.interface.ts`); `AnthropicProvider` is the sole concrete implementation, instantiated with an explicit API key (never the SDK's implicit env var). A future Python agent service could implement the same interface without touching `tool-registry.ts`, `identity.ts`, or any route.
- **Limits**: tool rounds, output tokens, cumulative per-turn token budget, request timeout, requests/minute, and active-turns/conversation are all enforced in `copilot.service.ts`/`persistence.ts` using the configurable defaults from `copilot.env.example` — not hard-coded.
- **The one write (M4)**: `followup-action.ts` reuses the real `assertCanEditCustomer` ownership check (`src/server/utils/ownership.ts`) — the same function `POST /api/sales/followups` uses — and performs the same `insert into drm.follow_ups` shape. It does not call that HTTP route with an admin credential, and it does not invent a new table. Confirmation is bound to a payload hash + an atomic `UPDATE ... WHERE status='pending'` claim + a `UNIQUE(action_key)` execution row, so retries/concurrent confirms cannot create two follow-ups (see `copilot-followup-action.test.ts`).

## Deliberately NOT done in V1 (per brief)

- No Python service, MCP server, vector DB, public chatbot, voice integration, or multi-agent fleet.
- No payment posting, GM approval, refunds, payroll changes, QA sign-off, project closure, permission changes, bulk operations, or external messages.
- `search_approved_guidance` always reports `unavailable` — this checkout has no versioned/approved SOP corpus to search, and nothing here invents one.
- Known pre-existing bypasses (financial-permission.ts, action-permission.middleware.ts, the loan receipt-check bypass in `account-routes.ts`) are left exactly as found — documented in SECURITY.md, not redesigned, not reachable from any Copilot tool.
