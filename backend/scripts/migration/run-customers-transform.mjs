#!/usr/bin/env node
/**
 * webxl_company -> drm.customers (D1: webxl_company only)
 * Database: drm_legacy_stage ONLY — run users transform first.
 *
 * Usage:
 *   node run-customers-transform.mjs --dry-run [--limit=1000]
 *   node run-customers-transform.mjs --execute-staging [--batch-size=1000] [--limit=5000]
 */
import pg from "pg";
import crypto from "crypto";

const TARGET_DB = "drm_legacy_stage";
const SOURCE_TABLE = "webxl_company";
const TARGET_TABLE = "customers";
const ENTITY_TYPE = "customer";
const USER_ENTITY = "user";
const USER_SOURCE = "webxl_user";

const POOL_REGION_CODES = new Set(["FM", "GS", "GM", "HI", "AK"]);
const VALID_GRADES = new Set(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "1000");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function mapStatus(raw) {
  const t = (trimOrNull(raw) ?? "").toLowerCase();
  if (t.includes("old") || t === "active") return "Renew";
  if (t.includes("expir")) return "Expire";
  return "New";
}

function mapGrade(raw) {
  const g = trimOrNull(raw);
  if (g && VALID_GRADES.has(g)) return g;
  return "C";
}

function mapRegion(country, abAccount) {
  const ab = trimOrNull(abAccount);
  if (ab && POOL_REGION_CODES.has(ab.toUpperCase())) return ab.toUpperCase();
  const c = trimOrNull(country);
  if (c) return c.slice(0, 200);
  return "Other";
}

function syntheticEmail(legacyId) {
  return `legacy-${legacyId}@drm.migrated.local`;
}

function mapUserId(legacyUserId, userMap) {
  const s = trimOrNull(legacyUserId);
  if (!s || s === "0") return null;
  return userMap.get(s) ?? null;
}

/**
 * @param {object} row
 * @param {{ userMap: Map<string,string>, seenComId: Set<string>, existingLegacy: Set<string> }} ctx
 */
function transformRow(row, ctx) {
  const legacyPk = String(row.id ?? row._legacy_pk ?? "");
  if (ctx.existingLegacy.has(legacyPk)) {
    return { status: "skipped", reason: "already_migrated", legacyPk };
  }
  const comId = trimOrNull(row.com_id);
  if (!comId) {
    return { status: "rejected", reason: "missing_com_id", legacyPk };
  }
  if (ctx.seenComId.has(comId.toLowerCase())) {
    return { status: "rejected", reason: "duplicate_com_id", legacyPk, comId };
  }
  ctx.seenComId.add(comId.toLowerCase());

  const companyName = trimOrNull(row.cname) ?? comId;
  const contact = trimOrNull(row.contact);
  const accountName = contact ?? companyName;
  const phone = contact ?? "0000000000";

  return {
    status: "valid",
    legacyPk,
    modern: {
      company_name: companyName.slice(0, 500),
      account_name: accountName.slice(0, 500),
      email: syntheticEmail(legacyPk),
      phone: phone.slice(0, 100),
      region: mapRegion(row.country, row.abAccount),
      grade: mapGrade(row.grade),
      status: mapStatus(row.status),
      ntn: trimOrNull(row.ntn),
      country: trimOrNull(row.country),
      city: trimOrNull(row.city),
      address: trimOrNull(row.address),
      crm_id: trimOrNull(row.crm_id),
      crm_date: row.crm_date,
      company_type: trimOrNull(row.comType),
      website: trimOrNull(row.website),
      comment: trimOrNull(row.comment),
      rc_link: trimOrNull(row.rcLink),
      source: trimOrNull(row.source),
      drm_id: comId,
      owner_user_id: mapUserId(row.assignId, ctx.userMap),
      created_by: mapUserId(row.created_by, ctx.userMap),
      is_deleted: trimOrNull(row.disable)?.toLowerCase() === "yes",
      ab_type: trimOrNull(row.abAccount),
      create_date: row.create_date,
      update_at: row.update_at,
    },
  };
}

