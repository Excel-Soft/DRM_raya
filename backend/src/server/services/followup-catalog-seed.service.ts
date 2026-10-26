import type { PoolClient } from "pg";
import {
  FOLLOWUP_MAIN_SERVICES,
  FOLLOWUP_SUBSERVICE_NAMES,
  stableFollowupSubserviceCode,
} from "../../shared/followup-services-catalog";

/**
 * Upserts main follow-up services and sub-services from the legacy catalog.
 * Safe to run on every startup (ensureServicesSchema).
 */
export async function seedFollowupServicesCatalog(client: PoolClient): Promise<void> {
  for (const main of FOLLOWUP_MAIN_SERVICES) {
    await client.query(
      `insert into services (code, name, is_active)
       values ($1, $2, true)
       on conflict (code) do update set name = excluded.name, is_active = true`,
      [main.code, main.name],
    );
  }

  const mainIds = await client.query<{ id: string; code: string }>(
    `select id, code from services where code = any($1::text[])`,
    [FOLLOWUP_MAIN_SERVICES.map((m) => m.code)],
  );
  const serviceIdByCode = new Map(mainIds.rows.map((r) => [r.code, r.id]));

  for (const main of FOLLOWUP_MAIN_SERVICES) {
    const serviceId = serviceIdByCode.get(main.code);
    if (!serviceId) continue;
    const names = FOLLOWUP_SUBSERVICE_NAMES[main.code] || [];
    for (const subName of names) {
      const subCode = stableFollowupSubserviceCode(main.code, subName);
      await client.query(
        `insert into service_subservices (service_id, code, name, is_active)
         values ($1, $2, $3, true)
         on conflict (service_id, code) do update set
           name = excluded.name,
           is_active = true`,
        [serviceId, subCode, subName],
      );
    }
  }
}
