# CRM Duplicate Detection & Merge Policy

## Detection
Customers are clustered as potential duplicates when they share a **normalized**:
- email (lower-cased, trimmed), or
- phone (digits only), or
- company name (lower-cased, punctuation/space-collapsed).

Soft-deleted customers are excluded from clusters.

## Authorization
Merge and skip are restricted to the duplicate-override roles defined in
`server/utils/duplicate-policy.ts`:
`admin`, `super_admin`, `sales_manager`.
Other roles receive `403`.

## Merge behaviour (`POST /api/crm/duplicates/:id/merge`)
Runs inside a single transaction:
1. A **survivor** (winner) and one or more **losers** are chosen by the caller.
2. Winning field values are applied to the survivor.
3. Every linked child row in `drm.*` that references a customer
   (`customer_id` / `promoted_to_customer_id`: GM, BV, invoices, follow-ups,
   lead activities, services, etc.) is repointed to the survivor.
4. Each loser is **soft-deleted** (`is_deleted = true`) — never hard-deleted, to
   respect the no-destructive-DB constraint.
5. The merge is recorded via the audit log.

If the duplicate lookup itself fails, the operation **fails closed** (throws) —
it never silently returns an empty result that could hide a real duplicate.

## Skip behaviour (`POST /api/crm/duplicates/:id/skip`)
Records a dismissal in `drm.duplicate_decisions` (created via ensure-schema) so the
cluster can be suppressed from future review. Audited.

## Idempotency & safety
- Already soft-deleted losers are ignored.
- Re-pointing is keyed by id, so re-running a merge is safe.
- No row is physically deleted.
