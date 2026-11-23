#!/usr/bin/env node
/** 3C: webxl_payments -> drm.ledger_entries (invoice-linked) */
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

function money(v) {
  if (v == null || v === "") return null;
  const s = String(v).replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return s;
}

function parseTs(v) {
  const s = trimOrNull(v);
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  if (!dryRun && !executeStaging) {
    console.error("Use --dry-run or --execute-staging");
    process.exit(2);
  }
  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();

  const invMap = new Map(
    (await client.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='invoice' AND legacy_table='webxl_invoice'`)).rows.map(
      (r) => [String(r.legacy_id), r.modern_id],
    ),
  );
  const invCreator = new Map(
    (await client.query(`SELECT m.legacy_id, i.created_by_user_id FROM migration_meta.migration_legacy_ids m JOIN drm.invoices i ON i.id::text = m.modern_id WHERE m.entity_type='invoice'`)).rows.map(
      (r) => [String(r.legacy_id), r.created_by_user_id],
    ),
  );
  const fallbackUser = (await client.query(`SELECT id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
  const done = new Set(
    (await client.query(`SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type='payment' AND legacy_table='webxl_payments'`)).rows.map(
      (r) => String(r.legacy_id),
    ),
  );

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::int total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m WHERE m.entity_type='invoice' AND m.legacy_table='webxl_invoice' AND m.legacy_id=webxl_payments.invoice_id::text)) no_invoice
      FROM legacy_archive.webxl_payments`);
    console.log(JSON.stringify({ mode: "dry_run", ...rows[0], already: done.size }));
    await client.end();
    return;
  }

  const batchId = (
    await client.query(`INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status) VALUES ('webxl_payments','ledger_entries','running') RETURNING batch_id`)
  ).rows[0].batch_id;

  let migrated = 0,
    rejected = 0,
    lastId = -1;

  while (true) {
    const { rows } = await client.query(
      `SELECT id, invoice_id, com_id, amount, receipt_number, method, status, create_date
       FROM legacy_archive.webxl_payments WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, batchSize],
    );
    if (!rows.length) break;

    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) continue;
        let amt = money(row.amount);
        if (amt == null) {
          rejected++;
          continue;
        }
        if (Number(amt) < 0) amt = "0";
        const invLegacy = trimOrNull(row.invoice_id);
        const refId = invLegacy ? invMap.get(invLegacy) ?? null : null;
        const createdBy = (invLegacy && invCreator.get(invLegacy)) ?? fallbackUser;
        if (!createdBy) {
          rejected++;
          continue;
        }
        const dt = parseTs(row.create_date) ?? new Date();
        const method = trimOrNull(row.method) ?? "cash";
        const receipt = trimOrNull(row.receipt_number);
        const desc = `Legacy payment${invLegacy ? ` inv ${invLegacy}` : ""}${receipt ? ` receipt ${receipt}` : ""} (${method})`.slice(
          0,
          500,
        );
        const id = crypto.randomUUID();
        const refType = refId ? "invoice" : null;

        await client.query(
          `INSERT INTO drm.ledger_entries (
            id, entry_type, amount, currency, description, category, date, entry_date,
            reference_id, reference_type, created_by_user_id, status, remarks, created_at
          ) VALUES ($1,'Credit',$2,'USD',$3,'Invoice',$4,$4,$5,$6,$7,'Posted',$8,$4)`,
          [id, amt, desc, dt, refId, refType, createdBy, `legacy_payment_id=${legacyPk}`],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ('payment','webxl_payments',$1,$2,'ledger_entries')`,
          [legacyPk, id],
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
      ledger_total: (await client.query(`SELECT count(*)::int c FROM drm.ledger_entries`)).rows[0].c,
    }),
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
