#!/usr/bin/env node
/** Wave 8 — unmapped archive tables (low row count) → drm.legacy_archive_payload */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  connect,
  parseArgs,
  trimOrNull,
  loadDoneSet,
  startBatch,
  finishBatch,
  rejectRow,
} from "./migration-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = "legacy_archive_payload";
const ENTITY = "legacy_payload_row";

/** Parallel MySQL domain — business: do not ETL */
const SKIP_TABLE_PREFIXES = ["tbl_"];

function isSkippedTable(name) {
  return SKIP_TABLE_PREFIXES.some((p) => name.startsWith(p));
}

function parseWave8Args(argv) {
  const opts = parseArgs(argv);
  opts.maxRows = Number(argv.find((a) => a.startsWith("--max-rows="))?.split("=")[1] || "1000");
  return opts;
}

function assertTableName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`invalid table name: ${name}`);
  if (isSkippedTable(name)) throw new Error(`table excluded from migration: ${name}`);
}

async function ensureDdl(client) {
  await client.query(fs.readFileSync(path.join(__dirname, "ddl/13_wave8_legacy_payload.sql"), "utf8"));
}

async function listSmallUnmappedTables(client, maxRows) {
  const { rows } = await client.query(
    `SELECT t.tablename AS name, pg_stat.n_live_tup::bigint AS est
     FROM pg_tables t
     JOIN pg_stat_user_tables pg_stat ON pg_stat.relname = t.tablename AND pg_stat.schemaname = 'legacy_archive'
     LEFT JOIN (
       SELECT legacy_table, count(*)::bigint c FROM migration_meta.migration_legacy_ids GROUP BY 1
     ) m ON m.legacy_table = t.tablename
     WHERE t.schemaname = 'legacy_archive'
       AND t.tablename NOT LIKE 'tbl\\_%'
       AND COALESCE(m.c, 0) = 0
       AND pg_stat.n_live_tup > 0
       AND pg_stat.n_live_tup <= $1
     ORDER BY pg_stat.n_live_tup DESC, t.tablename`,
    [maxRows],
  );
  return rows.map((r) => r.name).filter((n) => !isSkippedTable(n));
}

async function tableHasId(client, table) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'legacy_archive' AND table_name = $1 AND column_name = 'id'
     ) AS has_id`,
    [table],
  );
  return rows[0].has_id;
}

function rowToPayload(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "_cursor_id" || k === "legacy_pk") continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

async function migrateTable(client, opts, source) {
  assertTableName(source);
  opts.module = source;
  const done = await loadDoneSet(client, ENTITY, source);
  const hasId = await tableHasId(client, source);
  const qname = `legacy_archive."${source}"`;
  const drySql = `SELECT count(*)::bigint AS total FROM ${qname}`;

  if (opts.dryRun) {
    const { rows } = await client.query(drySql);
    return { module: source, ...rows[0], already_mapped: done.size, cursor: hasId ? "id" : "_archive_row_id" };
  }

  const selectSql = hasId
    ? `SELECT *, id::bigint AS _cursor_id, COALESCE(NULLIF(trim(_legacy_pk), ''), id::text) AS legacy_pk
       FROM ${qname} WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`
  : `SELECT *, _archive_row_id::bigint AS _cursor_id, _legacy_pk AS legacy_pk
       FROM ${qname} WHERE _archive_row_id > $1 ORDER BY _archive_row_id LIMIT $2`;

  const batchId = await startBatch(client, source, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1;

  while (true) {
    const { rows } = await client.query(selectSql, [lastId, opts.batchSize]);
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row._cursor_id);
        const legacyPk = trimOrNull(row.legacy_pk) ?? String(lastId);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const payload = rowToPayload(row);
        if (!Object.keys(payload).length) {
          rejected++;
          await rejectRow(client, source, TARGET, legacyPk, "empty_row", 50, { rejected });
          continue;
        }
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_archive_payload (id, source_table, legacy_pk, payload) VALUES ($1,$2,$3,$4::jsonb)`,
          [id, source, legacyPk, JSON.stringify(payload)],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
           VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, source, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    if (rows.length < opts.batchSize) break;
  }
  await finishBatch(client, batchId, migrated, rejected);
  return { module: source, migrated, rejected, skipped };
}

async function main() {
  const opts = parseWave8Args(process.argv);
  if (!opts.module) {
    console.error("--module=<table_name|all> required");
    process.exit(2);
  }
  if (!opts.dryRun && !opts.executeStaging) {
    console.error("Use --dry-run or --execute-staging");
    process.exit(2);
  }
  const client = await connect();
  if (opts.executeStaging) await ensureDdl(client);

  let results;
  if (opts.module === "all") {
    const tables = await listSmallUnmappedTables(client, opts.maxRows);
    results = [];
    for (const t of tables) {
      results.push(await migrateTable(client, opts, t));
    }
  } else {
    assertTableName(opts.module);
    results = [await migrateTable(client, opts, opts.module)];
  }

  console.log(
    JSON.stringify({
      mode: opts.dryRun ? "dry_run" : "execute_staging",
      max_rows: opts.maxRows,
      modules: results.length,
      total_migrated: results.reduce((a, r) => a + (r.migrated ?? 0), 0),
      total_rejected: results.reduce((a, r) => a + (r.rejected ?? 0), 0),
      total_skipped: results.reduce((a, r) => a + (r.skipped ?? 0), 0),
      results,
    }),
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
