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
    alter table support_tickets add column if not exists assignment_status text not null default 'pending';
    alter table support_tickets add column if not exists review_status text not null default 'none';
    alter type support_ticket_status add value if not exists 'Closed';
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
      // A (re)assignment always resets acknowledgment — the new assignee
      // gets the sticky popup again, same as on initial creation.
      .set({ assignedToUserId: userId, assignmentStatus: "pending", updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async findPendingAssignmentsForUser(userId: string): Promise<TicketWithRelations[]> {
    await ensureSupportTicketsSchema();
    const results = await db
      .select()
      .from(supportTickets)
      .leftJoin(customers, eq(supportTickets.customerId, customers.id))
      .leftJoin(users, eq(supportTickets.assignedToUserId, users.id))
      .where(and(
        eq(supportTickets.assignedToUserId, userId),
        eq(supportTickets.assignmentStatus, "pending"),
      ))
      .orderBy(desc(supportTickets.createdAt));

    return results.map((row) => ({
      ...row.support_tickets,
      customer: row.customers || undefined,
      assignedTo: row.users || undefined,
    }));
  }

  async findAcceptedForUser(userId: string): Promise<TicketWithRelations[]> {
    await ensureSupportTicketsSchema();
    const results = await db
      .select()
      .from(supportTickets)
      .leftJoin(customers, eq(supportTickets.customerId, customers.id))
      .leftJoin(users, eq(supportTickets.assignedToUserId, users.id))
      .where(and(
        eq(supportTickets.assignedToUserId, userId),
        eq(supportTickets.assignmentStatus, "accepted"),
      ))
      .orderBy(desc(supportTickets.createdAt));

    return results.map((row) => ({
      ...row.support_tickets,
      customer: row.customers || undefined,
      assignedTo: row.users || undefined,
    }));
  }

  // Ownership-checked: only the assignee themselves can accept/reject their
  // own pending assignment. Returns undefined if not found or not theirs.
  async acceptAssignment(id: string, userId: string): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      .set({ assignmentStatus: "accepted", status: "InProgress", updatedAt: new Date() })
      .where(and(eq(supportTickets.id, id), eq(supportTickets.assignedToUserId, userId)))
      .returning();
    return updated;
  }

  async rejectAssignment(id: string, userId: string): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      // Unassign on reject so the ticket is free to be handed to someone else.
      .set({ assignmentStatus: "rejected", assignedToUserId: null, updatedAt: new Date() })
      .where(and(eq(supportTickets.id, id), eq(supportTickets.assignedToUserId, userId)))
      .returning();
    return updated;
  }

  // The assignee marks their accepted ticket as done — moves it from
  // "InProgress" to "Resolved" and flags reviewStatus "pending" so the
  // ticket's creator (the complaint manager) gets a sticky approval popup.
  // Ownership-checked: only the assignee can submit their own ticket.
  async submitForReview(id: string, userId: string): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      .set({ status: "Resolved", reviewStatus: "pending", updatedAt: new Date() })
      .where(and(eq(supportTickets.id, id), eq(supportTickets.assignedToUserId, userId)))
      .returning();
    return updated;
  }

  // Tickets this user created that are waiting on their approval after the
  // assignee submitted them (drives the sticky approval popup).
  async findPendingReviewForCreator(userId: string): Promise<TicketWithRelations[]> {
    await ensureSupportTicketsSchema();
    const results = await db
      .select()
      .from(supportTickets)
      .leftJoin(customers, eq(supportTickets.customerId, customers.id))
      .leftJoin(users, eq(supportTickets.assignedToUserId, users.id))
      .where(and(
        eq(supportTickets.createdBy, userId),
        eq(supportTickets.reviewStatus, "pending"),
      ))
      .orderBy(desc(supportTickets.createdAt));

    return results.map((row) => ({
      ...row.support_tickets,
      customer: row.customers || undefined,
      assignedTo: row.users || undefined,
    }));
  }

  // Ownership-checked: only the ticket's creator can approve its review.
  // Approving is the final step — status moves Resolved -> Closed.
  async approveReview(id: string, userId: string): Promise<SupportTicket | undefined> {
    await ensureSupportTicketsSchema();
    const [updated] = await db
      .update(supportTickets)
      .set({ reviewStatus: "approved", status: "Closed", updatedAt: new Date() })
      .where(and(eq(supportTickets.id, id), eq(supportTickets.createdBy, userId)))
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
