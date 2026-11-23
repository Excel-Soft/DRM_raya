#!/usr/bin/env node
/** 3B: webxl_quotations + webxl_quotation_items -> drm.quotations + quotation_items */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "500");

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function money(v, fb = "0") {
  if (v == null || v === "") return fb;
  const s = String(v).replace(/,/g, "").trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? s : fb;
}

function parseTs(v) {
  const s = trimOrNull(v);
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeInt(v) {
  if (v == null || v === "") return null;
  const n = Math.trunc(Number(String(v).trim()));
  return Number.isFinite(n) ? n : null;
}

function mapHod(raw) {
  const s = (trimOrNull(raw) ?? "").toLowerCase();
  if (s.includes("approv")) return "approved";
  if (s.includes("reject")) return "rejected";
  return trimOrNull(raw);
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
  const done = new Set(
    (await client.query(`SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type='quotation' AND legacy_table='webxl_quotations'`)).rows.map(
      (r) => String(r.legacy_id),
    ),
  );

  const { rows: itemRows } = await client.query(
    `SELECT id, quo_id, item, detail, unit_price, ab_discount, qty, min_day, max_day, from_year, to_year, domain
     FROM legacy_archive.webxl_quotation_items ORDER BY quo_id::bigint, id::bigint`,
  );
  const itemsByQuo = new Map();
  for (const r of itemRows) {
    const k = String(r.quo_id);
    if (!itemsByQuo.has(k)) itemsByQuo.set(k, []);
    itemsByQuo.get(k).push(r);
  }

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::int total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m WHERE m.entity_type='user' AND m.legacy_table='webxl_user' AND m.legacy_id=webxl_quotations.user_id::text)) no_user
      FROM legacy_archive.webxl_quotations`);
    console.log(JSON.stringify({ mode: "dry_run", ...rows[0], item_rows: itemRows.length, already: done.size }));
    await client.end();
    return;
  }

  const batchId = (
    await client.query(`INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status) VALUES ('webxl_quotations','quotations','running') RETURNING batch_id`)
  ).rows[0].batch_id;

  let migrated = 0,
    rejected = 0,
    itemsInserted = 0,
    lastId = -1;

  while (true) {
    const { rows } = await client.query(
      `SELECT quo_id, com_id, cname, phone, email, address, user_id, sub_total, discount, grand_total, gst, first_pay, quo_title, quo_note, quo_save, quo_type, dliver_time, dollar_rate, hod_status, hod_comment, create_date
       FROM legacy_archive.webxl_quotations WHERE quo_id::bigint > $1 ORDER BY quo_id::bigint LIMIT $2`,
      [lastId, batchSize],
    );
    if (!rows.length) break;

    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.quo_id);
        const legacyPk = String(row.quo_id);
        if (done.has(legacyPk)) continue;
        const createdBy = maps.userMap.get(String(row.user_id));
        if (!createdBy) {
          rejected++;
          continue;
        }
        const customerId = maps.customerMap.get(String(row.com_id)) ?? null;
        const sub = money(row.sub_total, "0");
        const grand = money(row.grand_total, sub);
        const gstAmt = money(row.gst, "0");
        const qId = crypto.randomUUID();
        const createdAt = parseTs(row.create_date) ?? new Date();

        await client.query(
          `INSERT INTO drm.quotations (
            id, customer_id, account_holder, company, email, contact, delivery_time,
            gst_percent, discount_type, discount_value, sub_amount, gst_amount, total_amount, grand_total,
            payment_term_percent, save_status, note, dollar_rate, created_by, created_at, updated_at,
            hod_status, hod_comment, quotation_type, amount
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            0,'AMOUNT',$8,$9,$10,$11,$11,
            $12,$13,$14,$15,$16,$17,$17,
            $18,$19,$20,$11
          )`,
          [
            qId,
            customerId,
            trimOrNull(row.cname) ?? "Account",
            trimOrNull(row.cname) ?? `Company ${row.com_id}`,
            trimOrNull(row.email),
            trimOrNull(row.phone),
            trimOrNull(row.dliver_time),
            money(row.discount, "0"),
            sub,
            gstAmt,
            grand,
            money(row.first_pay, "0"),
            trimOrNull(row.quo_save),
            trimOrNull(row.quo_note) ?? trimOrNull(row.quo_title),
            money(row.dollar_rate, "280"),
            createdBy,
            createdAt,
            mapHod(row.hod_status),
            trimOrNull(row.hod_comment),
            trimOrNull(row.quo_type),
          ],
        );

        for (const it of itemsByQuo.get(legacyPk) ?? []) {
          const qty = Math.max(1, safeInt(it.qty) ?? 1);
          const unit = money(it.unit_price, "0");
          const total = (Number(unit) * qty).toFixed(2);
          await client.query(
            `INSERT INTO drm.quotation_items (quotation_id, product_id, detail, min_time, max_time, unit_price, quantity, item_total, start_year, end_year, domain_url, ab_discount)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              qId,
              String(it.item ?? it.id).slice(0, 200),
              trimOrNull(it.detail),
              safeInt(it.min_day),
              safeInt(it.max_day),
              unit,
              qty,
              total,
              safeInt(it.from_year),
              safeInt(it.to_year),
              trimOrNull(it.domain),
              money(it.ab_discount, "0"),
            ],
          );
          itemsInserted++;
        }

        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ('quotation','webxl_quotations',$1,$2,'quotations')`,
          [legacyPk, qId],
        );
        done.add(legacyPk);
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    if (rows.length < batchSize) break;
  }

  await client.query(`UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`, [
    batchId,
    migrated,
    rejected,
  ]);
  console.log(
    JSON.stringify({
      mode: "execute_staging",
      migrated,
      rejected,
      quotation_items: itemsInserted,
      quotations_total: (await client.query(`SELECT count(*)::int c FROM drm.quotations`)).rows[0].c,
    }),
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
