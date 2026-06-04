---
name: Service Department data model & conventions
description: How the WebExcels DRM Service Department pages/APIs are wired (Stage 5).
---

# Service Department (Stage 5)

- List APIs return `{ data, total, page, pageSize }`. Frontend service pages keep a
  fixed UI shell (header, Copy/Excel/PDF, Column visibility, Search, table,
  pagination footer) — preserve it; only swap mock arrays for `useQuery` +
  `apiRequestJson` and render real-or-empty (the "No data available in table" row).
- Scoping pattern (reads): managerial roles → `getDepartmentFilterUserIds(req)`;
  executives → `[req.user.userId]`. A `null` from the department helper means
  "no filter" (admins see all) — repos treat `null` as unscoped.
- Customer `grade` is free text (A/A+/A-/B/B+/B-...). Canonical keys used by the
  reports API are `A`, `B_PLUS`, `B`, `B_MINUS` (see `server/utils/service-grade.ts`).
- Complaint status is the Postgres enum `drm.service_complaint_status`
  (open/in_progress/resolved/closed); writes must cast (`'resolved'::drm.service_complaint_status`).
  Resolve requires a non-empty remark.

## Schema-change approach (imported schema — avoid drift)
- **Why:** this is an imported app; `drizzle-kit push` risks dropping/altering
  columns. Add tables/columns with raw `CREATE TABLE / ALTER TABLE ... IF NOT
  EXISTS` (mirrors `service-pool.repository.ensureTable`).
- **How to apply:** put DDL in a repo `ensure*()` method and **await** it during
  route registration before serving (un-awaited ensure calls race first requests).

## Limitations baked into Stage 5
- No file-upload storage: BV/VAS document attachments are name + http(s) URL only.
- `services` table has no price; due-VAS-payment amounts derive from latest
  `service_renewals.amount` and may be null.
- WhatsApp follow-up is a saved draft only (pool `message-draft`), never sent.
