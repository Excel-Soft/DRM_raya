import pg from "pg";

export const TARGET_DB = "drm_legacy_stage";

export function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    executeStaging: args.includes("--execute-staging"),
    batchSize: Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "5000"),
    limit: args.find((a) => a.startsWith("--limit=")) ? Number(args.find((a) => a.startsWith("--limit=")).split("=")[1]) : null,
    module: args.find((a) => a.startsWith("--module="))?.split("=")[1] || null,
  };
}

export function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** @returns {string|null|undefined} undefined = legacy id present but not in map */
export function mapLegacyUserId(legacyUserId, userMap, opts = {}) {
  const { fallback = null, zeroAsEmpty = true } = opts;
  const s = trimOrNull(legacyUserId);
  if (!s || (zeroAsEmpty && s === "0")) return fallback;
  const hit = userMap.get(s);
  if (hit) return hit;
  return opts.strictUnmapped ? undefined : fallback;
}

export async function loadFallbackUserId(client) {
  return (await client.query(`SELECT id::text AS id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id ?? null;
}

export async function loadFallbackCustomerId(client) {
  return (await client.query(`SELECT id::text AS id FROM drm.customers ORDER BY created_at LIMIT 1`)).rows[0]?.id ?? null;
}

export function parseTs(v) {
  const s = trimOrNull(v);
  if (!s || s.startsWith("0000-00-00")) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function safeInt(v, fallback = 0) {
  const s = trimOrNull(v);
  if (s == null) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function connect() {
  const client = new pg.Client({ host: "/var/run/postgresql", database: TARGET_DB });
  await client.connect();
  return client;
}

export async function loadUserMap(client) {
  const { rows } = await client.query(
    `SELECT legacy_id, modern_id::text AS modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='user' AND legacy_table='webxl_user'`,
  );
  return new Map(rows.map((r) => [String(r.legacy_id), r.modern_id]));
}

export async function loadCustomerMap(client) {
  const { rows } = await client.query(
    `SELECT legacy_id, modern_id::text AS modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='customer' AND legacy_table='webxl_company'`,
  );
  return new Map(rows.map((r) => [String(r.legacy_id), r.modern_id]));
}

export async function loadFollowupMap(client) {
  const { rows } = await client.query(
    `SELECT legacy_id, modern_id::text AS modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='followup' AND legacy_table='webxl_followup'`,
  );
  return new Map(rows.map((r) => [String(r.legacy_id), r.modern_id]));
}

export async function loadAttributeMap(client) {
  const { rows } = await client.query(
    `SELECT legacy_id, modern_id::text AS modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='attribute_row' AND legacy_table='webxl_attribute'`,
  );
  return new Map(rows.map((r) => [String(r.legacy_id), r.modern_id]));
}

export async function loadDoneSet(client, entity, source) {
  const { rows } = await client.query(
    `SELECT legacy_id FROM migration_meta.migration_legacy_ids WHERE entity_type=$1 AND legacy_table=$2`,
    [entity, source],
  );
  return new Set(rows.map((r) => String(r.legacy_id)));
}

export async function startBatch(client, source, target) {
  const { rows } = await client.query(
    `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status) VALUES ($1,$2,'running') RETURNING batch_id`,
    [source, target],
  );
  return rows[0].batch_id;
}

export async function finishBatch(client, batchId, migrated, rejected) {
  await client.query(
    `UPDATE migration_meta.migration_batches SET batch_status='committed', rows_migrated=$2, rows_rejected=$3, completed_at=now() WHERE batch_id=$1`,
    [batchId, migrated, rejected],
  );
}

export async function rejectRow(client, source, target, legacyPk, reason, cap, state) {
  if (state.rejected > cap) return;
  await client.query(
    `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason) VALUES ($1,$2,$3,$4)`,
    [source, legacyPk, target, reason],
  );
}
