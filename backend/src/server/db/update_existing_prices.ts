import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { services, serviceSubservices } from "../../shared/schema";
import * as fs from "fs";
import { sql } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function main() {
  const sqlFile = fs.readFileSync("/Users/apple/Downloads/webxl_quotation_services.sql", "utf-8");
  const insertRegex = /INSERT INTO `webxl_quotation_services` \([^)]+\) VALUES\s*([\s\S]*?);\n/m;
  const match = sqlFile.match(insertRegex);

  if (!match) {
    console.error("Could not find INSERT statement");
    return;
  }

  const valuesStr = match[1];
  const rowsStr = valuesStr.split(/\),\s*\(/);
  
  const parsedRows = rowsStr.map(r => {
    let cleaned = r.replace(/^\(/, "").replace(/\)$/, "").trim();
    const regex = /'(?:[^'\\]|\\.)*'|NULL|\d+(?:\.\d+)?/g;
    const parts = cleaned.match(regex);
    if (!parts) return null;

    const [id, main_id, name, detail, price, discount, min_day, max_day, dep_id] = parts.map(p => {
      if (p === 'NULL') return null;
      if (p.startsWith("'")) return p.slice(1, -1).replace(/\\'/g, "'");
      return Number(p);
    });

    return {
      oldId: id,
      mainId: main_id,
      name: name,
      detail: detail,
      price: price,
      discount: discount,
      minDay: min_day,
      maxDay: max_day,
    };
  }).filter(Boolean) as any[];

  console.log(`Found ${parsedRows.length} legacy services to match by name`);

  for (const s of parsedRows) {
    // try to update matching subservice
    const subRes = await db.execute(sql`
      UPDATE drm.service_subservices
      SET price = ${String(s.price || 0)},
          discount = ${String(s.discount || 0)},
          min_day = ${s.minDay || null},
          max_day = ${s.maxDay || null},
          description = coalesce(description, ${s.detail || null})
      WHERE lower(trim(name)) = lower(trim(${s.name}))
         OR lower(trim(name)) || ' package' = lower(trim(${s.name}))
         OR lower(trim(name)) = lower(trim(${s.name})) || ' package'
      RETURNING id
    `);

    // try to update matching main service
    const mainRes = await db.execute(sql`
      UPDATE drm.services
      SET price = ${String(s.price || 0)},
          discount = ${String(s.discount || 0)},
          min_day = ${s.minDay || null},
          max_day = ${s.maxDay || null},
          description = coalesce(description, ${s.detail || null})
      WHERE lower(trim(name)) = lower(trim(${s.name}))
         OR lower(trim(name)) || ' package' = lower(trim(${s.name}))
         OR lower(trim(name)) = lower(trim(${s.name})) || ' package'
      RETURNING id
    `);

    if (subRes.rows.length > 0) {
      console.log(`Updated subservice for ${s.name}`);
    }
    if (mainRes.rows.length > 0) {
      console.log(`Updated main service for ${s.name}`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
