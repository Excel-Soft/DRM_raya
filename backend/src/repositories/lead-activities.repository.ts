import { db, pool } from "../db";
import { leadActivities, InsertLeadActivity, LeadActivity } from "@models/schema";
import { eq, desc } from "drizzle-orm";

let ensured = false;
async function ensureLeadActivitiesSchema() {
  if (ensured) return;
  const ddl = `
    create table if not exists lead_activities (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid not null references customers(id) on delete cascade,
      action text not null,
      performed_by uuid not null references users(id),
      note text,
      meta jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_lead_activities_customer on lead_activities(customer_id);
    create index if not exists idx_lead_activities_created on lead_activities(created_at desc);
  `;
  try {
    await pool.query(ddl);
    ensured = true;
  } catch (err) {
    console.error("Failed ensuring lead_activities schema (continuing):", err);
  }
}

export const leadActivitiesRepository = {
  async log(data: InsertLeadActivity): Promise<LeadActivity> {
    await ensureLeadActivitiesSchema();
    const [row] = await db.insert(leadActivities).values(data).returning();
    return row;
  },

  async listByCustomer(customerId: string): Promise<LeadActivity[]> {
    await ensureLeadActivitiesSchema();
    return db
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.customerId, customerId))
      .orderBy(desc(leadActivities.createdAt))
      .limit(200);
  },
};
