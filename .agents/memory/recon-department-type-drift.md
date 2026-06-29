---
name: projects.department_type live-DB drift
description: drm.projects.department_type is in schema.ts but missing from the live Replit DB; raw SQL selecting it fails at runtime.
---

# `drm.projects.department_type` is missing from the live DB

`shared/schema.ts` defines `projects.departmentType` (`department_type`), but the
Replit-provided Postgres DB does **not** have that column. Because `db:push` is
broken repo-wide, schema.ts columns are not guaranteed to exist live.

**Symptom:** any raw-SQL query that does `select ... p.department_type from
drm.projects p` throws `column p.department_type does not exist`. In the workflow
reconciliation report (`GET /api/workflow/reconciliation`) this makes several
loose-mapping checks land in `checkErrors` (they don't 500 — each check has its
own try/catch).

**Why:** environment schema drift, not a code regression. The pre-existing checks
(`invoice_root_project_without_invoice`, `project_onhold_with_satisfied_dependency`,
`verification_pending_product_posting`, `verification_pending_software`) reference
`p.department_type` and fail in this DB.

**How to apply:** when writing raw SQL against `drm.projects`, do not assume
`department_type` (or other schema.ts-only columns) exist. Keep queries
column-minimal (id/name/status are safe) or add the column at runtime via
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` before relying on it.
