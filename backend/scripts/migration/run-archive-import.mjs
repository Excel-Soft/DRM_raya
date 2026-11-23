#!/usr/bin/env node
/**
 * Phase 2B archive import — drm_legacy_stage ONLY.
 * Run: cd /var/www/DRM_raya/backend && sudo -u postgres node scripts/migration/run-archive-import.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { streamInsertStatements } from "./parsers/mysql-insert-parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const DUMP = path.join(ROOT, "old_drm_database.sql");
const MANIFEST = path.join(ROOT, "docs/migration/17-preservation-manifest.csv");
const TARGET_DB = "drm_legacy_stage";
const BATCH_SIZE = 500;
const RESUME_FROM_LINE = Number(process.argv[2] || process.env.RESUME_FROM_LINE || "0");

function parseManifestCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const parts = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    parts.push(cur);
    const row = {};
    headers.forEach((h, i) => (row[h] = parts[i] ?? ""));
    return row;
  });
}

function qident(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Preserve meaning while keeping PostgreSQL TEXT valid UTF-8 (no NUL bytes). */
function sanitizeArchiveText(val) {
  if (val === null) return null;
  let s = String(val);
  if (s.includes("\0")) s = s.replace(/\0/g, "\\0");
  // Strip other invalid UTF-8 surrogates if any slipped through
  s = s.replace(/[\uD800-\uDFFF]/g, "\uFFFD");
  return s;
}

