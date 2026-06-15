---
name: Attendance edit-request binding IDOR
description: Why an attendance edit request must be bound to the real attendance row's employee, not client-supplied ids.
---

# Attendance edit-request binding / salary-lock bypass

**Rule:** An attendance "edit request" (create + approve) must NEVER trust a
client-supplied `userId`/`attendanceDate` alongside a separate `attendanceId`.
When an `attendanceId` is given, derive the employee/date from the real
`drm.attendance` row at create time, and at approve/apply time assert the located
row's `user_id` AND `date` match the request's `user_id`/`attendance_date` before
mutating it (compare in SQL with `date::date` to stay timezone-safe). Binding only
`user_id` is NOT enough — a same-employee, mismatched-date request still bypasses
the month lock.

**Why:** The salary-lock guard in the approve path checks `isMonthLocked(edit.user_id,
edit.attendance_date)`, but the mutation (`applyEditToAttendance`) located the row
by `attendance_id`. If those were unbound, a crafted pending request could display
an unlocked employee while `attendanceId` pointed at a DIFFERENT (possibly
salary-locked) employee's row — approving it mutated that other employee's locked
attendance, bypassing the lock and the per-employee authorization. This is the
exact gap an architect review caught in Patch 3 Stage 7.

**How to apply:** Any request->approve workflow that (a) runs a guard on stored
claim fields but (b) performs the write via a separately-supplied row id must bind
the two: resolve the canonical owner/date from the row id, and re-verify ownership
at write time. Also scope create: non-managerial callers may only request edits to
their own records. The admin-only direct-correction path was already safe because
it derives everything from the real row before the lock check.
