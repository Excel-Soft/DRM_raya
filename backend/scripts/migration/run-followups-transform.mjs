#!/usr/bin/env node
/**
 * webxl_followup -> drm.follow_ups
 * Database: drm_legacy_stage ONLY — users + customers transforms first.
 *
 * Usage:
 *   node run-followups-transform.mjs --dry-run [--limit=10000]
 *   node run-followups-transform.mjs --execute-staging [--batch-size=3000] [--limit=N]
 */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const SOURCE_TABLE = "webxl_followup";
const TARGET_TABLE = "follow_ups";
const ENTITY_TYPE = "followup";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "3000");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseTs(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapUserId(raw, userMap) {
  const s = trimOrNull(raw);
  if (!s || s === "0") return null;
  return userMap.get(s) ?? null;
}

function buildNotes(row) {
  const note = trimOrNull(row.note);
  const answer = trimOrNull(row.answer);
  if (note && answer) return `${note}\n${answer}`.slice(0, 8000);
  return (note ?? answer)?.slice(0, 8000) ?? null;
}

function transformRow(row, ctx) {
  const legacyPk = String(row.id ?? row._legacy_pk ?? "");
  if (ctx.existingLegacy.has(legacyPk)) {
    return { status: "skipped", reason: "already_migrated", legacyPk };
  }
  const comLegacy = trimOrNull(row.com_id);
  if (!comLegacy) {
    return { status: "rejected", reason: "missing_com_id", legacyPk };
  }
  const customerId = ctx.customerMap.get(comLegacy);
  if (!customerId) {
    return { status: "rejected", reason: "unmapped_customer", legacyPk, comLegacy };
  }

  const dueAt = parseTs(row.nc) ?? parseTs(row.create_date);
  if (!dueAt) {
    return { status: "rejected", reason: "missing_due_at", legacyPk };
  }
  const dateTime = parseTs(row.create_date) ?? dueAt;
  const userUuid = mapUserId(row.uid, ctx.userMap);
  const tk = Number(row.tk_mint ?? 0);
  let talkSeconds = 0;
  if (Number.isFinite(tk) && tk >= 0 && tk <= 50000) {
    talkSeconds = Math.trunc(tk * 60);
    if (talkSeconds > 2147483647) talkSeconds = 2147483647;
  }

  return {
    status: "valid",
    legacyPk,
    modern: {
      customer_id: customerId,
      assigned_to: userUuid,
      created_by: userUuid,
      due_at: dueAt,
      status: "Open",
      notes: buildNotes(row),
      method: trimOrNull(row.cm)?.slice(0, 200) ?? null,
      reservation_type:
        trimOrNull(row.ncm)?.slice(0, 200) ?? trimOrNull(row.purpose_call)?.slice(0, 200) ?? null,
      talk_time_seconds: talkSeconds,
      date_time: dateTime,
      created_at: dateTime,
      is_deleted: false,
    },
  };
}

const SELECT_COLS = `
  id, com_id, uid, purpose_call, cm, nc, ncm, answer, note, tk_mint, create_date, _legacy_pk
`;

async function loadMaps(client) {
  const users = await client.query(
    `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids
     WHERE entity_type = 'user' AND legacy_table = 'webxl_user'`,
  );
  const customers = await client.query(
    `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids
     WHERE entity_type = 'customer' AND legacy_table = 'webxl_company'`,
  );
  return {
    userMap: new Map(users.rows.map((r) => [String(r.legacy_id), r.modern_id])),
    customerMap: new Map(customers.rows.map((r) => [String(r.legacy_id), r.modern_id])),
  };
}

async function loadExistingLegacy(client) {
  const { rows } = await client.query(
    `SELECT legacy_id FROM migration_meta.migration_legacy_ids
     WHERE entity_type = $1 AND legacy_table = $2`,
    [ENTITY_TYPE, SOURCE_TABLE],
  );
  return new Set(rows.map((r) => String(r.legacy_id)));
}

async function dryRunCounts(client) {
  const { rows } = await client.query(`
    SELECT
      count(*)::bigint AS total,
      count(*) FILTER (WHERE trim(coalesce(com_id::text,'')) = '')::bigint AS missing_com,
      count(*) FILTER (
        WHERE trim(coalesce(com_id::text,'')) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM migration_meta.migration_legacy_ids m
          WHERE m.entity_type = 'customer' AND m.legacy_table = 'webxl_company'
            AND m.legacy_id = webxl_followup.com_id::text
        )
      )::bigint AS unmapped_customer,
      count(*) FILTER (
        WHERE trim(coalesce(com_id::text,'')) <> ''
        AND EXISTS (
          SELECT 1 FROM migration_meta.migration_legacy_ids m
          WHERE m.entity_type = 'customer' AND m.legacy_table = 'webxl_company'
            AND m.legacy_id = webxl_followup.com_id::text
        )
        AND nc IS NULL AND create_date IS NULL
      )::bigint AS missing_dates
    FROM legacy_archive.webxl_followup
  `);
  return rows[0];
}

async function executeStagingRun(client, maps) {
  const existingLegacy = await loadExistingLegacy(client);
  const ctx = { ...maps, existingLegacy };

  const archiveBefore = Number(
    (await client.query(`SELECT count(*)::int AS c FROM legacy_archive."${SOURCE_TABLE}"`)).rows[0].c,
  );

  const batchRes = await client.query(
    `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status)
     VALUES ($1, $2, 'running') RETURNING batch_id`,
    [SOURCE_TABLE, TARGET_TABLE],
  );
  const batchId = batchRes.rows[0].batch_id;

  let migrated = 0;
  let rejected = 0;
  let skipped = 0;
  let lastId = -1;
  let remaining = limit;

  while (true) {
    const fetchLimit = remaining != null ? Math.min(batchSize, remaining) : batchSize;
    if (remaining != null && remaining <= 0) break;

    const { rows } = await client.query(
      `SELECT ${SELECT_COLS}
       FROM legacy_archive.webxl_followup
       WHERE id::bigint > $1
       ORDER BY id::bigint
       LIMIT $2`,
      [lastId, fetchLimit],
    );
    if (rows.length === 0) break;

    const pending = [];
    for (const row of rows) {
      lastId = Number(row.id);
      const t = transformRow(row, ctx);
      if (t.status === "skipped") {
        skipped += 1;
        continue;
      }
      if (t.status === "rejected") {
        rejected += 1;
        if (rejected <= 500) {
          await client.query(
            `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason)
             VALUES ($1,$2,$3,$4)`,
            [SOURCE_TABLE, t.legacyPk, TARGET_TABLE, t.reason],
          );
        }
        continue;
      }
      pending.push(t);
    }

    if (pending.length > 0) {
      await client.query("BEGIN");
      try {
        for (const t of pending) {
          const m = t.modern;
          const modernId = crypto.randomUUID();
          await client.query(
            `INSERT INTO drm.follow_ups (
              id, customer_id, assigned_to, created_by, due_at, status, notes, method,
              reservation_type, talk_time_seconds, date_time, created_at, updated_at, is_deleted
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,false)`,
            [
              modernId,
              m.customer_id,
              m.assigned_to,
              m.created_by,
              m.due_at,
              m.status,
              m.notes,
              m.method,
              m.reservation_type,
              m.talk_time_seconds,
              m.date_time,
              m.created_at,
            ],
          );
          await client.query(
            `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
             VALUES ($1,$2,$3,$4,$5)`,
            [ENTITY_TYPE, SOURCE_TABLE, t.legacyPk, modernId, TARGET_TABLE],
          );
          await client.query(
            `INSERT INTO migration_meta.migration_record_state (source_table, legacy_pk, state, archive_table, modern_table, modern_id, batch_id)
             VALUES ($1,$2,'TRANSFORMED_SUCCESSFULLY',$3,$4,$5,$6)
             ON CONFLICT (source_table, legacy_pk) DO UPDATE SET state = EXCLUDED.state, modern_id = EXCLUDED.modern_id, updated_at = now()`,
            [SOURCE_TABLE, t.legacyPk, `legacy_archive.${SOURCE_TABLE}`, TARGET_TABLE, modernId, batchId],
          );
          ctx.existingLegacy.add(t.legacyPk);
          migrated += 1;
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }

    if (remaining != null) remaining -= rows.length;
    if (migrated > 0 && migrated % 30000 === 0) {
      console.log(JSON.stringify({ progress: true, migrated, rejected, skipped, lastId }));
    }
    if (rows.length < fetchLimit) break;
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
      mode: "execute_staging",
      database: TARGET_DB,
      batchId,
      limit,
      migrated,
      rejected,
      skipped,
      archiveImmutable: archiveBefore === archiveAfter,
      followUpsCount: (await client.query(`SELECT count(*)::int AS c FROM drm.follow_ups`)).rows[0].c,
    }),
  );
}

async function main() {
  if (!dryRun && !executeStaging) {
    console.error("Specify --dry-run or --execute-staging");
    process.exit(2);
  }
  if (dryRun && executeStaging) {
    console.error("Use only one of --dry-run or --execute-staging");
    process.exit(2);
  }

  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();

  const maps = await loadMaps(client);
  if (maps.userMap.size === 0 || maps.customerMap.size === 0) {
    console.error("Missing user/customer maps — run users + customers transforms first");
    process.exit(2);
  }

  if (executeStaging) {
    await executeStagingRun(client, maps);
    await client.end();
    return;
  }

  await client.query("BEGIN READ ONLY");
  const counts = await dryRunCounts(client);
  const existingLegacy = await loadExistingLegacy(client);
  let sampleValid = 0;
  let sampleRejected = 0;
  if (limit != null) {
    const { rows } = await client.query(
      `SELECT ${SELECT_COLS} FROM legacy_archive.webxl_followup ORDER BY id::bigint LIMIT $1`,
      [limit],
    );
    const ctx = { ...maps, existingLegacy };
    for (const row of rows) {
      const t = transformRow(row, ctx);
      if (t.status === "valid") sampleValid += 1;
      else if (t.status === "rejected") sampleRejected += 1;
    }
  }
  await client.query("ROLLBACK");
  await client.end();

  const estValid =
    Number(counts.total) -
    Number(counts.missing_com) -
    Number(counts.unmapped_customer) -
    Number(counts.missing_dates);

  console.log(
    JSON.stringify({
      mode: "dry_run",
      database: TARGET_DB,
      database_writes: false,
      archiveRows: Number(counts.total),
      missing_com_id: Number(counts.missing_com),
      unmapped_customer: Number(counts.unmapped_customer),
      missing_due_at: Number(counts.missing_dates),
      estimated_valid: estValid,
      already_mapped: existingLegacy.size,
      userMapSize: maps.userMap.size,
      customerMapSize: maps.customerMap.size,
      sampleLimit: limit,
      sampleValid,
      sampleRejected,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
