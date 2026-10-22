# WebExcels DRM Copilot V1 — Activation & Rollback

## Current state right now

`COPILOT_ENABLED` is unset (defaults to `false`). Nothing changes for any user
until an operator deliberately sets real values below. The legacy
`/api/ai/chat` endpoint is already retired (`410`) regardless of this flag —
that part shipped with the code, not with activation.

## Before turning this on anywhere

1. **Get an Anthropic API key** with access to a real model id. Decide the
   model id explicitly — there is no default/assumed "latest" model baked in.
2. **Pick the pilot users.** Copy their real `drm.users.id` UUIDs (not emails,
   not role names).
3. **Confirm `JWT_SECRET` is strong** in that environment (32+ chars, not the
   known dev default) — Copilot will refuse to activate otherwise, but it's
   worth confirming ahead of time rather than discovering it at rollout.
4. **Decide on the follow-up write.** Leave `COPILOT_ALLOW_FOLLOWUP_CREATE=false`
   for the first pilot. See the impersonation gap noted in SECURITY.md before
   ever setting this to `true`.
5. **Review the migration.** `backend/migrations/20261022_copilot_core.sql` is
   additive-only (`CREATE TABLE IF NOT EXISTS`) and does not touch any
   existing table — safe to apply to the real database. It runs automatically
   at server boot via `ensureCopilotSchema()` (same pattern this repo already
   uses for other recent features); there is nothing extra to run by hand.

## Turning it on

Copy the relevant lines from `backend/copilot.env.example` into the real
`backend/.env` for that environment (never commit real values) and set:

```
COPILOT_ENABLED=true
COPILOT_MODEL=<the exact model id you chose>
DRM_COPILOT_ANTHROPIC_API_KEY=<the real key>
COPILOT_ALLOWED_USER_IDS=<comma-separated real user ids>
```

Restart the backend. Confirm with the pilot user's own session:

```
GET /api/copilot/capability
```

should return `"configured": true, "allowedForUser": true`. If either is
`false`, the `reasons`/absence of allowlisting tells you exactly what's still
missing — nothing silently half-activates.

## Expanding the pilot

Add more user ids to `COPILOT_ALLOWED_USER_IDS` and restart. There is no
"enable for a role" shortcut by design (brief: never infer access from a
role label) — every pilot user is added by their real id.

## Rollback

1. Set `COPILOT_ENABLED=false` (or remove the env var) and restart. Every
   `/api/copilot/*` route immediately returns `503 CopilotUnavailable` again;
   the panel shows its "Copilot isn't available right now" state. No code
   revert is required for this step.
2. If you want to fully remove the code for this release: revert the commits
   touching `src/server/services/copilot/`, `src/server/routes/copilot-routes.ts`,
   the `ai-routes.ts`/`routes.ts` changes, the frontend `copilot/` + the
   `assistant-context.tsx`/`App.tsx`/`ai-assistant-button.tsx` changes, and
   `vitest.config.ts`. **Do not drop the `copilot_*` tables** as part of this —
   they hold conversation/draft/audit history that may be needed for review;
   the migration is additive, so leaving the tables in place after a code
   revert is harmless (nothing will write to them once the code is gone).
3. If re-activating the OLD WebX-AI chat is ever wanted instead: `ai-routes.ts`
   would need its real logic restored (it currently just returns `410`) — this
   is not a one-flag toggle, since that handler's insecure trust model is
   exactly what this release retired. Treat that as a deliberate, separate
   decision, not a quick rollback step.

## What activation does NOT do

- Does not touch any existing route, table, or page outside the Copilot
  panel + the retired `/api/ai/chat`.
- Does not create any business record on its own — even with
  `COPILOT_ENABLED=true`, nothing writes anywhere until a pilot user both
  asks Copilot to prepare a follow-up **and** explicitly confirms it, and
  only if `COPILOT_ALLOW_FOLLOWUP_CREATE=true` as well.
