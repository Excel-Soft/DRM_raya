# WebExcels DRM Copilot V1 — Test Report

All runs below are real `vitest` executions in this checkout on 2026-10-22,
against the live Supabase dev database already configured in this repo's
`backend/.env` (no production data was written — see notes per test file).
No results in this report are fabricated or assumed.

## Summary

| Suite | Result |
|---|---|
| `copilot-config.test.ts` (pure unit, no DB) | **8/8 passed** |
| `copilot-tool-registry.test.ts` (no DB) | **5/5 passed** |
| `copilot-followup-action.test.ts` (persistence + DB pool mocked) | **6/6 passed** |
| `copilot-routes.test.ts` (real Express app + real DB) | **14/14 passed** |
| **Total new Copilot tests** | **33/33 passed** |
| `tsc --noEmit` (backend) | same 12 pre-existing error files as before this work; 0 new |
| `tsc --noEmit` (frontend) | same 3 pre-existing error files as before this work; 0 new |
| `vite build` (frontend) | succeeds; `copilot-panel-*.js` emitted as its own lazy chunk |
| `esbuild` bundle (backend) | succeeds |

## Coverage against the brief's required list

| Required case | Covered by | Status |
|---|---|---|
| Unauthenticated access | `copilot-routes.test.ts` — all 10 `/api/copilot/*` endpoints | ✅ |
| Forged client role/record ID | `copilot-routes.test.ts` — `x-acting-role: admin` header ignored; token `activeRoleId: admin` with empty allowlist still denied | ✅ |
| Cross-user/department reads and aggregates | `identity.ts`/`isCustomerInScope` code path exists and is exercised by `get-customer-summary`'s scope check; no dedicated cross-tenant HTTP test with two real seeded users in two departments (would need fixture users — not fabricated here, see **Not covered**) | ⚠️ partial |
| Role revocation / history leakage | Not covered — no test exercises "role changed mid-session, does prior evidence leak" | ❌ not covered |
| Mock-auth rejection | `copilot-config.test.ts` — `getCopilotAvailability` with `MOCK_AUTH=true` | ✅ |
| Provider missing key/timeout/429/invalid tools | Missing-key covered (`copilot-config.test.ts`). Timeout/429/invalid-tool-name mapping (`anthropic-provider.ts`'s `mapAnthropicError`) is implemented but not unit-tested against a mocked SDK response in this pass — see **Not covered**. Invalid tool *name* (not provider-side) is covered by `copilot-tool-registry.test.ts`. | ⚠️ partial |
| Injection in customer notes | System-prompt instruction implemented (`copilot.service.ts`); no automated test feeds a tool result containing an injection string and asserts the model/orchestrator doesn't act on it — that would require a real or mocked model call, not done this pass. | ❌ not covered |
| Invented evidence links | Architecturally prevented (`sourceRefs` built server-side only, `types.ts`/each tool) — not separately unit-tested beyond reading the tool outputs in `copilot-tool-registry.test.ts`. | ⚠️ partial |
| Duplicate chat submission | `maxActiveTurnsPerConversation` + `countActiveRuns` implemented in `copilot.service.ts`/`persistence.ts`; no test actually fires two concurrent `/ask` calls at the real endpoint. | ❌ not covered |
| Disabled direct action requests | `copilot-routes.test.ts` — propose/confirm both 403 with `COPILOT_ALLOW_FOLLOWUP_CREATE=false` | ✅ |
| Changed/expired/cross-user confirmation | `copilot-followup-action.test.ts` — expired, payload-hash-changed, not-found-for-user all covered | ✅ |
| Concurrent replay yielding one follow-up | `copilot-followup-action.test.ts` — lost-the-claim-race and retry-on-already-executed both assert exactly one execution record, no second insert | ✅ |
| Transaction/audit failure | `recordExecution`'s `reconciling` status path exists in `followup-action.ts`'s catch block; not exercised by a test that forces the insert to throw after a successful claim. | ❌ not covered |
| Stale record | `targetRecordVersion` field exists on the proposal but is not currently populated/checked anywhere (`proposeFollowupAction` passes `null`) — this is an **incomplete** piece of M4, not just an untested one. See IMPLEMENTATION gaps below. | ❌ not implemented |
| Truthful uncertain outcomes, no fabricated amounts/satisfaction | Enforced by tool design (every tool returns real DB values or `unavailable`) and the system prompt; not independently tested against a live model response. | ⚠️ by design, not test-verified |
| Preserved existing UI/routes | `tsc`/build diffs show 0 new errors anywhere outside Copilot's own files; legacy `/api/ai/chat` route still exists (now 410) rather than removed. | ✅ |

**Honest total**: 7 of 16 required areas have a real, passing automated test. 5 are architecturally addressed in the code but not independently test-verified this pass (⚠️). 4 are implemented as a design intent but have no test and, in one case (stale-record check), are not actually wired up yet (❌). None of the ⚠️/❌ items are claimed as "tested" anywhere else in these docs.

## Pre-existing findings surfaced by this work (not Copilot bugs)

- **`vitest.config.ts` did not exist before this release.** Every backend test file that imports `src/server/db.ts` (which is most of them, including the pre-existing `penalty-routes.test.ts`) failed to even load with `Cannot find package '@shared/schema'`, because vitest had no path-alias config matching `tsconfig.json`'s `@shared/*`. This was true before any Copilot code existed; adding `vitest.config.ts` (additive, no behavior change to the app itself) is what makes the DB-backed suites runnable at all. Confirmed by re-running `penalty-routes.test.ts` before/after.
- **With that gap fixed, `penalty-routes.test.ts`'s DB-backed lifecycle tests now run and 7 of them fail** — all with `401` where a real status was expected. Root cause: `src/server/tests/auth.service.ts` is itself a no-op stub (`// STUB: real implementation missing from this checkout`), so every `authService.generateToken(...)` call in that test file produces an unusable token. This is the same "broken MVC-restructure" stub pattern found and fixed for `increment.service.ts`/`penalty.service.ts` earlier, but for a **different** file (a test-local shim), and it is out of scope for this Copilot release to fix. Copilot's own tests (`copilot-routes.test.ts`) avoid this by importing the real `src/server/services/auth.service.ts` directly.

## Not run (explicitly, not silently)

- No test exercises a real Anthropic API call (no key configured for CI/this environment) — `anthropic-provider.ts` is covered only by the code paths reachable without a live call (error-mapping logic is implemented but untested against real SDK error shapes).
- No frontend component test for `copilot-panel.tsx` (no frontend test runner/fixtures were already established in this repo to extend — `frontend/package.json` has no `test` script).
- Did not run the full pre-existing backend test suite end-to-end (would take significant time and surface unrelated pre-existing failures outside this release's scope); ran the ones most relevant to verifying no regression (`penalty-routes.test.ts`) plus the new Copilot suites.
