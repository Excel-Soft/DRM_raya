#!/usr/bin/env node
/**
 * webxl_followup_service -> drm.diagnose_followups
 * drm_legacy_stage ONLY
 */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const SOURCE = "webxl_followup_service";
const TARGET = "diagnose_followups";
const ENTITY = "diagnose_followup";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "3000");
const limit = args.find((a) => a.startsWith("--limit=")) ? Number(args.find((a) => a.startsWith("--limit=")).split("=")[1]) : null;

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseTs(v) {
  const s = trimOrNull(v);
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapId(raw, map) {
  const s = trimOrNull(raw);
  if (!s || s === "0") return null;
  return map.get(s) ?? null;
}

function transform(row, ctx) {
  const legacyPk = String(row.id);
  if (ctx.done.has(legacyPk)) return { status: "skipped", legacyPk };
  const userId = mapId(row.uid, ctx.userMap);
  if (!userId) return { status: "rejected", reason: "unmapped_user", legacyPk };
  const companyId = mapId(row.com_id, ctx.customerMap);
  const createDate = parseTs(row.create_date) ?? new Date();
  return {
    status: "valid",
    legacyPk,
    modern: {
      company_id: companyId,
      user_id: userId,
      start_rating: trimOrNull(row.start_rating),
      up_salling: trimOrNull(row.up_salling),
      rfq: trimOrNull(row.rfq),
      products: trimOrNull(row.products),
      follow_rate: trimOrNull(row.follow_rate),
      sample: trimOrNull(row.sample),
      order_info: trimOrNull(row.order),
      revenue: trimOrNull(row.revenue),
      happy_alibaba: trimOrNull(row.happy_alibaba),
      happy_webxl: trimOrNull(row.happy_webxl),
      report: trimOrNull(row.report),
      create_date: createDate,
    },
  };
}

async function loadMaps(c) {
  const u = await c.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='user' AND legacy_table='webxl_user'`);
  const cu = await c.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='customer' AND legacy_table='webxl_company'`);
  return {
    userMap: new Map(u.rows.map((r) => [String(r.legacy_id), r.modern_id])),
    customerMap: new Map(cu.rows.map((r) => [String(r.legacy_id), r.modern_id])),
  };
}

async function main() {
  if (!dryRun && !executeStaging) {
    console.error("Use --dry-run or --execute-staging");
    process.exit(2);
  }
  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();
  const maps = await loadMaps(client);
  const { rows: doneRows } = await client.query(
    `SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type=$1 AND legacy_table=$2`,
    [ENTITY, SOURCE],
  );
  const done = new Set(doneRows.map((r) => String(r.legacy_id)));

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::int total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m WHERE m.entity_type='user' AND m.legacy_table='webxl_user' AND m.legacy_id=webxl_followup_service.uid::text)) unmapped_user
      FROM legacy_archive.webxl_followup_service`);
    console.log(JSON.stringify({ mode: "dry_run", ...rows[0], already: done.size, maps: { users: maps.userMap.size, customers: maps.customerMap.size } }));
    await client.end();
    return;
  }

  const batchRes = await client.query(
    `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status) VALUES ($1,$2,'running') RETURNING batch_id`,
    [SOURCE, TARGET],
  );
  const batchId = batchRes.rows[0].batch_id;
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = limit;

  while (true) {
    const lim = rem != null ? Math.min(batchSize, rem) : batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, com_id, uid, start_rating, up_salling, rfq, products, follow_rate, sample, "order", revenue, happy_alibaba, happy_webxl, report, create_date
       FROM legacy_archive.webxl_followup_service WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    const pending = [];
    for (const row of rows) {
      lastId = Number(row.id);
      const t = transform(row, { ...maps, done });
      if (t.status === "skipped") {
        skipped++;
        continue;
      }
      if (t.status === "rejected") {
        rejected++;
        continue;
      }
      pending.push(t);
    }
    if (pending.length) {
      await client.query("BEGIN");
      try {
        for (const t of pending) {
          const m = t.modern;
          const id = crypto.randomUUID();
          await client.query(
            `INSERT INTO drm.diagnose_followups (id, company_id, user_id, start_rating, up_salling, rfq, products, follow_rate, sample, order_info, revenue, happy_alibaba, happy_webxl, report, create_date, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`,
            [id, m.company_id, m.user_id, m.start_rating, m.up_salling, m.rfq, m.products, m.follow_rate, m.sample, m.order_info, m.revenue, m.happy_alibaba, m.happy_webxl, m.report, m.create_date],
          );
          await client.query(
            `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
            [ENTITY, SOURCE, t.legacyPk, id, TARGET],
          );
          done.add(t.legacyPk);
          migrated++;
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
    if (rem != null) rem -= rows.length;
    if (rows.length < lim) break;
    if (migrated && migrated % 15000 === 0) console.log(JSON.stringify({ progress: migrated, rejected, lastId }));
  }

  await client.query(`UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`, [
    batchId,
    migrated,
    rejected,
  ]);
  const total = (await client.query(`SELECT count(*)::int c FROM drm.diagnose_followups`)).rows[0].c;
  console.log(JSON.stringify({ mode: "execute_staging", migrated, rejected, skipped, diagnose_total: total }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
