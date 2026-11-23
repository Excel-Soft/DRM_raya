#!/usr/bin/env node
/**
 * webxl_attendance -> drm.attendance
 * drm_legacy_stage ONLY
 */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const SOURCE = "webxl_attendance";
const TARGET = "attendance";
const ENTITY = "attendance_row";

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

function parseDateOnly(v) {
  const s = trimOrNull(v);
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function combineDateTime(dateVal, timeStr) {
  const base = parseDateOnly(dateVal);
  if (!base) return null;
  const t = trimOrNull(timeStr);
  if (!t) return base;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return base;
  const out = new Date(base);
  out.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return out;
}

function parseLateMinutes(lateAbsent) {
  const la = trimOrNull(lateAbsent);
  if (!la || la.toLowerCase() === "true") return 0;
  const m = la.match(/^(\d+):(\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function mapStatus(lateAbsent, timeIn, timeOut) {
  const la = trimOrNull(lateAbsent) ?? "";
  const low = la.toLowerCase();
  if (low === "true") return "Absent";
  if (/eid|holiday|leave|weekend|off day/i.test(la)) return "Leave";
  const tin = trimOrNull(timeIn);
  const tout = trimOrNull(timeOut);
  if (!tin && !tout) {
    if (la === "0:0" || la === "0:00") return "Absent";
    if (la && !/^\d+:\d+$/.test(la)) return "Leave";
    return "Absent";
  }
  if (parseLateMinutes(la) > 0) return "Late";
  return "Present";
}

function workingHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const h = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
  if (!Number.isFinite(h) || h < 0 || h > 24) return null;
  return h.toFixed(2);
}

function buildNotes(row) {
  const parts = [];
  if (trimOrNull(row.branch)) parts.push(`branch=${row.branch}`);
  if (trimOrNull(row.meeting)) parts.push(`meeting=${row.meeting}`);
  const la = trimOrNull(row.late_absent);
  if (la && la !== "0:0" && la !== "0:00" && la.toLowerCase() !== "true") parts.push(`late_absent=${la}`);
  return parts.length ? parts.join("; ").slice(0, 2000) : null;
}

function transform(row, ctx) {
  const legacyPk = String(row.id);
  if (ctx.done.has(legacyPk)) return { status: "skipped", legacyPk };
  const userId = ctx.userMap.get(String(row.user_id));
  if (!userId) return { status: "rejected", reason: "unmapped_user", legacyPk };
  const day = parseDateOnly(row.date);
  if (!day) return { status: "rejected", reason: "missing_date", legacyPk };
  const checkIn = combineDateTime(row.date, row.timeIn);
  const checkOut = combineDateTime(row.date, row.timeOut);
  const status = mapStatus(row.late_absent, row.timeIn, row.timeOut);
  const lateMin = parseLateMinutes(row.late_absent);
  const isLate = status === "Late" || lateMin > 0;
  return {
    status: "valid",
    legacyPk,
    modern: {
      user_id: userId,
      date: day,
      check_in: checkIn,
      check_out: checkOut,
      status,
      late_checkin: isLate,
      late_checkout: false,
      is_late: isLate,
      working_hours: workingHours(checkIn, checkOut),
      notes: buildNotes(row),
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
  const userMap = new Map(
    (await client.query(`SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='user' AND legacy_table='webxl_user'`)).rows.map(
      (r) => [String(r.legacy_id), r.modern_id],
    ),
  );
  const done = new Set(
    (await client.query(`SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type=$1 AND legacy_table=$2`, [ENTITY, SOURCE])).rows.map(
      (r) => String(r.legacy_id),
    ),
  );

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m WHERE m.entity_type='user' AND m.legacy_table='webxl_user' AND m.legacy_id=webxl_attendance.user_id::text)) unmapped_user,
        count(*) FILTER (WHERE date IS NULL) missing_date
      FROM legacy_archive.webxl_attendance`);
    console.log(JSON.stringify({ mode: "dry_run", ...rows[0], already_mapped: done.size, userMap: userMap.size }));
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
  const ctx = { userMap, done };

  while (true) {
    const lim = rem != null ? Math.min(batchSize, rem) : batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, user_id, "timeIn", "timeOut", late_absent, meeting, branch, date
       FROM legacy_archive.webxl_attendance WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
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
        if (rejected <= 200) {
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
            `INSERT INTO drm.attendance (id, user_id, date, check_in, check_out, status, late_checkin, late_checkout, is_late, working_hours, notes, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$3,$3)`,
            [
              id,
              m.user_id,
              m.date,
              m.check_in,
              m.check_out,
              m.status,
              m.late_checkin,
              m.late_checkout,
              m.is_late,
              m.working_hours,
              m.notes,
            ],
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
    if (migrated && migrated % 50000 === 0) console.log(JSON.stringify({ progress: migrated, rejected, lastId }));
    if (rows.length < lim) break;
  }

  await client.query(`UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`, [
    batchId,
    migrated,
    rejected,
  ]);
  const total = (await client.query(`SELECT count(*)::int c FROM drm.attendance`)).rows[0].c;
  console.log(JSON.stringify({ mode: "execute_staging", migrated, rejected, skipped, attendance_total: total, limit }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
