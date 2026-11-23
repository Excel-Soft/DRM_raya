#!/usr/bin/env node
/**
 * webxl_attendance_month -> drm.attendance_month
 * webxl_attendance_month_history -> drm.attendance_month_history
 * drm_legacy_stage ONLY. Run ddl/09_attendance_month_tables.sql first.
 *
 * Duplicate (user_id, month, year): later legacy id wins (upsert).
 */
import pg from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TARGET_DB = "drm_legacy_stage";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const onlyMonth = args.includes("--month-only");
const onlyHistory = args.includes("--history-only");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "2000");
const limit = args.find((a) => a.startsWith("--limit=")) ? Number(args.find((a) => a.startsWith("--limit=")).split("=")[1]) : null;

const JOBS = [];
if (onlyMonth && onlyHistory) {
  console.error("Use at most one of --month-only / --history-only");
  process.exit(2);
}
if (onlyMonth) {
  JOBS.push({
    source: "webxl_attendance_month",
    target: "attendance_month",
    entity: "attendance_month_row",
    withBranch: true,
    timeCols: false,
  });
} else if (onlyHistory) {
  JOBS.push({
    source: "webxl_attendance_month_history",
    target: "attendance_month_history",
    entity: "attendance_month_history_row",
    withBranch: false,
    timeCols: true,
  });
} else {
  JOBS.push(
    {
      source: "webxl_attendance_month",
      target: "attendance_month",
      entity: "attendance_month_row",
      withBranch: true,
      timeCols: false,
    },
    {
      source: "webxl_attendance_month_history",
      target: "attendance_month_history",
      entity: "attendance_month_history_row",
      withBranch: false,
      timeCols: true,
    },
  );
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function safeInt(v, fallback = 0) {
  const s = trimOrNull(v);
  if (s == null) return fallback;
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function parseTs(v) {
  const s = trimOrNull(v);
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function transform(row, ctx, job) {
  const legacyPk = String(row.id);
  if (ctx.done.has(`${job.entity}:${legacyPk}`)) return { status: "skipped", legacyPk };
  const rawUid = trimOrNull(row.user_id);
  const userId =
    rawUid && rawUid !== "0" ? (ctx.userMap.get(rawUid) ?? ctx.fallbackUser) : ctx.fallbackUser;
  if (!userId) return { status: "rejected", reason: "unmapped_user", legacyPk };
  const month = safeInt(row.month, NaN);
  let year = safeInt(row.year, NaN);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { status: "rejected", reason: "invalid_month", legacyPk };
  }
  if (!Number.isFinite(year)) {
    year = 2000;
  } else if (year < 1970 || year > 2100) {
    year = 2000;
  }
  const updatedAt = job.timeCols ? parseTs(row.last_update) : null;
  return {
    status: "valid",
    legacyPk,
    modern: {
      user_id: userId,
      late_hour: safeInt(row.lateHour, 0),
      late_min: safeInt(row.lateMin, 0),
      half_leave: safeInt(row.halfLeave, 0),
      leaves: safeInt(row.leaves, 0),
      branch: job.withBranch ? trimOrNull(row.branch) : null,
      month,
      year,
      updated_at: updatedAt,
    },
  };
}

async function ensureTables(client) {
  const ddl = fs.readFileSync(path.join(__dirname, "ddl/09_attendance_month_tables.sql"), "utf8");
  await client.query(ddl);
}

async function dryRunJob(client, job, userMap) {
  const { rows } = await client.query(`
    SELECT count(*)::bigint total,
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM migration_meta.migration_legacy_ids m
        WHERE m.entity_type='user' AND m.legacy_table='webxl_user'
          AND m.legacy_id = t.user_id::text)) unmapped_user
    FROM legacy_archive."${job.source}" t`);
  const mapped = (
    await client.query(
      `SELECT count(*)::int c FROM migration_meta.migration_legacy_ids WHERE entity_type=$1 AND legacy_table=$2`,
      [job.entity, job.source],
    )
  ).rows[0].c;
  return { job: job.source, target: job.target, ...rows[0], already_mapped: mapped, userMap: userMap.size };
}

async function executeJob(client, job, userMap) {
  const done = new Set(
    (
      await client.query(`SELECT legacy_id, entity_type FROM migration_meta.migration_legacy_ids WHERE legacy_table=$1`, [
        job.source,
      ])
    ).rows.map((r) => `${r.entity_type}:${r.legacy_id}`),
  );
  const fallbackUser = (await client.query(`SELECT id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id ?? null;
  const ctx = { userMap, done, fallbackUser };

  const batchId = (
    await client.query(`INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status) VALUES ($1,$2,'running') RETURNING batch_id`, [
      job.source,
      job.target,
    ])
  ).rows[0].batch_id;

  let migrated = 0,
    rejected = 0,
    skipped = 0,
    upserted = 0,
    lastId = -1,
    rem = limit;

  while (true) {
    const lim = rem != null ? Math.min(batchSize, rem) : batchSize;
    if (rem != null && rem <= 0) break;
    const cols = job.timeCols
      ? `id, user_id, "lateHour", "lateMin", "halfLeave", leaves, branch, month, year, last_update`
      : `id, user_id, "lateHour", "lateMin", "halfLeave", leaves, branch, month, year`;
    const { rows } = await client.query(
      `SELECT ${cols} FROM legacy_archive."${job.source}" WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;

    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const t = transform(row, ctx, job);
        if (t.status === "skipped") {
          skipped++;
          continue;
        }
        if (t.status === "rejected") {
          rejected++;
          if (rejected <= 300) {
            await client.query(
              `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason) VALUES ($1,$2,$3,$4)`,
              [job.source, t.legacyPk, job.target, t.reason],
            );
          }
          continue;
        }
        const m = t.modern;
        const now = m.updated_at ?? new Date();
        let modernId;
        if (job.withBranch) {
          const res = await client.query(
            `INSERT INTO drm.attendance_month (id, user_id, late_hour, late_min, half_leave, leaves, branch, month, year, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
             ON CONFLICT (user_id, month, year) DO UPDATE SET
               late_hour = EXCLUDED.late_hour,
               late_min = EXCLUDED.late_min,
               half_leave = EXCLUDED.half_leave,
               leaves = EXCLUDED.leaves,
               branch = COALESCE(EXCLUDED.branch, drm.attendance_month.branch),
               updated_at = EXCLUDED.updated_at
             RETURNING id, (xmax = 0) AS inserted`,
            [crypto.randomUUID(), m.user_id, m.late_hour, m.late_min, m.half_leave, m.leaves, m.branch, m.month, m.year, now],
          );
          modernId = res.rows[0].id;
          if (!res.rows[0].inserted) upserted++;
        } else {
          const res = await client.query(
            `INSERT INTO drm.attendance_month_history (id, user_id, late_hour, late_min, half_leave, leaves, month, year, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (user_id, month, year) DO UPDATE SET
               late_hour = EXCLUDED.late_hour,
               late_min = EXCLUDED.late_min,
               half_leave = EXCLUDED.half_leave,
               leaves = EXCLUDED.leaves,
               updated_at = EXCLUDED.updated_at
             RETURNING id, (xmax = 0) AS inserted`,
            [crypto.randomUUID(), m.user_id, m.late_hour, m.late_min, m.half_leave, m.leaves, m.month, m.year, now, now],
          );
          modernId = res.rows[0].id;
          if (!res.rows[0].inserted) upserted++;
        }
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (entity_type, legacy_table, legacy_id) DO NOTHING`,
          [job.entity, job.source, t.legacyPk, modernId, job.target],
        );
        ctx.done.add(`${job.entity}:${t.legacyPk}`);
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }

    if (rem != null) rem -= rows.length;
    if (rows.length < lim) break;
  }

  await client.query(`UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`, [
    batchId,
    migrated,
    rejected,
  ]);
  const total = (await client.query(`SELECT count(*)::int c FROM drm."${job.target}"`)).rows[0].c;
  return { source: job.source, target: job.target, migrated, rejected, skipped, upsert_conflicts: upserted, target_total: total, limit };
}

async function main() {
  if (!dryRun && !executeStaging) {
    console.error("Use --dry-run or --execute-staging");
    process.exit(2);
  }
  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();
  if (executeStaging) await ensureTables(client);

  const userMap = new Map(
    (await client.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='user' AND legacy_table='webxl_user'`)).rows.map(
      (r) => [String(r.legacy_id), r.modern_id],
    ),
  );

  const out = [];
  for (const job of JOBS) {
    if (dryRun) out.push(await dryRunJob(client, job, userMap));
    else out.push(await executeJob(client, job, userMap));
  }
  console.log(JSON.stringify({ mode: dryRun ? "dry_run" : "execute_staging", results: out }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