async function main() {
  const client = new pg.Client({
    host: "/var/run/postgresql",
    database: TARGET_DB,
  });
  await client.connect();
  const db = (await client.query("SELECT current_database()")).rows[0].current_database;
  if (db !== TARGET_DB) throw new Error(`Wrong database: ${db}`);

  const manifest = Object.fromEntries(
    parseManifestCsv(fs.readFileSync(MANIFEST, "utf8")).map((r) => [r.source_table, r]),
  );

  /** @type {Map<string, string[]>} */
  const colCache = new Map();
  async function dataColumns(table) {
    if (colCache.has(table)) return colCache.get(table);
    const res = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='legacy_archive' AND table_name=$1
         AND column_name NOT LIKE '\\_%' ESCAPE '\\'
       ORDER BY ordinal_position`,
      [table],
    );
    const cols = res.rows.map((r) => r.column_name);
    colCache.set(table, cols);
    return cols;
  }

  /** @type {Record<string, number>} */
  const sourceCounts = {};
  /** @type {Record<string, number>} */
  const archivedCounts = {};
  /** @type {Record<string, number>} */
  const rejectCounts = {};
  /** @type {Record<string, number>} */
  const conflictCounts = {};

  let stmts = 0;

  await streamInsertStatements(DUMP, async (lineNo, ins) => {
    if (lineNo < RESUME_FROM_LINE) return;
    stmts++;
    const table = ins.table;
    if (!manifest[table]) {
      await client.query(
        `INSERT INTO migration_meta.migration_rejects (source_table, rejection_reason, raw_record_reference)
         VALUES ($1, $2, $3)`,
        [table, "unknown_source_table", `line:${lineNo}`],
      );
      return;
    }
    const pkCol = manifest[table].source_primary_key || "id";
    const dataCols = await dataColumns(table);
    const colIndex = Object.fromEntries(ins.columns.map((c, i) => [c, i]));

    const batchRes = await client.query(
      `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status, rows_read)
       VALUES ($1, $2, 'running', $3) RETURNING batch_id`,
      [table, `legacy_archive.${table}`, ins.rows.length],
    );
    const batchId = batchRes.rows[0].batch_id;

    let batchArchived = 0;
    let batchRejected = 0;

    for (let offset = 0; offset < ins.rows.length; offset += BATCH_SIZE) {
      const slice = ins.rows.slice(offset, offset + BATCH_SIZE);
      const params = [];
      const tuples = [];
      let p = 1;

      for (const row of slice) {
        sourceCounts[table] = (sourceCounts[table] || 0) + 1;
        if (row.length !== ins.columns.length) {
          batchRejected++;
          rejectCounts[table] = (rejectCounts[table] || 0) + 1;
          continue;
        }
        const pkVal = pkCol in colIndex ? row[colIndex[pkCol]] : row[0];
        const pkText = sanitizeArchiveText(pkVal === null ? "" : String(pkVal));

        const ph = [];
        params.push(pkText, pkCol);
        ph.push(`$${p++}`, `$${p++}`);
        for (const dc of dataCols) {
          const v = dc in colIndex ? sanitizeArchiveText(row[colIndex[dc]]) : null;
          params.push(v);
          ph.push(`$${p++}`);
        }
        params.push(batchId);
        ph.push(`$${p++}`);
        tuples.push(`(${ph.join(", ")}, now())`);
      }

      if (tuples.length === 0) continue;

      const colList = ["_legacy_pk", "_legacy_pk_column", ...dataCols.map(qident), "_mig_batch_id", "_ingested_at"].join(
        ", ",
      );
      const sql = `INSERT INTO legacy_archive.${qident(table)} (${colList}) VALUES ${tuples.join(", ")}`;

      try {
        const res = await client.query(sql, params);
        batchArchived += res.rowCount ?? tuples.length;
      } catch (e) {
        if (e.code === "23505") {
          for (const row of slice) {
            const pkVal = pkCol in colIndex ? row[colIndex[pkCol]] : row[0];
            const pkText = sanitizeArchiveText(pkVal === null ? "" : String(pkVal));
            const singleParams = [pkText, pkCol];
            const singlePh = ["$1", "$2"];
            let sp = 3;
            for (const dc of dataCols) {
              singleParams.push(dc in colIndex ? sanitizeArchiveText(row[colIndex[dc]]) : null);
              singlePh.push(`$${sp++}`);
            }
            singleParams.push(batchId);
            singlePh.push(`$${sp++}`);
            const oneSql = `INSERT INTO legacy_archive.${qident(table)} (${colList}) VALUES (${singlePh.join(", ")}, now())`;
            try {
              await client.query(oneSql, singleParams);
              batchArchived++;
            } catch (e2) {
              if (e2.code === "23505") {
                conflictCounts[table] = (conflictCounts[table] || 0) + 1;
                await client.query(
                  `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, rejection_reason, raw_record_reference)
                   VALUES ($1, $2, $3, $4)`,
                  [table, pkText, "duplicate_legacy_pk", `line:${lineNo}`],
                );
              } else {
                batchRejected++;
                rejectCounts[table] = (rejectCounts[table] || 0) + 1;
                await client.query(
                  `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, rejection_reason, raw_record_reference)
                   VALUES ($1, $2, $3, $4)`,
                  [table, pkText, "insert_error", String(e2.message).slice(0, 200)],
                );
              }
            }
          }
        } else {
          throw e;
        }
      }
    }

    archivedCounts[table] = (archivedCounts[table] || 0) + batchArchived;

    await client.query(
      `UPDATE migration_meta.migration_batches SET batch_status='committed', rows_archived=$2, rows_rejected=$3, completed_at=now()
       WHERE batch_id=$1`,
      [batchId, batchArchived, batchRejected],
    );

    if (stmts % 50 === 0) {
      console.log(`progress statements=${stmts} table=${table} batchArchived=${batchArchived}`);
    }
  });

  for (const t of Object.keys(manifest)) {
    const src = sourceCounts[t] || 0;
    const ar = archivedCounts[t] || 0;
    const status = src === 0 ? "structure_only" : src === ar ? "archived" : "needs_review";
    await client.query(
      `UPDATE migration_meta.migration_table_status SET total_source_rows=$2, archived_rows=$3,
       rejected_rows=$4, validation_status=$5, updated_at=now() WHERE source_table=$1`,
      [t, src, ar, rejectCounts[t] || 0, status],
    );
  }

  const recon = [];
  for (const t of Object.keys(manifest).sort()) {
    const src = sourceCounts[t] || 0;
    const ar = archivedCounts[t] || 0;
    const failed = (rejectCounts[t] || 0) + (conflictCounts[t] || 0);
    const diff = src - ar - failed;
    recon.push({
      source_table: t,
      source_rows: src,
      archived_rows: ar,
      failed_rows: failed,
      difference: diff,
      status: src === 0 ? "STRUCTURE_ONLY" : diff === 0 && src === ar ? "OK" : "MISMATCH",
    });
  }

  const reconPath = path.join(ROOT, "docs/migration/19-archive-row-count-reconciliation.csv");
  fs.writeFileSync(
    reconPath,
    "source_table,source_rows,archived_rows,failed_rows,difference,status\n" +
      recon.map((r) => `${r.source_table},${r.source_rows},${r.archived_rows},${r.failed_rows},${r.difference},${r.status}`).join("\n") +
      "\n",
  );

  fs.writeFileSync(
    path.join(ROOT, "docs/migration/21-failed-and-unresolved-records.md"),
    `# Failed / unresolved (summary)\n\nSee migration_meta.migration_rejects for details.\n\nTotal source rows parsed: ${Object.values(sourceCounts).reduce((a, b) => a + b, 0)}\n`,
  );

  console.log("IMPORT_DONE", JSON.stringify({ sourceTotal: Object.values(sourceCounts).reduce((a, b) => a + b, 0), archivedTotal: Object.values(archivedCounts).reduce((a, b) => a + b, 0) }));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