function parseTs(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

const CUSTOMER_SQL = `
SELECT
  id, com_id, cname, contact, "abAccount", country, city, address, "comType", website, ntn,
  "rcLink", source, status, grade, comment, "assignId", crm_id, crm_date, disable, created_by,
  create_date, update_at, _legacy_pk
FROM legacy_archive.webxl_company
ORDER BY id::bigint
${limit != null ? `LIMIT ${Number(limit)}` : ""}
`;

async function loadUserMap(client) {
  const { rows } = await client.query(
    `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids
     WHERE entity_type = $1 AND legacy_table = $2`,
    [USER_ENTITY, USER_SOURCE],
  );
  const map = new Map(rows.map((r) => [String(r.legacy_id), r.modern_id]));
  return map;
}

async function loadExistingCustomerLegacy(client) {
  const { rows } = await client.query(
    `SELECT legacy_id FROM migration_meta.migration_legacy_ids
     WHERE entity_type = $1 AND legacy_table = $2`,
    [ENTITY_TYPE, SOURCE_TABLE],
  );
  return new Set(rows.map((r) => String(r.legacy_id)));
}

async function executeStagingRun(client, rows, userMap) {
  const existingLegacy = await loadExistingCustomerLegacy(client);
  const seenComId = new Set(
    (await client.query(`SELECT lower(drm_id) AS d FROM drm.customers WHERE drm_id IS NOT NULL`)).rows.map((r) => r.d),
  );

  const archiveBefore = Number(
    (await client.query(`SELECT count(*)::int AS c FROM legacy_archive."${SOURCE_TABLE}"`)).rows[0].c,
  );

  const batchRes = await client.query(
    `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status)
     VALUES ($1, $2, 'running') RETURNING batch_id`,
    [SOURCE_TABLE, TARGET_TABLE],
  );
  const batchId = batchRes.rows[0].batch_id;

  const ctx = { userMap, seenComId, existingLegacy };
  const pending = [];
  let rejected = 0;
  let skipped = 0;

  for (const row of rows) {
    const t = transformRow(row, ctx);
    if (t.status === "skipped") {
      skipped += 1;
      continue;
    }
    if (t.status === "rejected") {
      rejected += 1;
      await client.query(
        `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason, raw_record_reference)
         VALUES ($1,$2,$3,$4,$5)`,
        [SOURCE_TABLE, t.legacyPk, TARGET_TABLE, t.reason, t.comId ?? null],
      );
      continue;
    }
    pending.push(t);
  }

  let migrated = 0;
  for (let i = 0; i < pending.length; i += batchSize) {
    const slice = pending.slice(i, i + batchSize);
    await client.query("BEGIN");
    try {
      for (const t of slice) {
        const m = t.modern;
        const modernId = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.customers (
            id, company_name, account_name, email, phone, region, grade, status,
            ntn, country, city, address, crm_id, crm_date, company_type, website, comment, rc_link, source,
            drm_id, owner_user_id, created_by, is_deleted, ab_type, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
            $20,$21,$22,$23,$24,
            coalesce($25::timestamp, now()), coalesce($26::timestamp, now())
          )`,
          [
            modernId,
            m.company_name,
            m.account_name,
            m.email,
            m.phone,
            m.region,
            m.grade,
            m.status,
            m.ntn,
            m.country,
            m.city,
            m.address,
            m.crm_id,
            parseTs(m.crm_date),
            m.company_type,
            m.website,
            m.comment,
            m.rc_link,
            m.source,
            m.drm_id,
            m.owner_user_id,
            m.created_by,
            m.is_deleted,
            m.ab_type,
            parseTs(m.create_date),
            parseTs(m.update_at),
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
        migrated += 1;
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
      mode: "execute_staging",
      database: TARGET_DB,
      batchId,
      limit,
      skippedAlreadyMapped: skipped,
      migrated,
      rejected,
      archiveImmutable: archiveBefore === archiveAfter,
      customersCount: (await client.query(`SELECT count(*)::int AS c FROM drm.customers`)).rows[0].c,
      userMapSize: userMap.size,
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
  const db = (await client.query("SELECT current_database()")).rows[0].current_database;
  if (db !== TARGET_DB) throw new Error(`Wrong DB: ${db}`);

  const userMap = await loadUserMap(client);
  if (userMap.size === 0 && executeStaging) {
    console.error("No user legacy map — run run-users-transform.mjs --execute-staging first");
    process.exit(2);
  }

  const { rows } = await client.query(CUSTOMER_SQL);

  if (executeStaging) {
    await executeStagingRun(client, rows, userMap);
    await client.end();
    return;
  }

  await client.query("BEGIN READ ONLY");
  const existingLegacy = await loadExistingCustomerLegacy(client);
  const seenComId = new Set();
  const ctx = { userMap, seenComId, existingLegacy };
  const results = rows.map((row) => transformRow(row, ctx));
  await client.query("ROLLBACK");
  await client.end();

  const valid = results.filter((r) => r.status === "valid");
  const rejected = results.filter((r) => r.status === "rejected");
  const skipped = results.filter((r) => r.status === "skipped");
  const withOwner = valid.filter((r) => r.modern.owner_user_id).length;

  console.log(
    JSON.stringify({
      mode: "dry_run",
      database: TARGET_DB,
      database_writes: false,
      sourceRowsQueried: rows.length,
      limit,
      userMapSize: userMap.size,
      valid: valid.length,
      rejected: rejected.length,
      skipped: skipped.length,
      withMappedOwner: withOwner,
      rejectReasons: rejected.reduce((acc, r) => {
        acc[r.reason] = (acc[r.reason] || 0) + 1;
        return acc;
      }, {}),
      statusSample: valid.slice(0, 5).map((r) => ({ legacyPk: r.legacyPk, status: r.modern.status, grade: r.modern.grade })),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
