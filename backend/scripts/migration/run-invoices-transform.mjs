#!/usr/bin/env node
/**
 * webxl_invoice -> drm.invoices (D2: webxl only)
 * drm_legacy_stage ONLY
 */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const SOURCE = "webxl_invoice";
const TARGET = "invoices";
const ENTITY = "invoice";

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

function mapStatus(row) {
  const pay = Number(row.pay ?? 0);
  const total = Number(row.grand_total ?? 0);
  if (pay > 0 && total > 0 && pay >= total * 0.99) return "Paid";
  const acc = trimOrNull(row.account)?.toLowerCase() ?? "";
  if (acc.includes("cancel")) return "Cancelled";
  if (acc.includes("sent")) return "Sent";
  return "Draft";
}

function transform(row, ctx) {
  const legacyPk = String(row.invoice_id);
  if (ctx.done.has(legacyPk)) return { status: "skipped", legacyPk };
  const createdBy = ctx.userMap.get(String(row.user_id)) ?? ctx.userMap.get(String(row.updated_by));
  if (!createdBy) return { status: "rejected", reason: "unmapped_user", legacyPk };
  const customerId = row.com_id ? ctx.customerMap.get(String(row.com_id)) ?? null : null;
  const issueDate = parseTs(row.create_date);
  if (!issueDate) return { status: "rejected", reason: "missing_issue_date", legacyPk };
  const subtotal = parseMoney(row.sub_total, "0");
  const total = parseMoney(row.grand_total, subtotal);
  const invNum = `LEG-${String(row.invoice_id).padStart(6, "0")}`;
  if (ctx.usedInv.has(invNum)) return { status: "rejected", reason: "dup_inv_num", legacyPk };
  ctx.usedInv.add(invNum);
  return {
    status: "valid",
    legacyPk,
    modern: {
      invoice_number: invNum,
      customer_id: customerId,
      customer_name: trimOrNull(row.cname) ?? `Company ${row.com_id}`,
      customer_email: trimOrNull(row.email),
      customer_address: trimOrNull(row.address),
      subtotal,
      tax: parseMoney(row.gst, "0"),
      total,
      currency: "USD",
      status: mapStatus(row),
      issue_date: issueDate,
      due_date: parseTs(row.update_date),
      paid_at: Number(row.pay) > 0 ? parseTs(row.update_date) ?? issueDate : null,
      notes: trimOrNull(row.hod_comm),
      items: "[]",
      created_by_user_id: createdBy,
      dollar_rate: parseMoney(row.doller_rate, "280"),
      created_at: issueDate,
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
  const cu = await client.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='customer' AND legacy_table='webxl_company'`);
  const userMap = new Map(u.rows.map((r) => [String(r.legacy_id), r.modern_id]));
  const customerMap = new Map(cu.rows.map((r) => [String(r.legacy_id), r.modern_id]));
  const done = new Set(
    (await client.query(`SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type=$1 AND legacy_table=$2`, [ENTITY, SOURCE])).rows.map(
      (r) => String(r.legacy_id),
    ),
  );
  const usedInv = new Set((await client.query(`SELECT invoice_number FROM drm.invoices`)).rows.map((r) => r.invoice_number));

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::int total,
        count(*) FILTER (WHERE user_id IS NULL OR NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m WHERE m.entity_type='user' AND m.legacy_table='webxl_user' AND m.legacy_id=webxl_invoice.user_id::text)) no_user
      FROM legacy_archive.webxl_invoice`);
    console.log(JSON.stringify({ mode: "dry_run", ...rows[0], already: done.size }));
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
      `SELECT invoice_id, com_id, cname, phone, email, address, user_id, sub_total, discount, grand_total, pay, gst, create_date, doller_rate, update_date, account, hod_comm, updated_by
       FROM legacy_archive.webxl_invoice WHERE invoice_id::bigint > $1 ORDER BY invoice_id::bigint LIMIT $2`,
      [lastId, batchSize],
    );
    if (!rows.length) break;
    const pending = [];
    for (const row of rows) {
      lastId = Number(row.invoice_id);
      const t = transform(row, { userMap, customerMap, done, usedInv });
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
            `INSERT INTO drm.invoices (id, invoice_number, customer_id, customer_name, customer_email, customer_address, subtotal, tax, total, currency, status, issue_date, due_date, paid_at, notes, items, created_by_user_id, dollar_rate, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19)`,
            [
              id,
              m.invoice_number,
              m.customer_id,
              m.customer_name,
              m.customer_email,
              m.customer_address,
              m.subtotal,
              m.tax,
              m.total,
              m.currency,
              m.status,
              m.issue_date,
              m.due_date,
              m.paid_at,
              m.notes,
              m.items,
              m.created_by_user_id,
              m.dollar_rate,
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
  console.log(JSON.stringify({ mode: "execute_staging", migrated, rejected, invoices_total: (await client.query(`SELECT count(*)::int c FROM drm.invoices`)).rows[0].c }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
