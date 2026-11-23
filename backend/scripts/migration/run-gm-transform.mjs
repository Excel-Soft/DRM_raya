#!/usr/bin/env node
/**
 * webxl_verify_gm -> drm.gm_entries (best-effort GM module)
 * drm_legacy_stage ONLY
 */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const SOURCE = "webxl_verify_gm";
const TARGET = "gm_entries";
const ENTITY = "gm_entry";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "500");

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

function parseMoney(v, fallback = "0") {
  if (v == null || v === "") return fallback;
  const s = String(v).replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return fallback;
  return s;
}

function mapGmStatus(raw) {
  const s = (trimOrNull(raw) ?? "").toLowerCase();
  if (s.includes("reject")) return "Rejected";
  if (s.includes("approv") || s.includes("paid") || s.includes("cash received") || s.includes("customer paid")) return "Completed";
  if (s === "") return "Pending";
  return "Pending";
}

function transform(row, ctx) {
  const legacyPk = String(row.id);
  if (ctx.done.has(legacyPk)) return { status: "skipped", legacyPk };
  const createdBy = ctx.userMap.get(String(row.add_by)) ?? ctx.userMap.get(String(row.user_id)) ?? ctx.userMap.get(String(row.approved_by));
  if (!createdBy) return { status: "rejected", reason: "unmapped_user", legacyPk };

  const comLegacy = trimOrNull(row.com_id);
  let drmId = `legacy-com-${comLegacy}`;
  let companyName = `Company ${comLegacy}`;
  if (comLegacy && /^\d+$/.test(comLegacy)) {
    const custUuid = ctx.customerMap.get(comLegacy);
    if (custUuid) {
      const meta = ctx.customerDrmId.get(custUuid);
      if (meta?.drm_id) drmId = meta.drm_id;
      if (meta?.company_name) companyName = meta.company_name;
    }
  }

  const amountUsd = parseMoney(row.customer_dollars, parseMoney(row.price, "1"));
  const createdAt = parseTs(row.create_date) ?? new Date();

  return {
    status: "valid",
    legacyPk,
    modern: {
      gm_type: "GM",
      drm_id: drmId.slice(0, 200),
      member_id: trimOrNull(row.member_id),
      order_id: trimOrNull(row.order_id),
      company_name: companyName.slice(0, 500),
      sales_person_id: ctx.userMap.get(String(row.user_id)) ?? null,
      package_type: trimOrNull(row.package) ?? "Unknown",
      entry_type: trimOrNull(row.renwal) ?? "New",
      package_price_usd: parseMoney(row.package_price, null),
      amount_usd: amountUsd,
      customer_dollar: parseMoney(row.customer_dollars, null),
      dollar_rate: parseMoney(row.dollar_rate, null),
      alibaba_discount_usd: parseMoney(row.discount, null),
      extra_discount_usd: parseMoney(row.extra_discount, null),
      extra_discount_pkr: parseMoney(row.extra_pkr_discount, null),
      payment_status: trimOrNull(row.acc_pay_status) ?? trimOrNull(row.webxl_pay_status),
      status: mapGmStatus(row.status),
      notes: trimOrNull(row.coments),
      created_by: createdBy,
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
  const u = await client.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='user' AND legacy_table='webxl_user'`);
  const userMap = new Map(u.rows.map((r) => [String(r.legacy_id), r.modern_id]));
  const custRows = await client.query(`SELECT m.modern_id, c.drm_id, c.company_name FROM migration_meta.migration_legacy_ids m JOIN drm.customers c ON c.id=m.modern_id::uuid WHERE m.entity_type='customer' AND m.legacy_table='webxl_company'`);
  const customerMap = new Map(custRows.rows.map((r) => [String(r.legacy_id), r.modern_id]));
  const customerDrmId = new Map(custRows.rows.map((r) => [r.modern_id, { drm_id: r.drm_id, company_name: r.company_name }]));
  // fix customerMap - need legacy_id from join
  const cu2 = await client.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='customer' AND legacy_table='webxl_company'`);
  const customerMap2 = new Map(cu2.rows.map((r) => [String(r.legacy_id), r.modern_id]));

  const done = new Set(
    (await client.query(`SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type=$1 AND legacy_table=$2`, [ENTITY, SOURCE])).rows.map((r) => String(r.legacy_id)),
  );

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::int total FROM legacy_archive.webxl_verify_gm`);
    console.log(JSON.stringify({ mode: "dry_run", ...rows[0], already: done.size, users: userMap.size }));
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
    lastId = -1;
  while (true) {
    const { rows } = await client.query(
      `SELECT id, package, price, package_price, customer_dollars, dollar_rate, discount, extra_discount, extra_pkr_discount, com_id, user_id, add_by, member_id, order_id, status, coments, create_date, renwal, acc_pay_status, webxl_pay_status, approved_by
       FROM legacy_archive.webxl_verify_gm WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, batchSize],
    );
    if (!rows.length) break;
    const pending = [];
    for (const row of rows) {
      lastId = Number(row.id);
      const t = transform(row, { userMap, customerMap: customerMap2, customerDrmId, done });
      if (t.status === "skipped") continue;
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
            `INSERT INTO drm.gm_entries (
              id, gm_type, drm_id, member_id, order_id, company_name, sales_person_id, package_type, entry_type,
              amount_usd, customer_dollar, dollar_rate, alibaba_discount_usd, extra_discount_usd, extra_discount_pkr,
              payment_status, status, notes, created_by, created_at, updated_at, is_loan, is_partial_payment
            ) VALUES ($1,'GM',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,0,0)`,
            [
              id,
              m.drm_id,
              m.member_id,
              m.order_id,
              m.company_name,
              m.sales_person_id,
              m.package_type,
              m.entry_type,
              m.amount_usd,
              m.customer_dollar,
              m.dollar_rate,
              m.alibaba_discount_usd,
              m.extra_discount_usd,
              m.extra_discount_pkr,
              m.payment_status,
              m.status,
              m.notes,
              m.created_by,
              m.created_at,
            ],
          );
          await client.query(`INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`, [
            ENTITY,
            SOURCE,
            t.legacyPk,
            id,
            TARGET,
          ]);
          done.add(t.legacyPk);
          migrated++;
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
    if (rows.length < batchSize) break;
  }

  await client.query(`UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`, [
    batchId,
    migrated,
    rejected,
  ]);
  console.log(JSON.stringify({ mode: "execute_staging", migrated, rejected, gm_total: (await client.query(`SELECT count(*)::int c FROM drm.gm_entries`)).rows[0].c }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
