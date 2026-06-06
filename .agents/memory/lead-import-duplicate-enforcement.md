---
name: Lead import duplicate enforcement (fail-closed)
description: How the lead-import flow guarantees "no silent duplicates" and where duplicate verification must fail closed.
---

# Lead import duplicate enforcement

The shared duplicate module is the single source of truth for lead/customer
duplicate detection. It normalizes email/phone/company and matches existing
`drm.customers` rows.

## Rule
Duplicate verification must **fail closed**. If the lookup itself errors, the
module throws — it must never return an empty/"no duplicate" result on failure.

**Why:** an earlier version caught DB errors and returned `[]`, so a broken
lookup looked identical to "this lead is unique" and could insert silent
duplicates — directly against the stage constraint "no silent duplicates". (The
original trigger was a query referencing a non-existent `company` column; the
real table column is `company_name`.)

**How to apply:**
- Import *commit*: wrap each row's duplicate check; on throw, record the row as
  an error and `continue` — never insert an unverified row.
- Import *preview*: on throw, flag the row as unverified (treated as duplicate /
  not auto-committable), never as valid/unique.
- Override path: skipping a real duplicate requires BOTH a permitted role
  (admin / super_admin / sales_manager) AND a non-empty reason; overridden
  inserts are counted and audited.

## Commit API contract
`POST /api/leads/import/commit` returns `{ success: true, ... }` on success. The
import dialog gates on `json.success`, so the response MUST include it or the UI
reports successful imports as failures.
