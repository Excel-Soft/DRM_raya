import { pool, db } from "../db";
import { callSessions, type CallSession } from "@shared/schema";
import { eq } from "drizzle-orm";

export type InsertCallSession = {
  userId: string;
  customerId?: string | null;
  leadId?: string | null;
  followupId?: string | null;
  reservationType: string;
  direction?: string;
  provider?: string | null;
  providerCallId?: string | null;
};

let ensured = false;
async function ensureCallSessionsSchema() {
  if (ensured) return;
  const ddl = `
    create table if not exists call_sessions (
      id varchar primary key default gen_random_uuid(),
      user_id varchar not null,
      customer_id varchar null,
      lead_id text null,
      followup_id varchar null,
      reservation_type text not null,
      direction text not null default 'outbound',
      status text not null,
      started_at timestamptz not null,
      ended_at timestamptz null,
      duration_seconds int not null default 0,
      provider text null,
      provider_call_id text null,
      created_at timestamptz not null default now()
    );
    alter table call_sessions
      alter column id type varchar using id::varchar,
      alter column user_id type varchar using user_id::varchar,
      alter column customer_id type varchar using customer_id::varchar,
      alter column followup_id type varchar using followup_id::varchar;
    create index if not exists idx_call_sessions_user_started on call_sessions(user_id, started_at);
    create index if not exists idx_call_sessions_followup on call_sessions(followup_id);
    create unique index if not exists uq_call_sessions_provider_call on call_sessions(provider_call_id) where provider_call_id is not null;
  `;
  try {
    await pool.query(ddl);
  } catch (err) {
    console.error("Failed ensuring call_sessions schema (continuing):", err);
  } finally {
    ensured = true;
  }
}

export const callSessionsRepository = {
  async start(data: InsertCallSession): Promise<CallSession> {
    await ensureCallSessionsSchema();
    const [row] = await db
      .insert(callSessions)
      .values({
        userId: data.userId,
        customerId: data.customerId ?? null,
        followupId: data.followupId ?? null,
        reservationType: data.reservationType,
        direction: data.direction ?? "outbound",
        status: "STARTED",
        startedAt: new Date(),
        provider: data.provider ?? "app",
        providerCallId: data.providerCallId ?? null,
      })
      .returning();
    return row;
  },

  async end(sessionId: string, userId: string): Promise<CallSession | null> {
    await ensureCallSessionsSchema();
    const client = await pool.connect();
    try {
      const res = await client.query(
        `select * from call_sessions where id = $1 and user_id = $2 and status = 'STARTED' limit 1`,
        [sessionId, userId],
      );
      const session = res.rows[0];
      if (!session) return null;

      const endedAt = new Date();
      const durationSeconds = Math.max(
        0,
        Math.floor((endedAt.getTime() - new Date(session.started_at).getTime()) / 1000),
      );

      const updateRes = await client.query(
        `update call_sessions
           set ended_at = $1,
               status = 'ENDED',
               duration_seconds = $2
         where id = $3
         returning *`,
        [endedAt, durationSeconds, sessionId],
      );
      const row = updateRes.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        customerId: row.customer_id,
        leadId: row.lead_id,
        followupId: row.followup_id,
        reservationType: row.reservation_type,
        direction: row.direction,
        status: row.status,
        startedAt: row.started_at ? new Date(row.started_at) : endedAt,
        endedAt: row.ended_at ? new Date(row.ended_at) : endedAt,
        durationSeconds: row.duration_seconds ?? durationSeconds,
        provider: row.provider,
        providerCallId: row.provider_call_id,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      } as unknown as CallSession;
    } finally {
      client.release();
    }
  },

  async findActiveByUser(userId: string): Promise<CallSession | null> {
    await ensureCallSessionsSchema();
    const res = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.userId, userId));
    return res.find((r) => r.status === "STARTED") ?? null;
  },

  async sumByReservation(userId: string, from: Date, to: Date): Promise<Record<string, number>> {
    await ensureCallSessionsSchema();
    const res = await pool.query(
      `select reservation_type, coalesce(sum(duration_seconds),0)::int as total
         from call_sessions
        where user_id = $1
          and started_at >= $2 and started_at <= $3
          and status = 'ENDED'
        group by reservation_type`,
      [userId, from, to],
    );
    return res.rows.reduce((acc: Record<string, number>, row: any) => {
      acc[row.reservation_type] = Number(row.total);
      return acc;
    }, {});
  },
};
