#!/usr/bin/env node
/** Wave 6 — HR, GM, finance, posting extras. drm_legacy_stage only. */
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
  "departments",
  "roles",
  "gmaccount",
  "gmaccount_history",
  "verify_gm_cash",
  "verify_gm_delay",
  "invoice_item_pay",
  "posting_keywords",
  "posting_mimg",
  "leave",
  "overtime",
  "expense",
  "complaints",
];

function money(v, fallback = "0") {
  const m = trimOrNull(v);
  if (!m) return fallback;
  const s = m.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return fallback;
  return s;
}

function mapLeaveType(raw) {
  const s = (trimOrNull(raw) ?? "").toLowerCase();
  if (s.includes("sick")) return "Sick";
  if (s.includes("casual")) return "Casual";
  if (s.includes("annual")) return "Annual";
  if (s.includes("emergency")) return "Emergency";
  if (s.includes("half")) return "HalfDay";
  if (s.includes("unpaid")) return "Unpaid";
  if (s.includes("maternity")) return "Maternity";
  if (s.includes("paternity")) return "Paternity";
  return "Other";
}

function parseOvertimeMinutes(raw) {
  const s = trimOrNull(raw);
  if (!s) return 60;
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.trunc(n), 1440);
  const m = s.match(/(\d+)/);
  return m ? Math.min(Number(m[1]), 1440) : 60;
}

async function ensureDdl(client) {
  await client.query(fs.readFileSync(path.join(__dirname, "ddl/11_wave6_tables.sql"), "utf8"));
}

