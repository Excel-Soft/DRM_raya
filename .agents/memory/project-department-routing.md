---
name: Project department routing
description: How a project's structured department is stored and resolved for workflow routing
---

# Project department routing

`projects.department_type` (text: DND | PRODUCT_POSTING | SOFTWARE) is the
structured routing department. It is set **once at workflow creation** and read
thereafter — never re-guessed from names on the hot path.

- Set in `getOrCreateProductPostingWorkflow` / `getOrCreateSoftwareWorkflow`
  (best-effort UPDATE only when null) and on assign-task sub-projects.
- Historical rows backfilled in `ensureProjectsSchema()`
  (`server/repositories/projects.repository.ts`) via runtime ALTER + UPDATEs
  (db:push is broken repo-wide).

**resolveWorkflowRouting** resolution order (workflow-transition.service.ts):
1. explicit `departmentType` wins (structured).
2. else `workflowType === "software"` ⇒ SOFTWARE — *structural*, not a guess
   (software lives in its own table; DND is a product-posting subtype only).
3. else free-text name hints split DND vs PRODUCT_POSTING; only this path sets
   `derivedFromText: true`.

**Why:** name-based guessing mis-routed notifications/dashboards. Guess once,
persist, read the column.

**Gotcha:** the inline executive-dashboard-URL guessing in the two assign-task
routes was intentionally NOT switched to the stored column (its URLs differ from
resolveWorkflowRouting's, e.g. `/dd-executive-dashboard` vs `/dd/executive`) —
changing it would alter dashboard URLs. Left as a follow-up.
