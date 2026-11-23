#!/usr/bin/env node
/**
 * webxl_user (+ webxl_login) -> drm.users
 * Database: drm_legacy_stage ONLY
 *
 * Usage:
 *   node run-users-transform.mjs --dry-run
 *   MIGRATION_STAGING_DEFAULT_PASSWORD='...' node run-users-transform.mjs --execute-staging [--batch-size=50]
 */
import pg from "pg";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { parseLegacyRoleCsv } from "./legacy-role-map.mjs";

const TARGET_DB = "drm_legacy_stage";
const SOURCE_TABLE = "webxl_user";
const LOGIN_TABLE = "webxl_login";
const TARGET_TABLE = "users";
const ENTITY_TYPE = "user";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const executeStaging = args.includes("--execute-staging");
const batchSize = Number(args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "50");
const stagingDefaultPassword = process.env.MIGRATION_STAGING_DEFAULT_PASSWORD?.trim() || null;

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function deriveUsername(row, loginUsername) {
  const u = trimOrNull(loginUsername);
  if (u) return u.slice(0, 120);
  const email = trimOrNull(row.email);
  if (email && email.includes("@")) return email.split("@")[0].slice(0, 120);
  return `user_${row.user_id}`.slice(0, 120);
}

function deriveEmail(row, usedEmails) {
  let email = trimOrNull(row.email);
  if (!email) {
    email = `legacy-user-${row.user_id}@drm.migrated.local`;
  }
  const lower = email.toLowerCase();
  if (!usedEmails.has(lower)) {
    usedEmails.add(lower);
    return email;
  }
  if (email.includes("@")) {
    const [local, domain] = email.split("@");
    const alt = `${local}+uid${row.user_id}@${domain}`.toLowerCase();
    if (!usedEmails.has(alt)) {
      usedEmails.add(alt);
      return `${local}+uid${row.user_id}@${domain}`;
    }
  }
  const fallback = `legacy-user-${row.user_id}@drm.migrated.local`.toLowerCase();
  usedEmails.add(fallback);
  return `legacy-user-${row.user_id}@drm.migrated.local`;
}

function deriveUsernameUnique(base, userId, used) {
  let u = base;
  let n = 0;
  while (used.has(u.toLowerCase())) {
    n += 1;
    u = `${base}_uid${userId}${n > 1 ? `_${n}` : ""}`.slice(0, 120);
  }
  used.add(u.toLowerCase());
  return u;
}

/**
 * @param {object} row
 * @param {{ hasLoginPassword: boolean }} ctx
 */
function transformRow(row, ctx) {
  const legacyPk = String(row.user_id ?? row._legacy_pk ?? "");
  const name = trimOrNull(row.name);
  if (!name) {
    return { status: "rejected", reason: "missing_name", legacyPk };
  }
  if (!ctx.hasLoginPassword && !stagingDefaultPassword && executeStaging) {
    return { status: "rejected", reason: "missing_login_and_no_staging_default", legacyPk };
  }
  return {
    status: "valid",
    legacyPk,
    modern: {
      name,
      full_name: trimOrNull(row.fname),
      role_id: trimOrNull(row.roleid) ?? trimOrNull(row.login_role_id),
      branch: trimOrNull(row.branch) ?? "Lahore Gulburg",
      country: trimOrNull(row.country) ?? "Pakistan",
      phone: trimOrNull(row.officenumber),
      has_login_password: ctx.hasLoginPassword,
    },
    loginUsername: row.login_username,
    loginPassword: row.login_password,
  };
}

const USER_SQL = `
SELECT
  u.user_id,
  u.name,
  u.fname,
  u.email,
  u."roleId" AS roleid,
  u.branch,
  u.country,
  u."officeNumber" AS officenumber,
  u._legacy_pk,
  l.username AS login_username,
  l.password AS login_password,
  l.role_id AS login_role_id
FROM legacy_archive.webxl_user u
LEFT JOIN LATERAL (
  SELECT username, password, role_id
  FROM legacy_archive.webxl_login l
  WHERE l.user_id::text = u.user_id::text
    AND trim(coalesce(l.password, '')) <> ''
  ORDER BY
    CASE WHEN trim(coalesce(l.username, '')) <> '' THEN 0 ELSE 1 END,
    l.updated_at DESC NULLS LAST,
    l.id DESC
  LIMIT 1
) l ON true
ORDER BY u.user_id::int
`;

async function loadExistingMaps(client) {
  const { rows } = await client.query(
    `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids
     WHERE entity_type = $1 AND legacy_table = $2`,
    [ENTITY_TYPE, SOURCE_TABLE],
  );
  return new Map(rows.map((r) => [String(r.legacy_id), r.modern_id]));
}

