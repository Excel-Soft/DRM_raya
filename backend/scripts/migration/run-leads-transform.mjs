#!/usr/bin/env node
/**
 * webxl_leads -> drm.opportunities
 * drm_legacy_stage ONLY
 */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const SOURCE = "webxl_leads";
const TARGET = "opportunities";
const ENTITY = "lead";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "5000");
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

function buildTitle(row) {
  const note = trimOrNull(row.transfer_note);
  const tr = trimOrNull(row.transfer);
  if (note) return note.slice(0, 500);
  if (tr && tr.toUpperCase() !== "NO") return `Transfer: ${tr}`.slice(0, 500);
  return `Legacy lead ${row.id}`;
}

async function loadMaps(client) {
  const u = await client.query(
    `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='user' AND legacy_table='webxl_user'`,
  );
  const c = await client.query(
    `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='customer' AND legacy_table='webxl_company'`,
  );
  const byDrm = await client.query(`SELECT drm_id, id FROM drm.customers WHERE drm_id IS NOT NULL`);
  const fallbackUser = (await client.query(`SELECT id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id ?? null;
  const fallbackCustomer = (await client.query(`SELECT id FROM drm.customers ORDER BY created_at LIMIT 1`)).rows[0]?.id ?? null;
  return {
    userMap: new Map(u.rows.map((r) => [String(r.legacy_id), r.modern_id])),
    customerMap: new Map(c.rows.map((r) => [String(r.legacy_id), r.modern_id])),
    customerByDrmId: new Map(byDrm.rows.map((r) => [String(r.drm_id).toLowerCase(), r.id])),
    fallbackUser,
    fallbackCustomer,
  };
}

function resolveCustomer(comId, maps) {
  const s = trimOrNull(comId);
  if (!s) return null;
  if (/^\d+$/.test(s)) return maps.customerMap.get(s) ?? null;
  return maps.customerByDrmId.get(s.toLowerCase()) ?? null;
}

function mapLeadUser(raw, ctx) {
  const s = trimOrNull(raw);
  if (!s || s === "0") return ctx.fallbackUser;
  return ctx.userMap.get(s) ?? ctx.fallbackUser;
}

function transform(row, ctx) {
  const legacyPk = String(row.id);
  if (ctx.done.has(legacyPk)) return { status: "skipped", legacyPk };
  const customerId = resolveCustomer(row.com_id, ctx) ?? ctx.fallbackCustomer;
  if (!customerId) return { status: "rejected", reason: "unmapped_customer", legacyPk };
  const ownerId = mapLeadUser(row.user_id, ctx);
  if (!ownerId) return { status: "rejected", reason: "unmapped_user", legacyPk };
  const createdAt = parseTs(row.create_date) ?? new Date();
  return {
    status: "valid",
    legacyPk,
    modern: {
      customer_id: customerId,
      owner_id: ownerId,
      title: buildTitle(row),
      stage: "LD",
      created_at: createdAt,
    },
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
  const done = new Set(
    (await client.query(`SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type=$1 AND legacy_table=$2`, [ENTITY, SOURCE])).rows.map(
      (r) => String(r.legacy_id),
    ),
  );
  const ctx = { ...maps, done };

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE trim(coalesce(com_id,''))='')::bigint empty_com,
        count(*) FILTER (WHERE trim(coalesce(user_id,''))='')::bigint empty_user
      FROM legacy_archive.webxl_leads`);
    console.log(JSON.stringify({ mode: "dry_run", ...rows[0], already_mapped: done.size, userMap: maps.userMap.size, customerMap: maps.customerMap.size }));
    await client.end();
    return;
  }

  const batchId = (
    await client.query(`INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status) VALUES ($1,$2,'running') RETURNING batch_id`, [
      SOURCE,
      TARGET,
    ])
  ).rows[0].batch_id;

  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = limit;

  while (true) {
    const lim = rem != null ? Math.min(batchSize, rem) : batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, com_id, user_id, assgin_by, transfer, transfer_note, create_date
       FROM legacy_archive.webxl_leads WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;

    const pending = [];
    for (const row of rows) {
      lastId = Number(row.id);
      const t = transform(row, ctx);
      if (t.status === "skipped") {
        skipped++;
        continue;
      }
      if (t.status === "rejected") {
        rejected++;
        if (rejected <= 300) {
          await client.query(
            `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason) VALUES ($1,$2,$3,$4)`,
            [SOURCE, t.legacyPk, TARGET, t.reason],
          );
        }
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
            `INSERT INTO drm.opportunities (id, customer_id, owner_id, title, stage, value, is_deleted, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,0,false,$6,$6)`,
            [id, m.customer_id, m.owner_id, m.title, m.stage, m.created_at],
          );
          await client.query(
            `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
            [ENTITY, SOURCE, t.legacyPk, id, TARGET],
          );
          ctx.done.add(t.legacyPk);
          migrated++;
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }

    if (rem != null) rem -= rows.length;
    if (migrated && migrated % 25000 === 0) console.log(JSON.stringify({ progress: migrated, rejected, lastId }));
    if (rows.length < lim) break;
  }

  await client.query(`UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`, [
    batchId,
    migrated,
    rejected,
  ]);
  const total = (await client.query(`SELECT count(*)::int c FROM drm.opportunities`)).rows[0].c;
  console.log(JSON.stringify({ mode: "execute_staging", migrated, rejected, skipped, opportunities_total: total, limit }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
