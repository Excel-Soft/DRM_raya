---
name: Patch audit evidence honesty
description: Evidence-labeling and status rules for the recurring PATCH* baseline/closure audit docs in this repo.
---

The repo accumulates `PATCH<N>_*.md` baseline/traceability/closure docs. Each new
patch consolidates prior open items. When producing these audits, the architect
consistently enforces these honesty rules — apply them up front to avoid rework:

- **Never mark a requirement "Complete" from code inspection alone.** Code-complete
  but unverified-in-browser → **In Progress**. Some-criteria-met → **Partial**.
  Business-rule items awaiting a recorded management decision → **Needs Management
  Confirmation (NMC)**, regardless of code readiness.
- **Distinguish reused executed evidence from fresh.** Probes executed in a *prior*
  session on the *same unchanged code* must be labeled distinctly (e.g. `P6-LIVE`),
  not as fresh `LIVE`. Reserve `LIVE` for probes actually run this session.
- **API-level cross-role/anon matrices are necessary but NOT sufficient** for
  "Complete" on flows with a user-facing path — browser UAT is still required and
  must be tracked as its own open item (e.g. UAT-004).
- **NMC "Affects" lists must tag each ID with its real matrix status** so the doc
  doesn't imply every affected ID is itself NMC-blocked; mark gated IDs `(NMC)` and
  others `influences <ID> (<status>)`.
- **Don't invent synthetic/aggregate matrix rows** (e.g. "FOO-001..002 / BAR-*") —
  they break ID parsing and imply non-existent evidence.

**Why:** repeated architect `evaluate_task` reviews on these docs fail closeout for
over-claimed Complete/LIVE/UAT and inconsistent NMC roll-ups; pre-applying the rules
makes the first draft pass.
**How to apply:** when writing/reviewing any `PATCH*` audit set, self-check every
"Complete"/"LIVE"/"UAT"/NMC claim against executed evidence before finalizing.
