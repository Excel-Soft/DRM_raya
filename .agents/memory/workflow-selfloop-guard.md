---
name: Workflow self-loop guard order
description: Self-loop (from===to) transitions must still run role/ownership/content guards — only the legal-state check may be skipped.
---

In the centralized workflow transition validator, a same-phase transition
(`from === to`) is a legal *state* no-op but must NOT short-circuit the rest of
validation.

**Rule:** resolve the action first (unknown ⇒ 400), then for a self-loop skip
ONLY the legal-state edge check; role, ownership, and content guards still run.
Never add a global `if (from === to) return;` at the top of the validator.

**Why:** several real actions are registered as self-loops on `RUNNING_PROJECT`
(`EXECUTIVE_SUBMITTED`, `EXTENSION_REQUESTED`, some `TIMER_STARTED`). A top-level
self-loop early-return let a wrong-owner `EXECUTIVE_SUBMITTED` on an already
-running task bypass the ownership check entirely — a broken-access-control bug
caught in code review.

**How to apply:** when touching `validateTransition`, keep guard order =
action → legal-state(skipped on self-loop) → role → ownership → content. Tests in
`server/workflow-transition.service.test.ts` pin this; keep them green.
