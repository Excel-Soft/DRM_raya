#!/usr/bin/env node
/** Backfill drm.users.role + roles[] from legacy comma-separated role_id + webxl_role */
import { connect, parseArgs } from "./migration-helpers.mjs";
import { parseLegacyRoleCsv } from "./legacy-role-map.mjs";

async function loadRoleNames(client) {
  const { rows } = await client.query(`SELECT id::text AS id, name FROM legacy_archive.webxl_role`);
  const map = new Map();
  for (const r of rows) map.set(String(r.id).trim(), String(r.name).trim());
  return map;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.dryRun && !opts.executeStaging) {
    console.error("Use --dry-run or --execute-staging");
    process.exit(2);
  }
  const client = await connect();
  const idToName = await loadRoleNames(client);
  const { rows } = await client.query(
    `SELECT u.id, u.role_id, u.role, u.roles FROM drm.users u WHERE coalesce(trim(u.role_id), '') <> ''`,
  );
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const { roles, primary } = parseLegacyRoleCsv(row.role_id, idToName);
    const same =
      row.role === primary && Array.isArray(row.roles) && row.roles.length === roles.length && roles.every((r, i) => row.roles[i] === r);
    if (same) {
      skipped++;
      continue;
    }
    if (!opts.dryRun) {
      await client.query(`UPDATE drm.users SET role = $2, roles = $3::text[], updated_at = now() WHERE id = $1`, [
        row.id,
        primary,
        roles,
      ]);
    }
    updated++;
  }
  console.log(JSON.stringify({ mode: opts.dryRun ? "dry_run" : "execute_staging", total: rows.length, updated, skipped }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
