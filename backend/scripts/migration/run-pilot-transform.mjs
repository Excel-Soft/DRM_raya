#!/usr/bin/env node
/**
 * Phase 2C pilot: legacy_archive.webxl_vas_comm_final -> drm.webxl_vas_comm_final
 * Database: drm_legacy_stage ONLY
 * Usage: sudo -u postgres node scripts/migration/run-pilot-transform.mjs [--batch-size=50] [--limit=50]
 */
import pg from "pg";

const TARGET_DB = "drm_legacy_stage";
const SOURCE_TABLE = "webxl_vas_comm_final";
const TARGET_TABLE = "webxl_vas_comm_final";
const ENTITY_TYPE = "webxl_vas_comm_final_row";

const args = process.argv.slice(2);
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "50");
const limit = args.find((a) => a.startsWith("--limit=")) ? Number(args.find((a) => a.startsWith("--limit=")).split("=")[1]) : null;

const COL_MAP = [
  ["id", "id", "int"],
  ["user_id", "user_id", "int"],
  ["manager_approve", "manager_approve", "text"],
  ["hod_status", "hod_status", "text"],
  ["user_status", "user_status", "text"],
  ["account_pay_status", "account_pay_status", "text"],
  ["account_pay_date", "account_pay_date", "timestamp"],
  ["comm_year", "comm_year", "text"],
  ["comm_month", "comm_month", "text"],
  ["comm_type", "comm_type", "text"],
  ["per", "per", "text"],
  ["comm", "comm", "decimal"],
  ["reward", "reward", "decimal"],
  ["team_reward", "team_reward", "decimal"],
  ["final_pay_amount", "final_pay_amount", "decimal"],
  ["manager_approve_date", "manager_approve_date", "timestamp"],
  ["hod_satatus_date", "hod_satatus_date", "timestamp"],
];

function parseIntStrict(v) {
  if (v === null || v === "") return null;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) return { error: "invalid_int" };
  return Math.trunc(n);
}

function parseDecimal(v) {
  if (v === null || v === "") return null;
  const s = String(v).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { error: "invalid_decimal" };
  return s;
}

function parseTimestamp(v) {
  if (v === null || v === "") return null;
  const s = String(v).trim();
  if (s.startsWith("0000-00-00")) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return { error: "invalid_timestamp" };
  return d.toISOString();
}

function transform(col, kind, raw) {
  if (kind === "int") return parseIntStrict(raw);
  if (kind === "decimal") return parseDecimal(raw);
  if (kind === "timestamp") return parseTimestamp(raw);
  return raw === null || raw === "" ? null : String(raw);
}

async function main() {
  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();
  const db = (await client.query("SELECT current_database()")).rows[0].current_database;
  if (db !== TARGET_DB) throw new Error(`Wrong DB: ${db}`);

  const archiveBefore = Number(
    (await client.query(`SELECT count(*)::int AS c FROM legacy_archive."${SOURCE_TABLE}"`)).rows[0].c,
  );

  const batchRes = await client.query(
    `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status)
     VALUES ($1, $2, 'running') RETURNING batch_id`,
    [SOURCE_TABLE, `drm.${TARGET_TABLE}`],
  );
  const batchId = batchRes.rows[0].batch_id;

  const pending = await client.query(
    `SELECT a.* FROM legacy_archive."${SOURCE_TABLE}" a
     LEFT JOIN migration_meta.migration_legacy_ids m
       ON m.entity_type = $1 AND m.legacy_table = $2 AND m.legacy_id = a._legacy_pk
     WHERE m.legacy_id IS NULL
     ORDER BY a._archive_row_id
     ${limit ? `LIMIT ${limit}` : ""}`,
    [ENTITY_TYPE, SOURCE_TABLE],
  );

  let migrated = 0;
  let rejected = 0;

  for (let i = 0; i < pending.rows.length; i += batchSize) {
    const slice = pending.rows.slice(i, i + batchSize);
    await client.query("BEGIN");
    try {
      for (const row of slice) {
        const legacyPk = row._legacy_pk;
        const values = {};
        let err = null;
        for (const [src, tgt, kind] of COL_MAP) {
          const t = transform(tgt, kind, row[src]);
          if (t && typeof t === "object" && t.error) {
            err = `${tgt}:${t.error}`;
            break;
          }
          values[tgt] = t;
        }
        if (err || values.id === null || values.user_id === null) {
          rejected++;
          await client.query(
            `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason, raw_record_reference)
             VALUES ($1, $2, $3, $4, $5)`,
            [SOURCE_TABLE, legacyPk, TARGET_TABLE, err || "missing_required_id", `batch:${batchId}`],
          );
          await client.query(
            `INSERT INTO migration_meta.migration_record_state (source_table, legacy_pk, state, archive_table, batch_id)
             VALUES ($1, $2, 'TRANSFORMATION_REJECTED', $3, $4)
             ON CONFLICT (source_table, legacy_pk) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
            [SOURCE_TABLE, legacyPk, `legacy_archive.${SOURCE_TABLE}`, batchId],
          );
          continue;
        }

        const cols = Object.keys(values);
        const params = cols.map((c) => values[c]);
        const ph = cols.map((_, idx) => `$${idx + 1}`).join(", ");
        const exists = await client.query(`SELECT 1 FROM drm."${TARGET_TABLE}" WHERE id = $1`, [values.id]);
        if (exists.rowCount) {
          rejected++;
          await client.query(
            `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason, raw_record_reference)
             VALUES ($1, $2, $3, 'duplicate_modern_id', $4)`,
            [SOURCE_TABLE, legacyPk, TARGET_TABLE, `batch:${batchId}`],
          );
          continue;
        }

        await client.query(
          `INSERT INTO drm."${TARGET_TABLE}" (${cols.map((c) => `"${c}"`).join(", ")}) OVERRIDING SYSTEM VALUE VALUES (${ph})`,
          params,
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
           VALUES ($1, $2, $3, $4, $5)`,
          [ENTITY_TYPE, SOURCE_TABLE, legacyPk, String(values.id), TARGET_TABLE],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_record_state (source_table, legacy_pk, state, archive_table, modern_table, modern_id, batch_id)
           VALUES ($1, $2, 'TRANSFORMED_SUCCESSFULLY', $3, $4, $5, $6)
           ON CONFLICT (source_table, legacy_pk) DO UPDATE SET state = EXCLUDED.state, modern_id = EXCLUDED.modern_id, updated_at = now()`,
          [SOURCE_TABLE, legacyPk, `legacy_archive.${SOURCE_TABLE}`, TARGET_TABLE, String(values.id), batchId],
        );
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }

  const archiveAfter = Number(
    (await client.query(`SELECT count(*)::int AS c FROM legacy_archive."${SOURCE_TABLE}"`)).rows[0].c,
  );

  await client.query(
    `UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`,
    [batchId, migrated, rejected],
  );

  console.log(
    JSON.stringify({
      pilot: SOURCE_TABLE,
      selected: pending.rows.length,
      migrated,
      rejected,
      archiveBefore,
      archiveAfter,
      archiveImmutable: archiveBefore === archiveAfter,
      batchId,
    }),
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
