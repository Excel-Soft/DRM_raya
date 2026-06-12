---
name: Reception/Event report real-column boundaries
description: Which report fields/filters are intentionally absent because no source column/table exists — do not fabricate them.
---

# Reception & Event report — real-column boundaries

When extending the WebExcels DRM reports, several spec-listed fields/filters have
**no backing data** and are deliberately omitted rather than faked.

**Rule:** never invent a column to satisfy a spec field. Omit it and document why.

**Why:** the hard project rule is real-persisted-data-only (no synthetic/fallback
rows or values). Fabricating these would violate it and mislead users.

**How to apply (current schema):**
- `drm.meetings` (reception report source) has **no** `branch`, `visitorCount`, or
  `paymentAmount` columns. So:
  - Reception `branch` filter resolves branch from the **receptionist's**
    `drm.users.branch` via `LEFT JOIN drm.users ru ON ru.id = m.created_by`
    (case-insensitive substring match, like company/customer). It is NOT a meeting column.
  - `visitorCount` / `paymentAmount` row fields are not emitted at all.
- Event report (`drm.events`) has no `event_duties`/`event_menu` tables and no
  assigned-user/team columns, so `assignedUserName`, `team`, `dutyCount`,
  `speakerCount`, `createdByName`, `startTime`/`endTime` are omitted. Speakers ARE real.
- The event page reads `GET /api/events/report` (real events store), not the legacy
  meetings-based `GET /api/reports/event` (guarded but unused by the UI).
- Reception `month=YYYY-MM` is a convenience filter that expands to a `meeting_date`
  range; `receptionistId` is accepted as an alias for `userId` (same UUID validation
  + within-scope narrowing — never a scope bypass).
