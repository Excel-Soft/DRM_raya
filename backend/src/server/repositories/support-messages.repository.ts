import { pool } from "../db";

// Raw SQL against the ACTUAL live `support_messages` columns — the Drizzle
// schema (ticketId/from/body/sentAt) drifted from what's really in the DB
// (ticket_id/sender_user_id/message/created_at/updated_at), the same kind of
// drift documented in tickets.repository.ts. Using db.insert/select against
// the Drizzle definition here throws "column does not exist" at runtime.
export type SupportMessageRow = {
  id: string;
  ticketId: string;
  senderUserId: string | null;
  senderName?: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(r: any): SupportMessageRow {
  return {
    id: r.id,
    ticketId: r.ticket_id,
    senderUserId: r.sender_user_id ?? null,
    senderName: r.sender_name ?? null,
    message: r.message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SupportMessagesRepository {
  async create(data: { ticketId: string; senderUserId?: string | null; message: string }): Promise<SupportMessageRow> {
    const { rows } = await pool.query(
      `insert into support_messages (ticket_id, sender_user_id, message)
       values ($1, $2, $3)
       returning *`,
      [data.ticketId, data.senderUserId ?? null, data.message],
    );
    return mapRow(rows[0]);
  }

  async findById(id: string): Promise<SupportMessageRow | undefined> {
    const { rows } = await pool.query(`select * from support_messages where id = $1`, [id]);
    return rows[0] ? mapRow(rows[0]) : undefined;
  }

  async findByTicketId(ticketId: string): Promise<SupportMessageRow[]> {
    const { rows } = await pool.query(
      `select m.*, u.name as sender_name
       from support_messages m
       left join users u on u.id = m.sender_user_id
       where m.ticket_id = $1
       order by m.created_at desc`,
      [ticketId],
    );
    return rows.map(mapRow);
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(`delete from support_messages where id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const supportMessagesRepository = new SupportMessagesRepository();
