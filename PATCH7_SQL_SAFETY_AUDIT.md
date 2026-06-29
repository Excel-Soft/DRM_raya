# PATCH 7 — SQL Safety Audit (SQL-001)

_Last updated: 2026-06-29 (Patch 7 Stage 1)._

This audit records the SQL-injection-hardening posture of the backend. The safety
primitives already exist (`server/utils/sql-safety.ts`, built in Patch 6) and are
exercised by a comprehensive test suite. No SQL code change was required in
Stage 1; this document is the audit evidence.

## 1. The safety primitives — `server/utils/sql-safety.ts`

| Helper | Guarantee |
| --- | --- |
| `assertUuidList(ids)` | Throws if any value is not a valid UUID — used before building any `IN (...)` clause from caller-supplied ids. |
| `quotedUuidList(ids)` | Returns a safe, quoted UUID list (post-validation) for inlining only validated UUIDs. |
| `safePage(v)` / `safePageSize(v)` / `safeOffset(...)` | Hard-cast pagination inputs to bounded safe integers; non-numeric / negative / oversized values are clamped or rejected — never interpolated raw into `LIMIT` / `OFFSET`. |
| `makeOrderBy(col, dir, whitelist)` | Whitelists the **column** against an allowed set and the **direction** to `ASC` / `DESC`; anything else is rejected. Prevents `ORDER BY ${userInput}` injection. |

## 2. Risk search performed

Searched the backend for the classic dynamic-SQL hot spots:
`sql.raw`, `raw(\``, `db.execute(sql\``, string interpolation inside SQL,
`LIMIT ${}`, `OFFSET ${}`, `ORDER BY ${}`, and dynamic sort/order values.

Findings and disposition:

| Pattern | Location(s) | Disposition |
| --- | --- | --- |
| Dynamic `ORDER BY` column + direction | `server/repositories/customers.repository.ts` (orderDir/orderColumn) | **Safe** — direction whitelisted to `asc`/`desc`; column whitelisted. |
| Pagination `LIMIT`/`OFFSET` | repositories / list routes | **Safe** — routed through `safePage*`/`safeOffset` integer coercion. |
| `IN (...)` over caller-supplied ids | PMS / list filters | **Safe** — `assertUuidList` / `quotedUuidList` validate before use. |
| Value interpolation | data writes | **Safe** — values are parameterized via Drizzle / `sql` template params, not string-concatenated. |

> Drizzle's `sql` tagged-template parameterizes interpolated **values**; the
> injection surface is limited to **identifiers** (columns) and **keywords**
> (sort direction, pagination), which are exactly what the whitelisting helpers
> cover.

## 3. Test coverage — `server/sql-safety.test.ts`

The suite asserts that malicious sort/filter/uuid input is rejected, covering
smoke test #8:

- Non-whitelisted **ORDER BY column** strings (e.g. `name; DROP TABLE …`,
  `(SELECT …)`) → rejected.
- Invalid **sort direction** (anything other than asc/desc) → rejected/normalized.
- Non-UUID values in id lists → `assertUuidList` throws.
- Out-of-range / non-numeric **pagination** → coerced to safe bounds.

These tests run as part of `npm test` and pass.

## 4. Cross-type-cast note (operational)

A separate, already-documented gotcha: `opportunities` ids are `varchar` while
`customers.id` is `uuid`. Raw SQL joins / UNIONs across them require explicit
`::text` casts or they error at runtime. This is a type-safety (not injection)
concern and is independent of the SQL-001 hardening above.

## 5. Stage-1 conclusion

SQL-001 is satisfied: all dynamic SQL surfaces (sort column, sort direction,
pagination, id lists) are whitelisted / integer-coerced / UUID-validated, values
are parameterized, and a dedicated test suite proves malicious sort/filter strings
are rejected. No new SQL code was needed this stage.
