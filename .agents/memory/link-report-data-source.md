---
name: Link Report data source & display IDs
description: Where the Team Report → Link Report gets real data, and how non-numeric IDs are shown.
---

# Link Report (Team Report submodule)

The Link Report does NOT have its own submission flow wired into workflows.

**Rule:** its rows are a normalized UNION of three sources, filtered by user + date range:
1. `drm.link_reports` (manual / future rows; has a serial `display_id`)
2. `drm.product_posting_evidence_links` → join `projects` → `customers`
3. `drm.software_evidence_links` → join `projects` → `customers`

**Why:** the imported app already stores user-submitted output links in the evidence
tables; the spec forbade touching workflow submission logic, so the report reads those
tables directly instead of adding a new write path. Company name = `customers.company_name`
(fallback `projects.name`, then `Unknown`).

**Display ID rule:** evidence rows are UUID-keyed with no numeric id. Show a STABLE
numeric derived from `md5(uuid)` (`('x'||substr(md5(id),1,6))::bit(24)::int`), never the raw
UUID. Manual `link_reports` rows use their `display_id`.

**Commission verification:** one row per `(user_id, start_date, end_date)` — enforced by a
unique index, upserted via `ON CONFLICT`. Submitted `linkReportIds` are de-duped and must all
belong to the filtered rows. `reward` defaults to 0 (matches the screenshot).

**How to apply:** if asked to add real submissions to the Link Report, prefer inserting into
`drm.link_reports` rather than altering product-posting / software workflow submission logic.
