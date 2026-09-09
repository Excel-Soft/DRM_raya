import { db, pool } from "../db";
import { leadServices, InsertLeadService, LeadService } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

let ensured = false;
async function ensureLeadServicesSchema() {
  if (ensured) return;
  const ddl = `
    create table if not exists lead_services (
      id uuid primary key default gen_random_uuid(),
      lead_id uuid not null references customers(id) on delete cascade,
      service_type text not null check (service_type in ('domain','ssl','hosting')),
      expiry_date timestamptz,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_lead_services_lead on lead_services(lead_id);
    create index if not exists idx_lead_services_type on lead_services(service_type);
  `;
  try {
    await pool.query(ddl);
    ensured = true;
  } catch (err) {
    console.error("Failed ensuring lead_services schema (continuing):", err);
  }
}

type UpsertLeadService = InsertLeadService & { createdAt?: Date | null };

export const leadServicesRepository = {
  async upsert(service: UpsertLeadService): Promise<LeadService> {
    await ensureLeadServicesSchema();
    const { createdAt, ...rest } = service;
    const payload = {
      ...rest,
      ...(createdAt ? { createdAt } : {}),
    };
    const [row] = await db
      .insert(leadServices)
      .values(payload)
      .onConflictDoUpdate({
        target: [leadServices.leadId, leadServices.serviceType],
        set: { expiryDate: service.expiryDate, createdAt: service.createdAt ?? new Date() },
      })
      .returning();
    return row;
  },

  async listByLead(leadId: string): Promise<LeadService[]> {
    await ensureLeadServicesSchema();
    return db
      .select()
      .from(leadServices)
      .where(eq(leadServices.leadId, leadId))
      .orderBy(asc(leadServices.serviceType));
  },
};
