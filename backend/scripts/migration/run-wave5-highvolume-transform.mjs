#!/usr/bin/env node
/**
 * Wave 5 — high-volume tables (one --module at a time).
 * drm_legacy_stage ONLY. Run ddl/10_wave5_highvolume_tables.sql on first execute.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  connect,
  parseArgs,
  trimOrNull,
  parseTs,
  loadUserMap,
  loadCustomerMap,
  loadFollowupMap,
  loadAttributeMap,
  loadDoneSet,
  startBatch,
  finishBatch,
  rejectRow,
  mapLegacyUserId,
  loadFallbackUserId,
} from "./migration-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES = [
  "task_links",
  "follow_up_services",
  "com_history",
  "com_detail",
  "last_followup",
  "raw_attendence",
  "posting_data",
  "task_assign",
  "task_log_history",
];

function mapVerifyStatus(raw) {
  const s = (trimOrNull(raw) ?? "").toLowerCase();
  if (["1", "yes", "verified", "approve", "approved"].includes(s)) return "Verified";
  if (["0", "no", "reject", "rejected"].includes(s)) return "Rejected";
  return "Pending";
}

async function ensureWave5Ddl(client) {
  const ddl = fs.readFileSync(path.join(__dirname, "ddl/10_wave5_highvolume_tables.sql"), "utf8");
  await client.query(ddl);
}

async function migrateTaskLinks(client, opts) {
  const SOURCE = "webxl_task_links";
  const TARGET = "link_reports";
  const ENTITY = "task_link";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const userMap = await loadUserMap(client);
  const fallbackUser = await loadFallbackUserId(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE trim(coalesce(link,''))='') empty_link,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids u WHERE u.entity_type='user' AND u.legacy_table='webxl_user' AND u.legacy_id=webxl_task_links.user_id::text)) unmapped_user
      FROM legacy_archive.webxl_task_links`);
    return { module: "task_links", ...rows[0], already_mapped: done.size, userMap: userMap.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, pro_id, task_id, link, showcase, detail, user_id, create_at, verify, note, verify_date,
              send_to_qa, qa_status, qa_com, qa_reject_image, qa_date
       FROM legacy_archive.webxl_task_links WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const link = trimOrNull(row.link) || `legacy:missing-link:${legacyPk}`;
        const uid = mapLegacyUserId(row.user_id, userMap, { fallback: fallbackUser });
        if (!uid) {
          rejected++;
          await rejectRow(client, SOURCE, TARGET, legacyPk, "unmapped_user", 500, { rejected });
          continue;
        }
        const meta = {
          legacy_pro_id: row.pro_id,
          legacy_task_id: row.task_id,
          showcase: row.showcase,
          verify: row.verify,
          note: row.note,
          verify_date: row.verify_date,
          send_to_qa: row.send_to_qa,
          qa_status: row.qa_status,
          qa_com: row.qa_com,
          qa_reject_image: row.qa_reject_image,
          qa_date: row.qa_date,
        };
        const id = crypto.randomUUID();
        const submittedAt = parseTs(row.create_at) ?? new Date();
        await client.query(
          `INSERT INTO drm.link_reports (id, submitted_by_user_id, company_name, link_url, source_module, submitted_at, created_at, updated_at, legacy_metadata)
           VALUES ($1,$2,$3,$4,'legacy_task_link',$5,$5,$5,$6::jsonb)`,
          [id, uid, (trimOrNull(row.detail) ?? "-").slice(0, 500), link.slice(0, 4000), submittedAt, JSON.stringify(meta)],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    if (migrated && migrated % 100000 === 0) console.error(JSON.stringify({ module: "task_links", migrated, lastId }));
    if (rem != null) rem -= rows.length;
    if (rows.length < lim) break;
  }
  await finishBatch(client, batchId, migrated, rejected);
  const total = (await client.query(`SELECT count(*)::int c FROM drm.link_reports`)).rows[0].c;
  return { module: "task_links", migrated, rejected, skipped, link_reports_total: total };
}

async function migrateFollowUpServices(client, opts) {
  const SOURCE = "webxl_follow_up_services";
  const TARGET = "follow_up_service_lines";
  const ENTITY = "follow_up_service_line";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const userMap = await loadUserMap(client);
  const followMap = await loadFollowupMap(client);
  const attrMap = await loadAttributeMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids f WHERE f.entity_type='followup' AND f.legacy_table='webxl_followup' AND f.legacy_id=webxl_follow_up_services.follow_up_id::text)) unmapped_followup
      FROM legacy_archive.webxl_follow_up_services`);
    return { module: "follow_up_services", ...rows[0], already_mapped: done.size, followMap: followMap.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, service_id, follow_up_id, service_type, service_grade, service_comment, manager_id, manager_comment,
              sm_id, sm_comment, hod_id, hod_comment, purpose, method, next_date, note, talk_time, added_by, created_at, updated_at
       FROM legacy_archive.webxl_follow_up_services WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const followId = followMap.get(String(row.follow_up_id));
        if (!followId) {
          rejected++;
          await rejectRow(client, SOURCE, TARGET, legacyPk, "unmapped_followup", 500, { rejected });
          continue;
        }
        const attrId = attrMap.get(String(row.service_id)) ?? null;
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.follow_up_service_lines (
            id, follow_up_id, legacy_service_id, attribute_id, service_type, service_grade, service_comment,
            manager_id, manager_comment, sm_id, sm_comment, hod_id, hod_comment, purpose, method, next_date,
            note, talk_time, added_by, legacy_created_at, legacy_updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [
            id,
            followId,
            trimOrNull(row.service_id),
            attrId,
            trimOrNull(row.service_type),
            trimOrNull(row.service_grade),
            trimOrNull(row.service_comment),
            userMap.get(String(row.manager_id)) ?? null,
            trimOrNull(row.manager_comment),
            userMap.get(String(row.sm_id)) ?? null,
            trimOrNull(row.sm_comment),
            userMap.get(String(row.hod_id)) ?? null,
            trimOrNull(row.hod_comment),
            trimOrNull(row.purpose),
            trimOrNull(row.method),
            parseTs(row.next_date),
            trimOrNull(row.note),
            trimOrNull(row.talk_time),
            userMap.get(String(row.added_by)) ?? null,
            parseTs(row.created_at),
            parseTs(row.updated_at),
          ],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    if (migrated && migrated % 50000 === 0) console.error(JSON.stringify({ module: "follow_up_services", migrated, lastId }));
    if (rem != null) rem -= rows.length;
    if (rows.length < lim) break;
  }
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "follow_up_services", migrated, rejected, skipped };
}

async function migrateComHistory(client, opts) {
  const SOURCE = "webxl_com_history";
  const TARGET = "communication_logs";
  const ENTITY = "com_history_row";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const userMap = await loadUserMap(client);
  const customerMap = await loadCustomerMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids c WHERE c.entity_type='customer' AND c.legacy_table='webxl_company' AND c.legacy_id=webxl_com_history.com_id::text)) unmapped_customer
      FROM legacy_archive.webxl_com_history`);
    return { module: "com_history", ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, com_id, tilte, detail, "addBy", create_date FROM legacy_archive.webxl_com_history WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const custId = customerMap.get(String(row.com_id));
        if (!custId) {
          rejected++;
          await rejectRow(client, SOURCE, TARGET, legacyPk, "unmapped_customer", 500, { rejected });
          continue;
        }
        const notes = [trimOrNull(row.tilte), trimOrNull(row.detail)].filter(Boolean).join("\n").slice(0, 8000) || "Legacy comm";
        const id = crypto.randomUUID();
        const createdAt = parseTs(row.create_date) ?? new Date();
        await client.query(
          `INSERT INTO drm.communication_logs (
            id, entity_type, entity_id, customer_id, user_id, channel, notes, status, external_reference, created_at, updated_at)
           VALUES ($1,'customer',$2,$3,$4,'NOTE',$5,'COMPLETED',$6,$7,$7)`,
          [
            id,
            custId,
            custId,
            userMap.get(String(row.addBy)) ?? null,
            notes,
            `legacy_com_history:${legacyPk}`,
            createdAt,
          ],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    if (migrated && migrated % 100000 === 0) console.error(JSON.stringify({ module: "com_history", migrated, lastId }));
    if (rem != null) rem -= rows.length;
    if (rows.length < lim) break;
  }
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "com_history", migrated, rejected, skipped };
}

async function migrateComDetail(client, opts) {
  const SOURCE = "webxl_com_detail";
  const TARGET = "customer_contacts";
  const ENTITY = "com_detail_contact";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const customerMap = await loadCustomerMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids c WHERE c.entity_type='customer' AND c.legacy_table='webxl_company' AND c.legacy_id=webxl_com_detail.com_id::text)) unmapped_customer
      FROM legacy_archive.webxl_com_detail`);
    return { module: "com_detail", ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, title, com_id, name, cinc, email, email2, email3, phone, designation, phone2, phone3, phone4, phone5
       FROM legacy_archive.webxl_com_detail WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const custId = customerMap.get(String(row.com_id));
        if (!custId) {
          rejected++;
          await rejectRow(client, SOURCE, TARGET, legacyPk, "unmapped_customer", 500, { rejected });
          continue;
        }
        const name = trimOrNull(row.name) ?? "Contact";
        const email = trimOrNull(row.email) ?? trimOrNull(row.email2) ?? `legacy-contact-${legacyPk}@drm.migrated.local`;
        const phone = trimOrNull(row.phone) ?? trimOrNull(row.phone2);
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.customer_contacts (id, customer_id, is_primary, title, person_name, account_holder_name, cnic, email, phone, created_at, updated_at)
           VALUES ($1,$2,false,$3,$4,$4,$5,$6,$7,now(),now())`,
          [id, custId, trimOrNull(row.title), name, trimOrNull(row.cinc), email.slice(0, 320), phone],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
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
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "com_detail", migrated, rejected, skipped };
}

async function migrateLastFollowup(client, opts) {
  const SOURCE = "webxl_last_followup";
  const TARGET = "customers";
  const ENTITY = "last_followup_snapshot";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const customerMap = await loadCustomerMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids c WHERE c.entity_type='customer' AND c.legacy_table='webxl_company' AND c.legacy_id=webxl_last_followup.com_id::text)) unmapped_customer
      FROM legacy_archive.webxl_last_followup`);
    return { module: "last_followup", ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, com_id, uid, username, cm, nc, ncm, note, create_date FROM legacy_archive.webxl_last_followup WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const custId = customerMap.get(String(row.com_id));
        if (!custId) {
          rejected++;
          await rejectRow(client, SOURCE, TARGET, legacyPk, "unmapped_customer", 500, { rejected });
          continue;
        }
        const lfDate = parseTs(row.nc) ?? parseTs(row.create_date);
        const note = trimOrNull(row.note);
        await client.query(
          `UPDATE drm.customers SET
             last_followup_date = CASE WHEN $2::timestamptz IS NULL THEN last_followup_date
               WHEN last_followup_date IS NULL OR last_followup_date < $2 THEN $2 ELSE last_followup_date END,
             comment = CASE WHEN $3::text IS NOT NULL AND ($3 <> '') THEN left($3, 2000) ELSE comment END,
             updated_at = now()
           WHERE id = $1::uuid`,
          [custId, lfDate, note],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, custId, TARGET],
        );
        done.add(legacyPk);
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
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "last_followup", migrated, rejected, skipped };
}

async function migrateRawAttendence(client, opts) {
  const SOURCE = "webxl_raw_attendence";
  const TARGET = "attendance_raw_punches";
  const ENTITY = "raw_attendance_punch";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const userMap = await loadUserMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids u WHERE u.entity_type='user' AND u.legacy_table='webxl_user' AND u.legacy_id=COALESCE(NULLIF(trim(webxl_raw_attendence.user_id),''), webxl_raw_attendence.uid))) unmapped_user
      FROM legacy_archive.webxl_raw_attendence`);
    return { module: "raw_attendence", ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, office, device_ip, uid, user_id, state, type, att_timestamp, received_at, raw_json
       FROM legacy_archive.webxl_raw_attendence WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const legacyUser = trimOrNull(row.user_id) || trimOrNull(row.uid);
        const uid =
          legacyUser && legacyUser !== "0" ? (userMap.get(String(legacyUser)) ?? null) : null;
        let rawJson = null;
        try {
          if (trimOrNull(row.raw_json)) rawJson = JSON.parse(row.raw_json);
        } catch {
          rawJson = { raw: row.raw_json };
        }
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.attendance_raw_punches (id, user_id, legacy_uid, office, device_ip, state, punch_type, att_timestamp, received_at, raw_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            id,
            uid,
            legacyUser ?? trimOrNull(row.uid),
            trimOrNull(row.office),
            trimOrNull(row.device_ip),
            trimOrNull(row.state),
            trimOrNull(row.type),
            parseTs(row.att_timestamp),
            parseTs(row.received_at),
            rawJson ? JSON.stringify(rawJson) : null,
          ],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
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
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "raw_attendence", migrated, rejected, skipped };
}

async function migratePostingData(client, opts) {
  const SOURCE = "webxl_posting_data";
  const TARGET = "product_posting_data";
  const ENTITY = "posting_data_row";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const userMap = await loadUserMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`SELECT count(*)::bigint total FROM legacy_archive.webxl_posting_data`);
    return { module: "posting_data", ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, categories, images, mimg_id, user_id FROM legacy_archive.webxl_posting_data WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const cat = trimOrNull(row.categories) ?? "Legacy";
        let otherImages = [];
        const img = trimOrNull(row.images);
        if (img) {
          try {
            otherImages = JSON.parse(img);
          } catch {
            otherImages = img.split(",").map((s) => s.trim()).filter(Boolean);
          }
        }
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.product_posting_data (id, category, main_image, other_images, status, user_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4::jsonb,'Migrated',$5,now(),now())`,
          [id, cat.slice(0, 500), trimOrNull(row.mimg_id), JSON.stringify(otherImages), userMap.get(String(row.user_id)) ?? null],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
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
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "posting_data", migrated, rejected, skipped };
}

async function migrateTaskAssign(client, opts) {
  const SOURCE = "webxl_task_assign";
  const TARGET = "legacy_task_assignments";
  const ENTITY = "task_assign_row";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const userMap = await loadUserMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids u WHERE u.entity_type='user' AND u.legacy_table='webxl_user' AND u.legacy_id=webxl_task_assign.user_id::text)) unmapped_user
      FROM legacy_archive.webxl_task_assign`);
    return { module: "task_assign", ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  const payloadCols = [
    "hours",
    "min",
    "links",
    "timespent",
    "freetime",
    "totalTimespent",
    "stauts",
    "last_update",
    "mng_status",
    "final_links",
    "mng_date",
    "qa_status",
    "qa_com",
    "qa_date",
    "fy_status",
    "fy_com",
    "fy_fdb",
    "fy_date",
    "after_qa_changing",
    "open_url",
    "url_date",
    "soft_com_id",
    "soft_task_cname",
    "soft_task_name",
    "soft_task_time",
    "soft_task_day",
    "soft_task_type",
    "soft_task_piority",
    "soft_task_due_date",
    "soft_task_detail",
    "shifted_task",
  ];
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, user_id, task_id, pro_id, hours, min, links, timespent, freetime, "totalTimespent", assign_date, stauts, last_update,
              mng_status, final_links, mng_date, qa_status, qa_com, qa_date, fy_status, fy_com, fy_fdb, fy_date, after_qa_changing,
              open_url, url_date, soft_com_id, soft_task_cname, soft_task_name, soft_task_time, soft_task_day, soft_task_type,
              soft_task_piority, soft_task_due_date, assgin_by, soft_task_detail, shifted_task
       FROM legacy_archive.webxl_task_assign WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const uid = mapLegacyUserId(row.user_id, userMap, { fallback: null });
        const payload = {};
        for (const k of payloadCols) payload[k] = row[k] ?? null;
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_task_assignments (id, legacy_task_id, legacy_pro_id, user_id, assigned_by, assign_date, status, hours, min, links, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [
            id,
            trimOrNull(row.task_id),
            trimOrNull(row.pro_id),
            uid,
            mapLegacyUserId(row.assgin_by, userMap, { fallback: null }),
            parseTs(row.assign_date),
            trimOrNull(row.stauts),
            trimOrNull(row.hours),
            trimOrNull(row.min),
            trimOrNull(row.links),
            JSON.stringify(payload),
          ],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
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
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "task_assign", migrated, rejected, skipped };
}

async function migrateTaskLogHistory(client, opts) {
  const SOURCE = "webxl_task_log_history";
  const TARGET = "task_log_history";
  const ENTITY = "task_log_history_row";
  const done = await loadDoneSet(client, ENTITY, SOURCE);
  const userMap = await loadUserMap(client);
  if (opts.dryRun) {
    const { rows } = await client.query(`
      SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids u WHERE u.entity_type='user' AND u.legacy_table='webxl_user' AND u.legacy_id=webxl_task_log_history.user_id::text)) unmapped_user
      FROM legacy_archive.webxl_task_log_history`);
    return { module: "task_log_history", ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, SOURCE, TARGET);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1,
    rem = opts.limit;
  while (true) {
    const lim = rem != null ? Math.min(opts.batchSize, rem) : opts.batchSize;
    if (rem != null && rem <= 0) break;
    const { rows } = await client.query(
      `SELECT id, user_id, task_id, status, time, create_at FROM legacy_archive.webxl_task_log_history WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      [lastId, lim],
    );
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const uid = userMap.get(String(row.user_id));
        if (!uid) {
          rejected++;
          await rejectRow(client, SOURCE, TARGET, legacyPk, "unmapped_user", 500, { rejected });
          continue;
        }
        const id = crypto.randomUUID();
        const eventTime = parseTs(row.time) ?? parseTs(row.create_at);
        await client.query(
          `INSERT INTO drm.task_log_history (id, user_id, legacy_task_id, status, event_time, legacy_created_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, uid, trimOrNull(row.task_id), trimOrNull(row.status), eventTime, parseTs(row.create_at)],
        );
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [ENTITY, SOURCE, legacyPk, id, TARGET],
        );
        done.add(legacyPk);
        migrated++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    if (migrated && migrated % 50000 === 0) console.error(JSON.stringify({ module: "task_log_history", migrated, lastId }));
    if (rem != null) rem -= rows.length;
    if (rows.length < lim) break;
  }
  await finishBatch(client, batchId, migrated, rejected);
  return { module: "task_log_history", migrated, rejected, skipped };
}

const RUNNERS = {
  task_links: migrateTaskLinks,
  follow_up_services: migrateFollowUpServices,
  com_history: migrateComHistory,
  com_detail: migrateComDetail,
  last_followup: migrateLastFollowup,
  raw_attendence: migrateRawAttendence,
  posting_data: migratePostingData,
  task_assign: migrateTaskAssign,
  task_log_history: migrateTaskLogHistory,
};

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.dryRun && !opts.executeStaging) {
    console.error("Use --dry-run or --execute-staging and --module=<name>");
    console.error("Modules:", MODULES.join(", "));
    process.exit(2);
  }
  if (!opts.module || !RUNNERS[opts.module]) {
    console.error("--module required:", MODULES.join(", "));
    process.exit(2);
  }
  const client = await connect();
  if (opts.executeStaging) await ensureWave5Ddl(client);
  const result = await RUNNERS[opts.module](client, opts);
  console.log(JSON.stringify({ mode: opts.dryRun ? "dry_run" : "execute_staging", ...result }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