async function executeStagingRun(client, rows) {
  const existing = await loadExistingMaps(client);
  const archiveBefore = Number(
    (await client.query(`SELECT count(*)::int AS c FROM legacy_archive."${SOURCE_TABLE}"`)).rows[0].c,
  );

  const batchRes = await client.query(
    `INSERT INTO migration_meta.migration_batches (source_table, target_table, batch_status)
     VALUES ($1, $2, 'running') RETURNING batch_id`,
    [SOURCE_TABLE, TARGET_TABLE],
  );
  const batchId = batchRes.rows[0].batch_id;

  let defaultHash = null;
  if (stagingDefaultPassword) {
    defaultHash = await bcrypt.hash(stagingDefaultPassword, 10);
  }

  const usedEmails = new Set(
    (await client.query(`SELECT lower(email) AS e FROM drm.users`)).rows.map((r) => r.e),
  );
  const usedUsernames = new Set(
    (await client.query(`SELECT lower(username) AS u FROM drm.users`)).rows.map((r) => r.u),
  );
  const legacyRoleNames = new Map(
    (await client.query(`SELECT id::text AS id, name FROM legacy_archive.webxl_role`)).rows.map((r) => [
      String(r.id).trim(),
      String(r.name).trim(),
    ]),
  );

  const pending = [];
  let skipped = 0;
  let rejected = 0;

  for (const row of rows) {
    const legacyPk = String(row.user_id);
    if (existing.has(legacyPk)) {
      skipped += 1;
      continue;
    }
    const hasLoginPassword = trimOrNull(row.login_password) !== null;
    const t = transformRow(row, { hasLoginPassword });
    if (t.status !== "valid") {
      rejected += 1;
      await client.query(
        `INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason)
         VALUES ($1,$2,$3,$4)`,
        [SOURCE_TABLE, legacyPk, TARGET_TABLE, t.reason],
      );
      continue;
    }
    pending.push({ row, t, legacyPk, hasLoginPassword });
  }

  let migrated = 0;
  for (let i = 0; i < pending.length; i += batchSize) {
    const slice = pending.slice(i, i + batchSize);
    await client.query("BEGIN");
    try {
      for (const { row, t, legacyPk, hasLoginPassword } of slice) {
        const email = deriveEmail(row, usedEmails);
        const username = deriveUsernameUnique(deriveUsername(row, t.loginUsername), legacyPk, usedUsernames);
        let passwordHash;
        if (hasLoginPassword) {
          passwordHash = await bcrypt.hash(String(row.login_password), 10);
        } else {
          if (!defaultHash) throw new Error("MIGRATION_STAGING_DEFAULT_PASSWORD required for users without login");
          passwordHash = defaultHash;
        }
        const modernId = crypto.randomUUID();
        const m = t.modern;
        const roleCsv = m.role_id ?? trimOrNull(row.login_role_id) ?? trimOrNull(row.roleid);
        const { roles, primary } = parseLegacyRoleCsv(roleCsv, legacyRoleNames);
        await client.query(
          `INSERT INTO drm.users
            (id, name, full_name, username, email, password_hash, role_id, role, roles, branch, country, phone, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11,$12,true,now(),now())`,
          [
            modernId,
            m.name,
            m.full_name,
            username,
            email,
            passwordHash,
            m.role_id,
            primary,
            roles,
            m.branch,
            m.country,
            m.phone,
          ],
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
      archiveRows: archiveBefore,
      skippedAlreadyMapped: skipped,
      migrated,
      rejected,
      archiveImmutable: archiveBefore === archiveAfter,
      usersCount: (await client.query(`SELECT count(*)::int AS c FROM drm.users`)).rows[0].c,
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

  const { rows } = await client.query(USER_SQL);

  if (executeStaging) {
    await executeStagingRun(client, rows);
    await client.end();
    return;
  }

  await client.query("BEGIN READ ONLY");
  const results = rows.map((row) => {
    const hasLoginPassword = trimOrNull(row.login_password) !== null;
    return transformRow(row, { hasLoginPassword });
  });
  await client.query("ROLLBACK");
  await client.end();

  const valid = results.filter((r) => r.status === "valid");
  const rejected = results.filter((r) => r.status === "rejected");
  const withLogin = valid.filter((r) => r.modern.has_login_password).length;
  const withoutLogin = valid.length - withLogin;

  console.log(
    JSON.stringify({
      mode: "dry_run",
      database: TARGET_DB,
      database_writes: false,
      sourceRows: rows.length,
      valid: valid.length,
      rejected: rejected.length,
      withLoginPassword: withLogin,
      withoutLoginPassword: withoutLogin,
      rejectReasons: rejected.reduce((acc, r) => {
        acc[r.reason] = (acc[r.reason] || 0) + 1;
        return acc;
      }, {}),
      executeNote:
        withoutLogin > 0
          ? "Set MIGRATION_STAGING_DEFAULT_PASSWORD for execute if users lack webxl_login password"
          : null,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
