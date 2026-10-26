import { pool } from "../db";

const FALLBACK_NOTE =
  "Routing uses the fixed rule (per-project DND / Product Posting determination).";

type OverrideRow = {
  id: string;
  previous_ratio: string;
  new_ratio: string;
  reason: string;
  effective_from: Date;
  effective_to: Date;
  is_enabled: boolean;
  disabled_at: Date | null;
  approved_by_user_id: string;
  approved_by_name: string | null;
};

function computeLiveStatus(row: {
  is_enabled: boolean;
  effective_from: Date;
  effective_to: Date;
  disabled_at: Date | null;
}): string {
  if (!row.is_enabled || row.disabled_at) return "disabled";
  const now = Date.now();
  const from = new Date(row.effective_from).getTime();
  const to = new Date(row.effective_to).getTime();
  if (now < from) return "scheduled";
  if (now > to) return "expired";
  return "active";
}

function mapRow(row: OverrideRow) {
  const liveStatus = computeLiveStatus(row);
  return {
    id: row.id,
    previousRatio: row.previous_ratio,
    newRatio: row.new_ratio,
    reason: row.reason,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    approvedByName: row.approved_by_name,
    liveStatus,
  };
}

function mapActive(row: OverrideRow) {
  return {
    id: row.id,
    previousRatio: row.previous_ratio,
    newRatio: row.new_ratio,
    reason: row.reason,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    approvedByName: row.approved_by_name,
  };
}

async function listWithApprover(): Promise<OverrideRow[]> {
  const result = await pool.query<OverrideRow>(
    `SELECT o.id, o.previous_ratio, o.new_ratio, o.reason,
            o.effective_from, o.effective_to, o.is_enabled, o.disabled_at,
            o.approved_by_user_id,
            COALESCE(u.full_name, u.name, u.email) AS approved_by_name
     FROM drm.assignment_ratio_overrides o
     LEFT JOIN drm.users u ON u.id = o.approved_by_user_id
     ORDER BY o.created_at DESC`,
  );
  return result.rows;
}

export async function getAssignmentOverrideState() {
  const rows = await listWithApprover();
  const now = Date.now();
  const active = rows.find((row) => {
    if (!row.is_enabled || row.disabled_at) return false;
    const from = new Date(row.effective_from).getTime();
    const to = new Date(row.effective_to).getTime();
    return now >= from && now <= to;
  });
  return {
    active: active ? mapActive(active) : null,
    fallbackNote: FALLBACK_NOTE,
  };
}

export async function getAssignmentOverrideHistory() {
  const rows = await listWithApprover();
  return rows.map(mapRow);
}

function oppositeRatio(newRatio: string): string {
  return newRatio === "DND" ? "PRODUCT_POSTING" : "DND";
}

export async function createAssignmentOverride(input: {
  newRatio: string;
  reason: string;
  effectiveFrom: string;
  effectiveTo: string;
  userId: string;
}) {
  const { newRatio, reason, effectiveFrom, effectiveTo, userId } = input;
  if (!newRatio || !reason?.trim() || !effectiveFrom || !effectiveTo) {
    throw Object.assign(new Error("Missing required fields"), { status: 400 });
  }
  const from = new Date(effectiveFrom);
  const to = new Date(effectiveTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw Object.assign(new Error("Invalid effective window"), { status: 400 });
  }

  await pool.query(
    `UPDATE drm.assignment_ratio_overrides
     SET is_enabled = false, disabled_at = NOW(), disabled_by_user_id = $1,
         disabled_reason = 'Superseded by new override', updated_at = NOW()
     WHERE is_enabled = true AND disabled_at IS NULL`,
    [userId],
  );

  const previousRatio = oppositeRatio(newRatio);
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO drm.assignment_ratio_overrides
       (previous_ratio, new_ratio, reason, approved_by_user_id, effective_from, effective_to,
        is_enabled, created_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, $4, NOW(), NOW())
     RETURNING id`,
    [previousRatio, newRatio, reason.trim(), userId, from, to],
  );
  return { id: inserted.rows[0]?.id };
}

export async function disableAssignmentOverride(id: string, userId: string, reason?: string) {
  const updated = await pool.query(
    `UPDATE drm.assignment_ratio_overrides
     SET is_enabled = false, disabled_at = NOW(), disabled_by_user_id = $2,
         disabled_reason = COALESCE(NULLIF($3, ''), 'Disabled manually'), updated_at = NOW()
     WHERE id = $1 AND is_enabled = true AND disabled_at IS NULL
     RETURNING id`,
    [id, userId, reason ?? ""],
  );
  if (updated.rowCount === 0) {
    throw Object.assign(new Error("Override not found or already disabled"), { status: 404 });
  }
  return { id };
}
