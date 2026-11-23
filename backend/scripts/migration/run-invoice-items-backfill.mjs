#!/usr/bin/env node
/** 3A: legacy_archive.webxl_invoice_item -> drm.invoices.items JSON */
import pg from "pg";

const TARGET_DB = "drm_legacy_stage";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");

function money(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  if (!dryRun && !executeStaging) {
    console.error("Use --dry-run or --execute-staging");
    process.exit(2);
  }
  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();

  const { rows: items } = await client.query(`
    SELECT i.invoice_id, i.item, i.detail, i.unit_price, i.qty, i."totalPkr", i.pkr
    FROM legacy_archive.webxl_invoice_item i
    WHERE EXISTS (
      SELECT 1 FROM migration_meta.migration_legacy_ids m
      WHERE m.entity_type = 'invoice' AND m.legacy_table = 'webxl_invoice'
        AND m.legacy_id = i.invoice_id::text
    )
    ORDER BY i.invoice_id::bigint, i.id::bigint
  `);

  const byLegacy = new Map();
  for (const r of items) {
    const k = String(r.invoice_id);
    if (!byLegacy.has(k)) byLegacy.set(k, []);
    const qty = Math.max(1, Math.trunc(money(r.qty) || 1));
    const unit = money(r.unit_price);
    byLegacy.get(k).push({
      name: String(r.item ?? "Item").slice(0, 500),
      description: r.detail ? String(r.detail).slice(0, 4000) : "",
      unitPrice: unit,
      quantity: qty,
      total: money(r.totalpkr) || money(r.pkr) || unit * qty,
    });
  }

  const maps = await client.query(
    `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids
     WHERE entity_type='invoice' AND legacy_table='webxl_invoice'`,
  );
  const invMap = new Map(maps.rows.map((r) => [String(r.legacy_id), r.modern_id]));

  let updatable = 0;
  for (const legacyId of byLegacy.keys()) {
    if (invMap.has(legacyId)) updatable++;
  }

  if (dryRun) {
    console.log(
      JSON.stringify({
        mode: "dry_run",
        item_rows: items.length,
        legacy_invoices_with_lines: byLegacy.size,
        updatable_invoices: updatable,
      }),
    );
    await client.end();
    return;
  }

  let updated = 0;
  let skipped = 0;
  await client.query("BEGIN");
  try {
    for (const [legacyId, lineItems] of byLegacy) {
      const modernId = invMap.get(legacyId);
      if (!modernId) {
        skipped++;
        continue;
      }
      await client.query(`UPDATE drm.invoices SET items = $1, updated_at = now() WHERE id = $2`, [
        JSON.stringify(lineItems),
        modernId,
      ]);
      updated++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }

  const withItems = (
    await client.query(`SELECT count(*)::int c FROM drm.invoices WHERE items <> '[]' AND items IS NOT NULL`)
  ).rows[0].c;
  console.log(JSON.stringify({ mode: "execute_staging", updated, skipped, invoices_with_items: withItems }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
