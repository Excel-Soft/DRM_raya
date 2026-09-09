import type { Request } from "express";
import { pool } from "../db";
import { getRequestUserId } from "./ownership";

/**
 * Stage 8 — assignment history.
 *
 * Records every assignment / reassignment of a lead or customer (who assigned,
 * from whom, to whom, why, when) into a dedicated drm.assignment_history table.
 * Created lazily via ensure-schema because db:push is broken in this repo.
 * Best-effort: a logging failure must never break the assignment itself.
 */

let ensured = false;

export async function ensureAssignmentHistoryTable(): Promise<void> {
  if (ensured) return;
  await pool.query(`
    create table if not exists drm.assignment_history (
      id uuid primary key default gen_random_uuid(),
      entity_type text not null,
      entity_id text not null,
      from_user_id text,
      to_user_id text,
      reason text,
      actor_user_id text,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(
    `create index if not exists idx_assignment_history_entity
       on drm.assignment_history (entity_type, entity_id)`,
  );
  ensured = true;
}

export async function recordAssignment(input: {
  entityType: string;
  entityId: string;
  fromUserId?: string | null;
  toUserId?: string | null;
  reason?: string | null;
  req?: Request;
}): Promise<void> {
  try {
    await ensureAssignmentHistoryTable();
    await pool.query(
      `insert into drm.assignment_history
         (entity_type, entity_id, from_user_id, to_user_id, reason, actor_user_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        input.entityType,
        String(input.entityId),
        input.fromUserId ?? null,
        input.toUserId ?? null,
        input.reason ?? null,
        input.req ? getRequestUserId(input.req) : null,
      ],
    );
  } catch (err) {
    console.error("[assignment-history] record failed (non-fatal):", err);
  }
}

export async function getAssignmentHistory(
  entityType: string,
  entityId: string,
): Promise<any[]> {
  try {
    await ensureAssignmentHistoryTable();
    const { rows } = await pool.query(
      `select h.*,
              fu.name as from_user_name, tu.name as to_user_name, au.name as actor_name
         from drm.assignment_history h
         left join drm.users fu on fu.id::text = h.from_user_id
         left join drm.users tu on tu.id::text = h.to_user_id
         left join drm.users au on au.id::text = h.actor_user_id
        where h.entity_type = $1 and h.entity_id = $2::text
        order by h.created_at desc`,
      [entityType, String(entityId)],
    );
    return rows;
  } catch {
    return [];
  }
}
