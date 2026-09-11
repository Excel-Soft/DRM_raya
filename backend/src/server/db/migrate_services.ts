import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { services, serviceSubservices } from "../../shared/schema";
import * as fs from "fs";

// Connection to the new database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function main() {
  const sqlFile = fs.readFileSync("/Users/apple/DRM Raya/DRM-WebExcels-Version-10/backend/services_dump.sql", "utf-8");

  // Extract the INSERT statement for webxl_quotation_services
  const insertRegex = /INSERT INTO `webxl_quotation_services` \([^)]+\) VALUES\s*([\s\S]*?);\n/m;
  const match = sqlFile.match(insertRegex);

  if (!match) {
    console.error("Could not find INSERT statement for webxl_quotation_services");
    return;
  }

  const valuesStr = match[1];
  
  // Parse rows (very simple regex approach assuming no complex nested parentheses with commas)
  const rowsStr = valuesStr.split(/\),\s*\(/);
  
  const parsedRows = rowsStr.map(r => {
    let cleaned = r.replace(/^\(/, "").replace(/\)$/, "").trim();
    
    // We split by comma, but we need to handle strings with commas inside single quotes.
    // A quick hack for this specific dump:
    const regex = /'(?:[^'\\]|\\.)*'|NULL|\d+(?:\.\d+)?/g;
    const parts = cleaned.match(regex);
    if (!parts) return null;

    const [id, main_id, name, detail, price, discount, min_day, max_day, dep_id] = parts.map(p => {
      if (p === 'NULL') return null;
      if (p.startsWith("'")) return p.slice(1, -1).replace(/\\'/g, "'");
      return Number(p);
    });

    return {
      oldId: id as number,
      mainId: main_id as number,
      name: name as string,
      detail: detail as string | null,
      price: price as number,
      discount: discount as number,
      minDay: min_day as number | null,
      maxDay: max_day as number | null,
    };
  }).filter(Boolean) as any[];

  console.log(`Found ${parsedRows.length} legacy services`);

  // We need to keep track of new UUIDs
  const oldToNewMap = new Map<number, string>();

  // 1. Insert main services (mainId === 0)
  const mainServices = parsedRows.filter(r => r.mainId === 0);
  for (const s of mainServices) {
    const code = `legacy_svc_${s.oldId}`;
    const result = await db.insert(services).values({
      code,
      name: s.name,
      description: s.detail || null,
      price: String(s.price || 0),
      discount: String(s.discount || 0),
      minDay: s.minDay || null,
      maxDay: s.maxDay || null,
    }).onConflictDoUpdate({
      target: services.code,
      set: {
        name: s.name,
        description: s.detail || null,
        price: String(s.price || 0),
        discount: String(s.discount || 0),
        minDay: s.minDay || null,
        maxDay: s.maxDay || null,
      }
    }).returning({ id: services.id });

    if (result[0]) {
      oldToNewMap.set(s.oldId, result[0].id);
    }
  }

  console.log(`Inserted ${mainServices.length} main services`);

  // 2. Insert sub services (mainId !== 0)
  const subServices = parsedRows.filter(r => r.mainId !== 0);
  for (const s of subServices) {
    const parentUuid = oldToNewMap.get(s.mainId);
    if (!parentUuid) {
      console.warn(`Could not find parent for subservice ${s.name} (old parent id ${s.mainId})`);
      continue;
    }

    const code = `legacy_sub_${s.oldId}`;
    await db.insert(serviceSubservices).values({
      serviceId: parentUuid,
      code,
      name: s.name,
      description: s.detail || null,
      price: String(s.price || 0),
      discount: String(s.discount || 0),
      minDay: s.minDay || null,
      maxDay: s.maxDay || null,
    }).onConflictDoUpdate({
      target: serviceSubservices.code,
      set: {
        name: s.name,
        description: s.detail || null,
        price: String(s.price || 0),
        discount: String(s.discount || 0),
        minDay: s.minDay || null,
        maxDay: s.maxDay || null,
      }
    });
  }

  console.log(`Inserted ${subServices.length} sub services`);
  process.exit(0);
}

main().catch(console.error);
