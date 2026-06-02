import { db } from "../db";
import { supportMessages, type SupportMessage, type InsertSupportMessage } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class SupportMessagesRepository {
  async create(data: InsertSupportMessage): Promise<SupportMessage> {
    const [message] = await db.insert(supportMessages).values(data).returning();
    return message;
  }

  async findById(id: string): Promise<SupportMessage | undefined> {
    const [message] = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.id, id));
    return message;
  }

  async findByTicketId(ticketId: string): Promise<SupportMessage[]> {
    return await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(desc(supportMessages.sentAt));
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(supportMessages).where(eq(supportMessages.id, id));
    return result.rowCount! > 0;
  }
}

export const supportMessagesRepository = new SupportMessagesRepository();
