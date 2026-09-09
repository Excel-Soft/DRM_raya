import { db, pool } from "../db";
import { supportTickets, customers, users, type SupportTicket, type InsertSupportTicket } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export type TicketWithRelations = SupportTicket & {
  customer?: typeof customers.$inferSelect;
  assignedTo?: typeof users.$inferSelect;
};

let ensured = false;
async function ensureSupportTicketsSchema() {
  if (ensured) return;
  const ddl = `
    alter table support_tickets add column if not exists assigned_to_user_id uuid;
    alter table support_tickets add column if not exists data_send integer default 0;
    alter table support_tickets add column if not exists external_reference text;
    alter table support_tickets add column if not exists is_deleted boolean default false;
  `;
  try {
    await pool.query(ddl);
  } catch (err) {
    console.error("Failed ensuring support_tickets schema (continuing):", err);
  } finally {
    ensured = true;
  }
}

export class TicketsRepository {
  async create(data: InsertSupportTicket): Promise<SupportTicket> {
    await ensureSupportTicketsSchema();
    const [ticket] = await db.insert(supportTickets).values(data).returning();
    return ticket;
  }

  async findById(id: string): Promise<TicketWithRelations | undefined> {
    await ensureSupportTicketsSchema();
    const [result] = await db
      .select()
      .from(supportTickets)
      .leftJoin(customers, eq(supportTickets.customerId, customers.id))
      .leftJoin(users, eq(supportTickets.assignedToUserId, users.id))
      .where(eq(supportTickets.id, id));

    if (!result) return undefined;

    return {
      ...result.support_tickets,
      customer: result.customers || undefined,
      assignedTo: result.users || undefined,
    };
  }

  async findAll(filters?: {
    status?: string;
    channel?: string;
    priority?: string;
    customerId?: string;
    assignedToUserId?: string;
  }): Promise<TicketWithRelations[]> {
    await ensureSupportTicketsSchema();
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(supportTickets.status, filters.status as any));
    }

    if (filters?.channel) {
      conditions.push(eq(supportTickets.channel, filters.channel as any));
    }

    if (filters?.priority) {
      conditions.push(eq(supportTickets.priority, filters.priority as any));
    }

    if (filters?.customerId) {
      conditions.push(eq(supportTickets.customerId, filters.customerId));
    }

    if (filters?.assignedToUserId) {
      conditions.push(eq(supportTickets.assignedToUserId, filters.assignedToUserId));
    }

    const results = await db
      .select()
      .from(supportTickets)
      .leftJoin(customers, eq(supportTickets.customerId, customers.id))
      .leftJoin(users, eq(supportTickets.assignedToUserId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt));

    return results.map((row) => ({
      ...row.support_tickets,
      customer: row.customers || undefined,
      assignedTo: row.users || undefined,
    }));
  }

  async update(id: string, data: Partial<InsertSupportTicket>): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await ensureSupportTicketsSchema();
    const result = await db.delete(supportTickets).where(eq(supportTickets.id, id));
    return result.rowCount! > 0;
  }

  async updateStatus(id: string, status: string): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async assignTicket(id: string, userId: string): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      .set({ assignedToUserId: userId, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async markDataSent(id: string): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      .set({ dataSend: 1, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }
}

export const ticketsRepository = new TicketsRepository();
