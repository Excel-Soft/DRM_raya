#!/usr/bin/env node
/** Wave 7 — projects, service pool, meetings, finance, HR extras */
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
  loadDoneSet,
  startBatch,
  finishBatch,
  rejectRow,
} from "./migration-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES = [
  "create_project",
  "servicepool",
  "visit_meeting",
  "cheque_system",
  "penalty",
  "notice_board",
  "advance_salary",
  "dollar_pay",
  "pay_loan",
  "donation",
  "allowed_ip",
];

function money(v, d = "0") {
  const s = trimOrNull(v);
  if (!s) return d;
  const x = s.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(x) ? x : d;
}

async function ensureDdl(client) {
  await client.query(fs.readFileSync(path.join(__dirname, "ddl/12_wave7_tables.sql"), "utf8"));
}

async function loop(client, opts, cfg) {
  const done = await loadDoneSet(client, cfg.entity, cfg.source);
  if (opts.dryRun) {
    const { rows } = await client.query(cfg.drySql);
    return { module: opts.module, ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, cfg.source, cfg.target);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1;
  const ctx = await cfg.ctx(client);
  while (true) {
    const { rows } = await client.query(cfg.selectSql, [lastId, opts.batchSize]);
    if (!rows.length) break;
    await client.query("BEGIN");
    try {
      for (const row of rows) {
        lastId = Number(row.id);
        const legacyPk = String(row.legacy_pk ?? row.id);
        if (done.has(legacyPk)) {
          skipped++;
          continue;
        }
        const t = cfg.transform(row, ctx);
        if (t.status === "skipped") {
          skipped++;
          continue;
        }
        if (t.status === "rejected") {
          rejected++;
          await rejectRow(client, cfg.source, cfg.target, legacyPk, t.reason, 300, { rejected });
          continue;
        }
        const modernId = await cfg.insert(client, t);
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [cfg.entity, cfg.source, legacyPk, modernId, cfg.target],
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
  return { module: opts.module, migrated, rejected, skipped };
}

const RUNNERS = {
  async create_project(client, opts) {
    opts.module = "create_project";
    const userMap = await loadUserMap(client);
    const customerMap = await loadCustomerMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return loop(client, opts, {
      source: "webxl_create_project",
      target: "projects",
      entity: "create_project_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_create_project`,
      ctx: async () => {
        const depRows = await client.query(`
          SELECT trim(dep_id) AS dep_id, trim(name) AS name
            FROM legacy_archive.webxl_quotation_services
           WHERE trim(dep_id) <> ''`);
        const depByService = new Map();
        for (const r of depRows.rows) {
          const key = String(r.name || "").trim().toLowerCase().replace(/\s+/g, " ");
          if (!key) continue;
          depByService.set(
            key,
            {
              "2": "SALES",
              "8": "SEO_SMM",
              "9": "PRODUCT_POSTING",
              "10": "DND",
              "13": "IT",
              "24": "MEDIA",
              "27": "SOFTWARE",
              "5": "SERVICE",
            }[String(r.dep_id).trim()] ?? `LEGACY_DEP_${r.dep_id}`,
          );
        }
        return { userMap, customerMap, fallback, depByService };
      },
      selectSql: `SELECT pro_id::bigint AS id, pro_id AS legacy_pk, com_id, user_id, manager, project, detail, create_data
                    FROM legacy_archive.webxl_create_project WHERE pro_id::bigint > $1 ORDER BY pro_id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const owner = ctx.userMap.get(String(row.user_id)) ?? ctx.userMap.get(String(row.manager)) ?? ctx.fallback;
        if (!owner) return { status: "rejected", reason: "no_user", legacyPk };
        const name = (trimOrNull(row.project) ?? `Project ${legacyPk}`).slice(0, 500);
        const deptType = ctx.depByService?.get(
          String(row.project || "").trim().toLowerCase().replace(/\s+/g, " "),
        );
        return {
          status: "valid",
          legacyPk,
          owner,
          cust: ctx.customerMap.get(String(row.com_id)) ?? null,
          name,
          desc: trimOrNull(row.detail),
          num: `LEGACY-${legacyPk}`,
          start: parseTs(row.create_data),
          deptType: deptType ?? null,
          serviceName: trimOrNull(row.project),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.projects (id, customer_id, name, description, owner_user_id, project_type, department_type, service_type, status, start_date, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,'INVOICE_ROOT',$6,$7,'Active',$8,$8,$8)`,
          [
            id,
            t.cust,
            t.name,
            t.desc,
            t.owner,
            t.deptType,
            t.serviceName,
            t.start ?? new Date(),
          ],
        );
        return id;
      },
    });
  },
  async servicepool(client, opts) {
    opts.module = "servicepool";
    const userMap = await loadUserMap(client);
    const customerMap = await loadCustomerMap(client);
    return loop(client, opts, {
      source: "webxl_servicepool",
      target: "legacy_servicepool",
      entity: "servicepool_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_servicepool`,
      ctx: async () => ({ userMap, customerMap }),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, user_id, ta_user, com_id, parent_id, note, create_date FROM legacy_archive.webxl_servicepool WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const legacyUid = trimOrNull(row.user_id);
        let uid = null;
        if (legacyUid && legacyUid !== "0") {
          uid = ctx.userMap.get(legacyUid);
          if (!uid) return { status: "rejected", reason: "unmapped_user", legacyPk };
        }
        const legacyTa = trimOrNull(row.ta_user);
        const ta =
          legacyTa && legacyTa !== "0" ? (ctx.userMap.get(legacyTa) ?? null) : null;
        return {
          status: "valid",
          legacyPk,
          uid,
          cust: ctx.customerMap.get(String(row.com_id)) ?? null,
          ta,
          parent: trimOrNull(row.parent_id),
          note: trimOrNull(row.note),
          payload: row,
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_servicepool (id, customer_id, user_id, ta_user_id, legacy_parent_id, note, payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [id, t.cust, t.uid, t.ta, t.parent, t.note, JSON.stringify(t.payload)],
        );
        return id;
      },
    });
  },
  async visit_meeting(client, opts) {
    opts.module = "visit_meeting";
    const userMap = await loadUserMap(client);
    const customerMap = await loadCustomerMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return loop(client, opts, {
      source: "webxl_visit_meeting",
      target: "meetings",
      entity: "visit_meeting_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_visit_meeting`,
      ctx: async () => ({ userMap, customerMap, fallback }),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, com_id, user_id, status, service, start_time, end_time, note, create_at FROM legacy_archive.webxl_visit_meeting WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const uid = ctx.userMap.get(String(row.user_id)) ?? ctx.fallback;
        return {
          status: "valid",
          legacyPk,
          uid,
          cust: ctx.customerMap.get(String(row.com_id)) ?? null,
          type: (trimOrNull(row.service) ?? "visit").slice(0, 100),
          note: trimOrNull(row.note),
          at: parseTs(row.create_at) ?? new Date(),
          st: (trimOrNull(row.status) ?? "ended").toLowerCase().includes("progress") ? "in_progress" : "ended",
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.meetings (id, company_id, person_type, user_id, person_name, meeting_type, meeting_date, status, created_at, updated_at)
           VALUES ($1,$2,'user',$3::uuid,$4,$5,$6,$7::drm.meeting_status,$6,$6)`,
          [id, t.cust, t.uid, (t.note ?? "Legacy visit").slice(0, 300), t.type, t.at, t.st],
        );
        return id;
      },
    });
  },
  async cheque_system(client, opts) {
    opts.module = "cheque_system";
    const userMap = await loadUserMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return loop(client, opts, {
      source: "webxl_cheque_system",
      target: "cheques",
      entity: "cheque_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_cheque_system`,
      ctx: async () => ({ userMap, fallback }),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, pay_name, amount, check_number, cheque_date, cheque_type, cheque_status, comments, user_id, create_at FROM legacy_archive.webxl_cheque_system WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const createdBy = ctx.userMap.get(String(row.user_id)) ?? ctx.fallback;
        if (!createdBy) return { status: "rejected", reason: "unmapped_user", legacyPk };
        return {
          status: "valid",
          legacyPk,
          createdBy,
          company: (trimOrNull(row.pay_name) ?? "Legacy").slice(0, 300),
          amount: money(row.amount),
          num: (trimOrNull(row.check_number) ?? legacyPk).slice(0, 100),
          bank: (trimOrNull(row.cheque_type) ?? "Unknown").slice(0, 200),
          date: parseTs(row.cheque_date) ?? parseTs(row.create_at) ?? new Date(),
          st: trimOrNull(row.cheque_status) ?? "Pending",
          notes: trimOrNull(row.comments),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        let status = "Pending";
        const s = t.st.toLowerCase();
        if (s.includes("clear")) status = "Cleared";
        else if (s.includes("bounce")) status = "Bounced";
        else if (s.includes("cancel")) status = "Cancelled";
        await client.query(
          `INSERT INTO drm.cheques (id, cheque_number, bank_name, amount, currency, company_name, cheque_date, status, notes, created_by_user_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'PKR',$5,$6,$7::drm.cheque_status,$8,$9::uuid,now(),now())`,
          [id, t.num, t.bank, t.amount, t.company, t.date, status, t.notes, t.createdBy],
        );
        return id;
      },
    });
  },
  async penalty(client, opts) {
    opts.module = "penalty";
    const userMap = await loadUserMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return loop(client, opts, {
      source: "webxl_penalty",
      target: "penalties",
      entity: "penalty_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_penalty`,
      ctx: async () => ({ userMap, fallback }),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, user_id, add_by, head, amount, confirm, date FROM legacy_archive.webxl_penalty WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const emp = ctx.userMap.get(String(row.user_id));
        const by = ctx.userMap.get(String(row.add_by)) ?? ctx.fallback;
        if (!emp || !by) return { status: "rejected", reason: "unmapped_user", legacyPk };
        return {
          status: "valid",
          legacyPk,
          emp,
          by,
          head: (trimOrNull(row.head) ?? "General").slice(0, 200),
          reason: (trimOrNull(row.confirm) ?? "Legacy penalty").slice(0, 500),
          amount: money(row.amount),
          date: parseTs(row.date) ?? new Date(),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.penalties (id, employee_id, penalty_head, reason, amount, penalty_date, created_by, approval_status, created_at)
           VALUES ($1,$2::uuid,$3,$4,$5,($6::timestamptz)::date,$7::uuid,'APPROVED',$6)`,
          [id, t.emp, t.head, t.reason, t.amount, t.date, t.by],
        );
        return id;
      },
    });
  },
  async notice_board(client, opts) {
    opts.module = "notice_board";
    return loop(client, opts, {
      source: "webxl_notice_board",
      target: "legacy_notice_board",
      entity: "notice_board_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_notice_board`,
      ctx: async () => ({}),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, heading, detail, create_date FROM legacy_archive.webxl_notice_board WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row) {
        return {
          status: "valid",
          legacyPk: String(row.legacy_pk),
          title: (trimOrNull(row.heading) ?? "Notice").slice(0, 500),
          body: trimOrNull(row.detail),
          at: parseTs(row.create_date),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(`INSERT INTO drm.legacy_notice_board (id, title, body, legacy_created_at) VALUES ($1,$2,$3,$4)`, [id, t.title, t.body, t.at]);
        return id;
      },
    });
  },
  async advance_salary(client, opts) {
    opts.module = "advance_salary";
    const userMap = await loadUserMap(client);
    return loop(client, opts, {
      source: "webxl_addvance_salary",
      target: "loan_requests",
      entity: "advance_salary_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_addvance_salary`,
      ctx: async () => ({ userMap }),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, user_id, salary, instalment, detail, remaning, status, create_date FROM legacy_archive.webxl_addvance_salary WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const uid = ctx.userMap.get(String(row.user_id));
        if (!uid) return { status: "rejected", reason: "unmapped_user", legacyPk };
        const amt = money(row.salary, "1");
        const inst = money(row.instalment, amt);
        const rem = money(row.remaning, "0");
        return {
          status: "valid",
          legacyPk,
          uid,
          amt,
          inst,
          rem,
          detail: (trimOrNull(row.detail) ?? "Legacy advance").slice(0, 2000),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.loan_requests (id, user_id, amount, installment_amount, remaining_amount, detail, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'HODApproved',now(),now())`,
          [id, t.uid, t.amt, t.inst, t.rem, t.detail],
        );
        return id;
      },
    });
  },
  async dollar_pay(client, opts) {
    opts.module = "dollar_pay";
    const userMap = await loadUserMap(client);
    const customerMap = await loadCustomerMap(client);
    return loop(client, opts, {
      source: "webxl_dollar_pay",
      target: "legacy_dollar_pay",
      entity: "dollar_pay_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_dollar_pay`,
      ctx: async () => ({ userMap, customerMap }),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, user_id, com_id, gmid, dollars, pkr_amount, pay_date, create_at FROM legacy_archive.webxl_dollar_pay WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const uid = ctx.userMap.get(String(row.user_id));
        if (!uid) return { status: "rejected", reason: "unmapped_user", legacyPk };
        return {
          status: "valid",
          legacyPk,
          uid,
          cust: ctx.customerMap.get(String(row.com_id)) ?? null,
          gmid: trimOrNull(row.gmid),
          payload: row,
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_dollar_pay (id, customer_id, user_id, legacy_gm_id, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [id, t.cust, t.uid, t.gmid, JSON.stringify(t.payload)],
        );
        return id;
      },
    });
  },
  async pay_loan(client, opts) {
    opts.module = "pay_loan";
    const userMap = await loadUserMap(client);
    return loop(client, opts, {
      source: "webxl_pay_loan",
      target: "legacy_loan_payments",
      entity: "pay_loan_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_pay_loan`,
      ctx: async () => ({ userMap }),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, user_id, loan_id, pay, pay_date FROM legacy_archive.webxl_pay_loan WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.legacy_pk);
        const uid = ctx.userMap.get(String(row.user_id));
        if (!uid) return { status: "rejected", reason: "unmapped_user", legacyPk };
        return { status: "valid", legacyPk, uid, loan: trimOrNull(row.loan_id), amount: money(row.pay), at: parseTs(row.pay_date) };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_loan_payments (id, user_id, legacy_loan_id, amount, paid_at) VALUES ($1,$2,$3,$4,$5)`,
          [id, t.uid, t.loan, t.amount, t.at],
        );
        return id;
      },
    });
  },
  async donation(client, opts) {
    opts.module = "donation";
    const userMap = await loadUserMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return loop(client, opts, {
      source: "webxl_donation",
      target: "donations",
      entity: "donation_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_donation`,
      ctx: async () => ({ userMap, fallback }),
      selectSql: `SELECT * FROM legacy_archive.webxl_donation WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const name = trimOrNull(row.name) ?? "Legacy donor";
        const amt = money(row.amount, "0");
        if (Number(amt) <= 0) return { status: "rejected", reason: "zero_amount", legacyPk };
        return {
          status: "valid",
          legacyPk,
          name: name.slice(0, 300),
          amt,
          notes: trimOrNull(row.detail),
          at: parseTs(row.create_at),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.donations (id, company_name, title, person_name, amount, currency, comment, status, created_at)
           VALUES ($1,'Legacy','Mr.',$2,$3,'PKR',$4,'Approved',coalesce($5, now()))`,
          [id, t.name, t.amt, t.notes, t.at],
        );
        return id;
      },
    });
  },
  async allowed_ip(client, opts) {
    opts.module = "allowed_ip";
    return loop(client, opts, {
      source: "webxl_drm_allowed_ip",
      target: "allowed_ips",
      entity: "allowed_ip_row",
      drySql: `SELECT count(*)::bigint total FROM legacy_archive.webxl_drm_allowed_ip`,
      ctx: async () => ({}),
      selectSql: `SELECT id::bigint id, id AS legacy_pk, allowed_ip, location, browser, ip_user, created_at FROM legacy_archive.webxl_drm_allowed_ip WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      transform(row) {
        const ip = trimOrNull(row.allowed_ip);
        if (!ip) return { status: "rejected", reason: "empty_ip", legacyPk: String(row.legacy_pk) };
        return {
          status: "valid",
          legacyPk: String(row.legacy_pk),
          ip: ip.slice(0, 100),
          label: [trimOrNull(row.location), trimOrNull(row.browser)].filter(Boolean).join(" / ").slice(0, 200) || null,
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(`INSERT INTO drm.allowed_ips (id, ip_cidr, description, is_active, created_at, updated_at) VALUES ($1,$2,$3,true,now(),now())`, [
          id,
          t.ip,
          t.label,
        ]);
        return id;
      },
    });
  },
};

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.module || !RUNNERS[opts.module]) {
    console.error("--module required:", MODULES.join(", "));
    process.exit(2);
  }
  if (!opts.dryRun && !opts.executeStaging) {
    console.error("Use --dry-run or --execute-staging");
    process.exit(2);
  }
  const client = await connect();
  if (opts.executeStaging) await ensureDdl(client);
  const result = await RUNNERS[opts.module](client, opts);
  console.log(JSON.stringify({ mode: opts.dryRun ? "dry_run" : "execute_staging", ...result }));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
