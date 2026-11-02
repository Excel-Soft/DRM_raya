import { pool } from "../../db";

// "Reached Paid Alibaba" is not a stored status on gm_entries — it's the
// derived fact that real money has already been sent to Alibaba for this GM,
// which happens the instant a row lands in drm.ab_payments (POST
// /api/account/dollar-system/allocate-payment). rejected/cancelled/voided
// rows don't count — money was never actually sent for those.
export async function hasReachedPaidAlibaba(gmEntryId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `select exists (
       select 1 from drm.ab_payments
        where gm_entry_id = $1
          and coalesce(is_deleted, false) = false
          and status not in ('rejected', 'cancelled', 'voided')
     ) as "exists"`,
    [gmEntryId],
  );
  return Boolean(rows[0]?.exists);
}

// Shared guard for every GM workflow endpoint (approvals, Pay Alibaba, invoice
// generation) that must refuse to act further once a GM has been refunded.
// Returns a user-facing error string when blocked, or null when it's fine to
// proceed.
export async function checkGmNotRefunded(gmEntryId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `select is_refunded as "isRefunded" from drm.gm_entries where id = $1`,
    [gmEntryId],
  );
  if (!rows.length) return "GM entry not found.";
  if (rows[0].isRefunded) return "This GM has already been refunded — no further action can be taken on it.";
  return null;
}