async function genericLoop(client, opts, cfg) {
  const done = await loadDoneSet(client, cfg.entity, cfg.source);
  if (opts.dryRun) {
    const q = cfg.dryRunSql ?? `SELECT count(*)::bigint total FROM legacy_archive."${cfg.source}"`;
    const { rows } = await client.query(q);
    return { module: opts.module, ...rows[0], already_mapped: done.size };
  }
  const batchId = await startBatch(client, cfg.source, cfg.target);
  let migrated = 0,
    rejected = 0,
    skipped = 0,
    lastId = -1;
  const ctx = cfg.buildCtx(await loadUserMap(client), await loadCustomerMap(client), done);
  while (true) {
    const { rows } = await client.query(cfg.selectSql, [lastId, opts.batchSize]);
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
        const t = cfg.transform(row, ctx);
        if (t.legacyPk == null) t.legacyPk = legacyPk;
        if (t.status === "skipped") {
          skipped++;
          continue;
        }
        if (t.status === "rejected") {
          rejected++;
          await rejectRow(client, cfg.source, cfg.target, t.legacyPk, t.reason, 400, { rejected });
          continue;
        }
        const id = await cfg.insert(client, t);
        await client.query(
          `INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table) VALUES ($1,$2,$3,$4,$5)`,
          [cfg.entity, cfg.source, t.legacyPk, id, cfg.target],
        );
        done.add(t.legacyPk);
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
  async departments(client, opts) {
    opts.module = "departments";
    return genericLoop(client, opts, {
      source: "webxl_department",
      target: "departments",
      entity: "department_row",
      selectSql: `SELECT id, name, email, pms_managers, pms_ratio, create_date FROM legacy_archive.webxl_department WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ done: new Set() }),
      transform(row) {
        const legacyPk = String(row.id);
        const name = trimOrNull(row.name) ?? `Dept ${legacyPk}`;
        return { status: "valid", legacyPk, name, code: `LEGACY-${legacyPk}`, meta: row };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.departments (id, code, name, created_at, updated_at) VALUES ($1,$2,$3,now(),now()) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [id, t.code, t.name.slice(0, 200)],
        );
        return id;
      },
    });
  },
  async roles(client, opts) {
    opts.module = "roles";
    const userMap = await loadUserMap(client);
    return genericLoop(client, opts, {
      source: "webxl_role",
      target: "roles",
      entity: "role_row",
      selectSql: `SELECT id, name, des, department, create_date FROM legacy_archive.webxl_role WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({}),
      transform(row) {
        const legacyPk = String(row.id);
        const base = trimOrNull(row.name) ?? `Role ${legacyPk}`;
        const name = `${base}`.slice(0, 180);
        const desc = [trimOrNull(row.des), trimOrNull(row.department) && `dept=${row.department}`].filter(Boolean).join("; ");
        return { status: "valid", legacyPk, name: `${name} [L${legacyPk}]`, desc };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(`INSERT INTO drm.roles (id, name, description, created_at, updated_at) VALUES ($1,$2,$3,now(),now())`, [
          id,
          t.name,
          t.desc || null,
        ]);
        return id;
      },
    });
  },
  async gmaccount(client, opts) {
    opts.module = "gmaccount";
    return genericLoop(client, opts, {
      source: "webxl_gmaccount",
      target: "legacy_gm_accounts",
      entity: "gmaccount_row",
      selectSql: `SELECT id, com_id, user_id, "user_bv_date", "bvDate", "startData", "endData", "LastStartDate", "LastExpireDate", create_data, renwal, date_btn, disable
                  FROM legacy_archive.webxl_gmaccount WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: (userMap, customerMap, done) => ({ userMap, customerMap, done }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const cust = ctx.customerMap.get(String(row.com_id)) ?? null;
        return {
          status: "valid",
          legacyPk,
          cust,
          user: ctx.userMap.get(String(row.user_id)) ?? null,
          bv: parseTs(row.bvDate) ?? parseTs(row.user_bv_date),
          start: parseTs(row.startData),
          end: parseTs(row.endData),
          ls: parseTs(row.LastStartDate),
          le: parseTs(row.LastExpireDate),
          payload: row,
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_gm_accounts (id, customer_id, sales_person_id, bv_date, start_date, end_date, last_start_date, last_expire_date, renewal, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            id,
            t.cust,
            t.user,
            t.bv,
            t.start,
            t.end,
            t.ls,
            t.le,
            trimOrNull(t.payload.renwal),
            JSON.stringify(t.payload),
          ],
        );
        return id;
      },
    });
  },
  async gmaccount_history(client, opts) {
    opts.module = "gmaccount_history";
    return genericLoop(client, opts, {
      source: "webxl_gmaccount_history",
      target: "legacy_gm_account_history",
      entity: "gmaccount_history_row",
      selectSql: `SELECT id, com_id, "addBy", user_id, title, "bvDate", "bvExpire", create_at FROM legacy_archive.webxl_gmaccount_history WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: (userMap, customerMap) => ({ userMap, customerMap }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const cust = ctx.customerMap.get(String(row.com_id));
        if (!cust) return { status: "rejected", reason: "unmapped_customer", legacyPk };
        return {
          status: "valid",
          legacyPk,
          cust,
          user: ctx.userMap.get(String(row.user_id)) ?? ctx.userMap.get(String(row.addBy)) ?? null,
          title: trimOrNull(row.title),
          bv: parseTs(row.bvDate),
          exp: parseTs(row.bvExpire),
          payload: row,
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_gm_account_history (id, customer_id, user_id, title, bv_date, bv_expire, payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [id, t.cust, t.user, t.title, t.bv, t.exp, JSON.stringify(t.payload)],
        );
        return id;
      },
    });
  },
  async verify_gm_cash(client, opts) {
    opts.module = "verify_gm_cash";
    return genericLoop(client, opts, {
      source: "webxl_verify_gm_cash",
      target: "legacy_verify_gm_cash",
      entity: "verify_gm_cash_row",
      selectSql: `SELECT id, com_id, gmid, pkr, total_balance, user_id, create_at FROM legacy_archive.webxl_verify_gm_cash WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: (userMap, customerMap) => ({ userMap, customerMap }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const cust = ctx.customerMap.get(String(row.com_id));
        if (!cust) return { status: "rejected", reason: "unmapped_customer", legacyPk };
        return { status: "valid", legacyPk, cust, user: ctx.userMap.get(String(row.user_id)) ?? null, payload: row };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_verify_gm_cash (id, customer_id, user_id, legacy_gm_id, pkr, total_balance, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [
            id,
            t.cust,
            t.user,
            trimOrNull(t.payload.gmid),
            money(t.payload.pkr, null),
            money(t.payload.total_balance, null),
            JSON.stringify(t.payload),
          ],
        );
        return id;
      },
    });
  },
  async verify_gm_delay(client, opts) {
    opts.module = "verify_gm_delay";
    return genericLoop(client, opts, {
      source: "webxl_verify_gm_delay_amount",
      target: "legacy_verify_gm_delay",
      entity: "verify_gm_delay_row",
      selectSql: `SELECT * FROM legacy_archive.webxl_verify_gm_delay_amount WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: (userMap, customerMap) => ({ userMap, customerMap }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const cust = ctx.customerMap.get(String(row.com_id));
        if (!cust) return { status: "rejected", reason: "unmapped_customer", legacyPk };
        return { status: "valid", legacyPk, cust, user: ctx.userMap.get(String(row.user_id)) ?? null, payload: row };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_verify_gm_delay (id, customer_id, user_id, legacy_gm_id, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [id, t.cust, t.user, trimOrNull(t.payload.gmid), JSON.stringify(t.payload)],
        );
        return id;
      },
    });
  },
  async invoice_item_pay(client, opts) {
    opts.module = "invoice_item_pay";
    const invMap = new Map(
      (await client.query(`SELECT legacy_id, modern_id::text modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type='invoice' AND legacy_table='webxl_invoice'`)).rows.map(
        (r) => [String(r.legacy_id), r.modern_id],
      ),
    );
    return genericLoop(client, opts, {
      source: "webxl_invoice_item_pay",
      target: "legacy_invoice_item_payments",
      entity: "invoice_item_pay_row",
      selectSql: `SELECT id, inv_item_id, invoice_id, item, pay, method, create_at FROM legacy_archive.webxl_invoice_item_pay WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ invMap }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const inv = ctx.invMap.get(String(row.invoice_id));
        if (!inv) return { status: "rejected", reason: "unmapped_invoice", legacyPk };
        return { status: "valid", legacyPk, inv, payload: row };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_invoice_item_payments (id, invoice_id, legacy_invoice_id, legacy_inv_item_id, item_label, amount, method, paid_at)
           VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            t.inv,
            trimOrNull(t.payload.invoice_id),
            trimOrNull(t.payload.inv_item_id),
            trimOrNull(t.payload.item),
            money(t.payload.pay, "0"),
            trimOrNull(t.payload.method),
            parseTs(t.payload.create_at),
          ],
        );
        return id;
      },
    });
  },
  async posting_keywords(client, opts) {
    opts.module = "posting_keywords";
    const userMap = await loadUserMap(client);
    return genericLoop(client, opts, {
      source: "webxl_posting_keywords",
      target: "product_posting_data",
      entity: "posting_keyword_row",
      selectSql: `SELECT id, user_id, category, title, keywords, descp, date FROM legacy_archive.webxl_posting_keywords WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ userMap }),
      transform(row, ctx) {
        return {
          status: "valid",
          legacyPk: String(row.id),
          user: ctx.userMap.get(String(row.user_id)) ?? null,
          category: trimOrNull(row.category) ?? "Legacy",
          title: trimOrNull(row.title),
          keywords: trimOrNull(row.keywords),
          desc: trimOrNull(row.descp),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.product_posting_data (id, category, title, keywords, description, status, user_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,'Migrated',$6,now(),now())`,
          [id, t.category.slice(0, 500), t.title, t.keywords, t.desc, t.user],
        );
        return id;
      },
    });
  },
  async posting_mimg(client, opts) {
    opts.module = "posting_mimg";
    const userMap = await loadUserMap(client);
    return genericLoop(client, opts, {
      source: "webxl_posting_mimg",
      target: "legacy_posting_main_images",
      entity: "posting_mimg_row",
      selectSql: `SELECT id, img, cat, user_id, create_date FROM legacy_archive.webxl_posting_mimg WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ userMap }),
      transform(row, ctx) {
        return {
          status: "valid",
          legacyPk: String(row.id),
          user: ctx.userMap.get(String(row.user_id)) ?? null,
          cat: trimOrNull(row.cat),
          img: trimOrNull(row.img),
          at: parseTs(row.create_date),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.legacy_posting_main_images (id, user_id, category, image_ref, legacy_created_at) VALUES ($1,$2,$3,$4,$5)`,
          [id, t.user, t.cat, t.img, t.at],
        );
        return id;
      },
    });
  },
  async leave(client, opts) {
    opts.module = "leave";
    const userMap = await loadUserMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return genericLoop(client, opts, {
      source: "webxl_leave",
      target: "leave_requests",
      entity: "leave_row",
      selectSql: `SELECT id, user_id, purpose, leave_type, day, time, st_date, end_date, detail, alternative, dep, dep_comm, hod, create_date
                  FROM legacy_archive.webxl_leave WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ userMap, fallback }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const uid = ctx.userMap.get(String(row.user_id));
        if (!uid) return { status: "rejected", reason: "unmapped_user", legacyPk };
        const from = parseTs(row.st_date) ?? parseTs(row.create_date) ?? new Date();
        const to = parseTs(row.end_date) ?? from;
        return {
          status: "valid",
          legacyPk,
          uid,
          purpose: (trimOrNull(row.purpose) ?? "Legacy leave").slice(0, 500),
          leaveType: mapLeaveType(row.leave_type),
          alt: (trimOrNull(row.alternative) ?? "N/A").slice(0, 500),
          from,
          to,
          time: trimOrNull(row.time),
          desc: trimOrNull(row.detail),
          hod: ctx.userMap.get(String(row.hod)) ?? null,
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.leave_requests (id, user_id, purpose, leave_type, alternative, from_date, to_date, time, description, status, approved_by_user_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Approved',$10,$6,$6)`,
          [id, t.uid, t.purpose, t.leaveType, t.alt, t.from, t.to, t.time, t.desc, t.hod],
        );
        return id;
      },
    });
  },
  async overtime(client, opts) {
    opts.module = "overtime";
    const userMap = await loadUserMap(client);
    return genericLoop(client, opts, {
      source: "webxl_overtime",
      target: "overtime_records",
      entity: "overtime_row",
      selectSql: `SELECT id, user_id, purpose, time, dep, detail, dep_title, type, create_date FROM legacy_archive.webxl_overtime WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ userMap }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const uid = ctx.userMap.get(String(row.user_id));
        if (!uid) return { status: "rejected", reason: "unmapped_user", legacyPk };
        return {
          status: "valid",
          legacyPk,
          uid,
          title: (trimOrNull(row.purpose) ?? trimOrNull(row.dep_title) ?? "Overtime").slice(0, 300),
          mins: parseOvertimeMinutes(row.time),
          detail: (trimOrNull(row.detail) ?? "-").slice(0, 4000),
          date: parseTs(row.create_date) ?? new Date(),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.overtime_records (id, user_id, task_title, time_spent, task_details, date, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'Approved',$6,$6)`,
          [id, t.uid, t.title, t.mins, t.detail, t.date],
        );
        return id;
      },
    });
  },
  async expense(client, opts) {
    opts.module = "expense";
    const userMap = await loadUserMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return genericLoop(client, opts, {
      source: "webxl_expense",
      target: "office_expenses",
      entity: "expense_row",
      selectSql: `SELECT id, phead_id, office, head_id, amount, detail, cheque_id, bill_image, voucher_number, create_date, created_by
                  FROM legacy_archive.webxl_expense WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ userMap, fallback }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const uid = ctx.userMap.get(String(row.created_by)) ?? ctx.fallback;
        if (!uid) return { status: "rejected", reason: "no_user", legacyPk };
        return {
          status: "valid",
          legacyPk,
          uid,
          head: (trimOrNull(row.head_id) ? `Head ${row.head_id}` : "Legacy").slice(0, 200),
          office: (trimOrNull(row.office) ?? "Main").slice(0, 200),
          amount: money(row.amount, "0"),
          voucher: trimOrNull(row.voucher_number),
          detail: trimOrNull(row.detail),
          date: parseTs(row.create_date) ?? new Date(),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.office_expenses (id, expense_head, office, amount, currency, voucher_number, detail, expense_date, created_by_user_id, created_at)
           VALUES ($1,$2,$3,$4,'PKR',$5,$6,($7::timestamptz)::date,$8,$7)`,
          [id, t.head, t.office, t.amount, t.voucher, t.detail, t.date, t.uid],
        );
        return id;
      },
    });
  },
  async complaints(client, opts) {
    opts.module = "complaints";
    const userMap = await loadUserMap(client);
    const customerMap = await loadCustomerMap(client);
    const fallback = (await client.query(`SELECT id::text id FROM drm.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
    return genericLoop(client, opts, {
      source: "webxl_complaints",
      target: "support_tickets",
      entity: "complaint_row",
      selectSql: `SELECT id, ticket_no, com_id, service, user_id, dep, priority, detail, status, create_date, manager_comment, user_comment
                  FROM legacy_archive.webxl_complaints WHERE id::bigint > $1 ORDER BY id::bigint LIMIT $2`,
      buildCtx: () => ({ userMap, customerMap, fallback }),
      transform(row, ctx) {
        const legacyPk = String(row.id);
        const uid = ctx.userMap.get(String(row.user_id)) ?? ctx.fallback;
        if (!uid) return { status: "rejected", reason: "no_user", legacyPk };
        const pri = (trimOrNull(row.priority) ?? "Medium").toLowerCase();
        const priority = pri.includes("high") ? "High" : pri.includes("low") ? "Low" : "Medium";
        const st = (trimOrNull(row.status) ?? "Open").toLowerCase();
        let status = "Open";
        if (st.includes("progress")) status = "InProgress";
        else if (st.includes("resolve") || st.includes("close")) status = "Resolved";
        else if (st.includes("fail")) status = "Failed";
        return {
          status: "valid",
          legacyPk,
          uid,
          cust: ctx.customerMap.get(String(row.com_id)) ?? null,
          subject: (trimOrNull(row.service) ?? trimOrNull(row.ticket_no) ?? `Ticket ${legacyPk}`).slice(0, 500),
          priority,
          ticketStatus: status,
          ref: trimOrNull(row.ticket_no),
          body: [trimOrNull(row.detail), trimOrNull(row.manager_comment), trimOrNull(row.user_comment)].filter(Boolean).join("\n").slice(0, 8000),
          at: parseTs(row.create_date) ?? new Date(),
        };
      },
      async insert(client, t) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO drm.support_tickets (id, customer_id, created_by, channel, subject, status, priority, external_reference, created_at, updated_at)
           VALUES ($1,$2,$3,'web',$4,$5,$6,$7,$8,$8)`,
          [id, t.cust, t.uid, t.subject, t.ticketStatus, t.priority, t.ref, t.at],
        );
        if (t.body) {
          await client.query(`INSERT INTO drm.support_messages (id, ticket_id, "from", body, sent_at) VALUES ($1,$2,'customer',$3,$4)`, [
            crypto.randomUUID(),
            id,
            t.body,
            t.at,
          ]);
        }
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
