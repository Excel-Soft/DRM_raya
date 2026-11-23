#!/usr/bin/env node
/**
 * Phase 2E/2F: legacy_archive.webxl_attribute -> drm.attributes
 * Database: drm_legacy_stage ONLY
 *
 * Usage:
 *   node run-attributes-transform.mjs --dry-run [--write-reports=/path]
 *   node run-attributes-transform.mjs --execute-staging [--legacy-ids=9,12,...] [--batch-size=10]
 *
 * --dry-run: SELECT only (READ ONLY). No writes.
 * --execute-staging: Writes to drm.attributes + migration_meta on drm_legacy_stage ONLY.
 *   Requires explicit execution approval (Phase 2F smoke / full load).
 */
import pg from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const TARGET_DB = "drm_legacy_stage";
const SOURCE_TABLE = "webxl_attribute";
const TARGET_TABLE = "attributes";
const ENTITY_TYPE = "attribute_row";

/** @type {Record<string, { category: string, disposition: string }>} */
const REFID_MAP = {
  "0": { category: "Alibaba Packages", disposition: "INCLUDE_ATTRIBUTES" },
  "1": { category: "Company Business Type", disposition: "INCLUDE_ATTRIBUTES" },
  "2": { category: "Service Type", disposition: "INCLUDE_ATTRIBUTES" },
  "3": { category: "Legacy Services Catalog", disposition: "INCLUDE_ATTRIBUTES" },
  "4": { category: "Company Detail", disposition: "INCLUDE_ATTRIBUTES" },
  "5": { category: "Source", disposition: "INCLUDE_ATTRIBUTES" },
  "6": { category: "Job Designation", disposition: "INCLUDE_ATTRIBUTES" },
  "7": { category: "Service Type", disposition: "INCLUDE_ATTRIBUTES" },
  "8": { category: "Contact Attribute", disposition: "INCLUDE_ATTRIBUTES" },
  "9": { category: "Whatsapp Message", disposition: "INCLUDE_ATTRIBUTES" },
  "10": { category: "Legacy Branch", disposition: "INCLUDE_ATTRIBUTES" },
  "11": { category: "Govt Leave", disposition: "INCLUDE_ATTRIBUTES" },
  "12": { category: "Account Monthly Task", disposition: "INCLUDE_ATTRIBUTES" },
  "13": { category: "Portfolio Categories", disposition: "INCLUDE_ATTRIBUTES" },
  "14": { category: "Country", disposition: "INCLUDE_ATTRIBUTES" },
};

