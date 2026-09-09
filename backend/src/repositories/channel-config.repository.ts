import { db } from "../db";
import { supportChannelConfig, type SupportChannelConfig, type InsertSupportChannelConfig } from "@models/schema";
import { eq } from "drizzle-orm";

export class ChannelConfigRepository {
  async create(data: InsertSupportChannelConfig): Promise<SupportChannelConfig> {
    const [config] = await db.insert(supportChannelConfig).values(data).returning();
    return config;
  }

  async findById(id: string): Promise<SupportChannelConfig | undefined> {
    const [config] = await db
      .select()
      .from(supportChannelConfig)
      .where(eq(supportChannelConfig.id, id));
    return config;
  }

  async findByChannel(channel: string): Promise<SupportChannelConfig | undefined> {
    const [config] = await db
      .select()
      .from(supportChannelConfig)
      .where(eq(supportChannelConfig.channel, channel as any));
    return config;
  }

  async findAll(): Promise<SupportChannelConfig[]> {
    return await db.select().from(supportChannelConfig);
  }

  async update(id: string, data: Partial<InsertSupportChannelConfig>): Promise<SupportChannelConfig | undefined> {
    const [updated] = await db
      .update(supportChannelConfig)
      .set(data)
      .where(eq(supportChannelConfig.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(supportChannelConfig).where(eq(supportChannelConfig.id, id));
    return result.rowCount! > 0;
  }

  async toggleActive(id: string, isActive: number): Promise<SupportChannelConfig | undefined> {
    const [updated] = await db
      .update(supportChannelConfig)
      .set({ isActive })
      .where(eq(supportChannelConfig.id, id))
      .returning();
    return updated;
  }
}

export const channelConfigRepository = new ChannelConfigRepository();