const MISFILE_IDS = new Set(["197", "198"]);
const CATEGORY_MAX = 100;
const NAME_MAX = 2000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const writeReportsArg = args.find((a) => a.startsWith("--write-reports="));
const writeReportsDir = writeReportsArg ? writeReportsArg.split("=")[1] : null;
const legacyIdsArg = args.find((a) => a.startsWith("--legacy-ids="));
const legacyIdFilter = legacyIdsArg
  ? new Set(
      legacyIdsArg
        .split("=")[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null;
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "50");

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function isValidUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * @param {object} row archive row
 * @returns {{ status: 'valid'|'rejected'|'excluded', reason?: string, modern?: object }}
 */
function transformRow(row) {
  const legacyId = String(row.id ?? row._legacy_pk ?? "");
  const refId = String(row.refId ?? "").trim();

  const map = REFID_MAP[refId];
  if (!map || map.disposition.startsWith("EXCLUDE")) {
    return { status: "rejected", reason: "unmapped_refId", legacyId, refId };
  }

  const category = map.category;
  const name = trimOrNull(row.name);
  if (!name) {
    return { status: "rejected", reason: "missing_name", legacyId, refId, category };
  }
  if (category.length > CATEGORY_MAX) {
    return { status: "rejected", reason: "category_too_long", legacyId, refId, category };
  }
  if (name.length > NAME_MAX) {
    return { status: "rejected", reason: "name_too_long", legacyId, refId, category };
  }

  let dateLabel = null;
  if (refId === "11" || refId === "12") {
    dateLabel = trimOrNull(row.time);
  } else if (refId === "8" && trimOrNull(row.time)) {
    if (trimOrNull(row.time) !== null) {
      // duration metadata — must not appear in date_label
      dateLabel = null;
    }
  }

  let branch = null;
  if (refId === "12") {
    branch = trimOrNull(row.branch);
  }

  const prospectiveUuid = crypto.randomUUID();
  if (!isValidUuid(prospectiveUuid)) {
    return { status: "rejected", reason: "uuid_generation_failed", legacyId, refId };
  }

  if (refId === "8" && trimOrNull(row.time) && dateLabel !== null) {
    return { status: "rejected", reason: "refid8_time_leaked_to_date_label", legacyId, refId };
  }

  if (refId === "7" && category !== "Service Type") {
    return { status: "rejected", reason: "refid7_wrong_category", legacyId, refId, category };
  }

  return {
    status: "valid",
    legacyId,
    refId,
    modern: {
      prospective_id: prospectiveUuid,
      category,
      name,
      parent_id: null,
      amount: null,
      date_label: dateLabel,
      branch,
      email: null,
      phone: null,
    },
  };
}

function csvEscape(v) {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function executeStagingRun(client, allRows) {
  const archiveBefore = Number(
    (await client.query(`SELECT count(*)::int AS c FROM legacy_archive."${SOURCE_TABLE}"`)).rows[0].c,
  );

  let rows = allRows;
  if (legacyIdFilter) {
    rows = rows.filter((r) => legacyIdFilter.has(String(r.id)));
  }

  const batchRes = await client.query(
    `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status)
     VALUES ($1, $2, 'running') RETURNING batch_id`,
    [SOURCE_TABLE, `drm.${TARGET_TABLE}`],
  );
  const batchId = batchRes.rows[0].batch_id;

  let migrated = 0;
  let rejected = 0;

  const pending = [];
  for (const row of rows) {
    const legacyPk = String(row._legacy_pk ?? row.id);
    const mapped = await client.query(
      `SELECT 1 FROM migration_meta.migration_legacy_ids
       WHERE entity_type = $1 AND legacy_table = $2 AND legacy_id = $3`,
      [ENTITY_TYPE, SOURCE_TABLE, legacyPk],
    );
    if (mapped.rowCount) continue;

    const t = transformRow(row);
    if (t.status !== "valid") {
      rejected++;
      await client.query(
        `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason, raw_record_reference)
         VALUES ($1, $2, $3, $4, $5)`,
        [SOURCE_TABLE, legacyPk, TARGET_TABLE, t.reason || t.status, `batch:${batchId}`],
      );
      continue;
    }
    pending.push({ row, t, legacyPk });
  }

  for (let i = 0; i < pending.length; i += batchSize) {
    const slice = pending.slice(i, i + batchSize);
    await client.query("BEGIN");
    try {
      for (const { row, t, legacyPk } of slice) {
        const m = t.modern;
        const modernId = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm."${TARGET_TABLE}"
            (id, category, name, parent_id, amount, date_label, branch, email, phone, created_at, updated_at)
           VALUES ($1,$2,$3,NULL,NULL,$4,$5,NULL,NULL,now(),now())`,
          [modernId, m.category, m.name, m.date_label, m.branch],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
           VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY_TYPE, SOURCE_TABLE, legacyPk, modernId, TARGET_TABLE],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_record_state (source_table, legacy_pk, state, archive_table, modern_table, modern_id, batch_id)
           VALUES ($1,$2,'TRANSFORMED_SUCCESSFULLY',$3,$4,$5,$6)
           ON CONFLICT (source_table, legacy_pk) DO UPDATE SET state = EXCLUDED.state, modern_id = EXCLUDED.modern_id, updated_at = now()`,
          [SOURCE_TABLE, legacyPk, `legacy_archive.${SOURCE_TABLE}`, TARGET_TABLE, modernId, batchId],
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
      mode: "execute_staging",
      database: TARGET_DB,
      batchId,
      selected: pending.length + rejected,
      migrated,
      rejected,
      legacyIdFilter: legacyIdFilter ? [...legacyIdFilter] : null,
      archiveBefore,
      archiveAfter,
      archiveImmutable: archiveBefore === archiveAfter,
    }),
  );
}

async function main() {
  if (!dryRun && !executeStaging) {
    console.error("Specify --dry-run or --execute-staging (execution requires separate approval).");
    process.exit(2);
  }
  if (dryRun && executeStaging) {
    console.error("Use only one of --dry-run or --execute-staging.");
    process.exit(2);
  }

  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();
  const db = (await client.query("SELECT current_database()")).rows[0].current_database;
  if (db !== TARGET_DB) throw new Error(`Wrong DB: ${db}`);

  const { rows } = await client.query(
    `SELECT id, "refId", name, time, branch, _legacy_pk, _archive_row_id
     FROM legacy_archive."${SOURCE_TABLE}"
     ORDER BY _archive_row_id`,
  );

  if (executeStaging) {
    await executeStagingRun(client, rows);
    await client.end();
    return;
  }

  await client.query("BEGIN READ ONLY");
  const archiveBefore = Number(
    (await client.query(`SELECT count(*)::int AS c FROM legacy_archive.webxl_attribute`)).rows[0].c,
  );

  const results = rows.map(transformRow);
  await client.query("ROLLBACK");
  await client.end();

  const archiveAfter = archiveBefore;

  const valid = results.filter((r) => r.status === "valid");
  const rejected = results.filter((r) => r.status === "rejected");
  const excluded = results.filter((r) => r.status === "excluded");

  const categoryDist = {};
  for (const r of valid) {
    const c = r.modern.category;
    categoryDist[c] = (categoryDist[c] || 0) + 1;
  }

  const refId7 = valid.filter((r) => r.refId === "7");
  const refId9 = valid.filter((r) => r.refId === "9");
  const refId8WithTime = valid.filter((r) => r.refId === "8" && rows.find((x) => String(x.id) === r.legacyId && trimOrNull(x.time)));

  const summary = {
    mode: "dry_run",
    database: TARGET_DB,
    database_writes: false,
    archive_count_before: archiveBefore,
    archive_count_after: archiveAfter,
    total_source: rows.length,
    expected_eligible: 201,
    valid_count: valid.length,
    rejected_count: rejected.length,
    excluded_count: excluded.length,
    accounting_check: valid.length + rejected.length + excluded.length === rows.length,
    refId7_valid: refId7.length,
    refId7_category: refId7[0]?.modern?.category ?? null,
    refId9_valid: refId9.length,
    refId8_valid_with_duration_in_archive: refId8WithTime.length,
    refId8_date_label_all_null: refId8WithTime.every((r) => r.modern.date_label === null),
    category_distribution: categoryDist,
    reject_reasons: rejected.reduce((acc, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1;
      return acc;
    }, {}),
    exclude_reasons: excluded.reduce((acc, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1;
      return acc;
    }, {}),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (writeReportsDir) {
    try {
    fs.mkdirSync(writeReportsDir, { recursive: true });
    const validationLines = [
      "legacy_id,refId,status,reason,category,name,date_label,branch,prospective_uuid_valid",
    ];
    for (const r of results) {
      if (r.status === "valid") {
        validationLines.push(
          [
            r.legacyId,
            r.refId,
            "valid",
            "",
            csvEscape(r.modern.category),
            csvEscape(r.modern.name),
            csvEscape(r.modern.date_label),
            csvEscape(r.modern.branch),
            isValidUuid(r.modern.prospective_id) ? "yes" : "no",
          ].join(","),
        );
      } else {
        validationLines.push(
          [r.legacyId, r.refId, r.status, r.reason ?? "", "", "", "", "", ""].join(","),
        );
      }
    }
    fs.writeFileSync(path.join(writeReportsDir, "45-attributes-dry-run-validation.csv"), validationLines.join("\n") + "\n");

    const sampleValid = valid.slice(0, 15);
    const sampleLines = [
      "legacy_id,refId,category,name,archive_time,date_label,branch,prospective_id",
    ];
    for (const r of sampleValid) {
      const src = rows.find((x) => String(x.id) === r.legacyId);
      sampleLines.push(
        [
          r.legacyId,
          r.refId,
          csvEscape(r.modern.category),
          csvEscape(r.modern.name),
          csvEscape(trimOrNull(src?.time)),
          csvEscape(r.modern.date_label),
          csvEscape(r.modern.branch),
          r.modern.prospective_id,
        ].join(","),
      );
    }
    fs.writeFileSync(path.join(writeReportsDir, "44-attributes-dry-run-samples.csv"), sampleLines.join("\n") + "\n");
    } catch (e) {
      console.error(JSON.stringify({ writeReportsError: String(e.message) }));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
