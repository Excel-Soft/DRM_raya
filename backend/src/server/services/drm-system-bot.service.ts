import type { Pool, PoolClient } from "pg";

const HELP_TEXT = `Chat Bot

1 — Hi / Hello : How to get data through this bot.
2 — Active Users : Active DRM users list.
3 — Show Password : Password policy (passwords are never shown in plain text).
4 — Due Payment : Open due payments summary.
5 — User Yearly Leaves : Leaves for a user (example: "User Yearly Leaves Ali 2025").
6 — User Penalties : Penalties for a user (example: "User Penalties 61").
7 — User Current Increment : Latest increment snapshot from archive.

You can also type menu names to get their data: "delay project", "related customer", "promotion", "drm permission", "pms setting", "attributes".\nAdd a name to search, e.g. "related customer Accuram" or "attributes Penalty Head".`;

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function truncateLines(lines: string[], max = 40): string {
  if (lines.length <= max) return lines.join("\n");
  return [...lines.slice(0, max), `… and ${lines.length - max} more.`].join("\n");
}

function extractTailAfterCommand(message: string, prefixes: string[]): string {
  const n = normalize(message);
  for (const p of prefixes) {
    if (n.startsWith(p)) return message.slice(message.toLowerCase().indexOf(p) + p.length).trim();
  }
  return message.replace(/^user\s+(yearly\s+)?leaves/i, "").replace(/^user\s+penalties/i, "").trim();
}

const MENU_HINTS: { keywords: string[]; title: string; path: string }[] = [
  { keywords: ["attribute", "attributes"], title: "Attributes", path: "/drm/attributes" },
  { keywords: ["permission", "drm permission"], title: "DRM Permission", path: "/drm/permission" },
  { keywords: ["promotion"], title: "Promotion", path: "/drm/promotion" },
  { keywords: ["delay", "delay project"], title: "Delay Project", path: "/drm/delay-project" },
  { keywords: ["related", "related customer"], title: "Related Customer", path: "/drm/related-customer" },
  { keywords: ["pms", "assign", "pms setting", "pms project"], title: "PMS Project Setting", path: "/drm/pms-setting" },
  { keywords: ["bot"], title: "Bot System", path: "/drm/bot-system" },
  { keywords: ["due payment", "due payments"], title: "Due Payment Report", path: "/reports/due-payment" },
  { keywords: ["user list", "users list"], title: "Users List", path: "/drm/users/list" },
];

/** GET an internal API as the calling user. Returns { status, body }. */
export type BotApiCaller = (path: string) => Promise<{ status: number; body: any }>;

const fmtDate = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
};
const val = (v: unknown) => (v === null || v === undefined || v === "" || v === "0" ? "—" : String(v));

/** Text after the command words, used as a search term ("related customer accuram" -> "accuram"). */
function searchTerm(raw: string, words: string[]): string {
  let t = raw;
  for (const w of words) t = t.replace(new RegExp(`\\b${w}\\b`, "ig"), " ");
  return t.replace(/\s+/g, " ").trim();
}

async function menuData(n: string, raw: string, callApi: BotApiCaller): Promise<string | null> {
  const get = async (path: string) => {
    const r = await callApi(path);
    if (r.status === 401 || r.status === 403) throw new Error("NO_PERMISSION");
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return r.body;
  };
  try {
    if (n.includes("delay")) {
      const search = searchTerm(raw, ["delay", "delayed", "project", "projects"]);
      const [countsRes, list] = await Promise.all([
        get("/api/drm/delay-projects?counts=1"),
        get(`/api/drm/delay-projects?pageSize=30${search ? `&search=${encodeURIComponent(search)}` : ""}`),
      ]);
      const labels: Record<string, string> = {
        "ab-doc": "AB Doc", "vas-doc": "VAS Doc", hod: "HOD", "dep-not-assign": "Dep Not Assign",
        "not-start": "Task Not Start", "qa-dep": "QA Dep", "vf-dep": "Verification Dep",
      };
      const counts = Object.entries(countsRes?.counts ?? {}).map(([k, v]) => `${labels[k] ?? k}: ${v}`).join(" | ");
      const rows: any[] = list?.rows ?? list?.data ?? [];
      const lines = rows.map((r, i) =>
        `${i + 1}. #${r.id} ${val(r.project)} | ${val(r.company)} | ${val(r.dep)} | deadline ${fmtDate(r.deadline)} | ${val(r.days)} days late`);
      return `Delay Projects (${list?.total ?? rows.length}${search ? ` matching "${search}"` : ""})\n${counts}\n\n${lines.join("\n") || "No delayed projects."}${(list?.total ?? 0) > rows.length ? `\n… showing ${rows.length} of ${list.total}. Add a company or project name to search, e.g. "delay project Haidys".` : ""}`;
    }

    if (n.includes("related")) {
      const search = searchTerm(raw, ["related", "customers?", "customer"]);
      const body = await get(`/api/crm/related-customers?pageSize=30${search ? `&q=${encodeURIComponent(search)}` : ""}`);
      const items: any[] = body?.items ?? [];
      const lines = items.map((r, i) =>
        `${i + 1}. ${val(r.customerName)}${r.companyId ? ` (${r.companyId})` : ""} | ${val(r.personName)} | follow: ${val(r.followStatus)} | invoice: ${val(r.invoiceNumber)} | package: ${val(r.packageType)}${r.isDisabled ? " | disabled" : ""}`);
      return `Related Customers (${body?.total ?? items.length}${search ? ` matching "${search}"` : ""})\n${lines.join("\n") || "No records found."}${(body?.total ?? 0) > items.length ? `\n… showing ${items.length} of ${body.total}. Add a company name to search, e.g. "related customer Accuram".` : ""}`;
    }

    if (n.includes("promotion")) {
      const search = searchTerm(raw, ["promotions?", "promotion"]);
      const body = await get(`/api/drm/promotions?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      const items: any[] = body?.data ?? body?.items ?? [];
      const lines = items.map((p, i) =>
        `${i + 1}. ${val(p.title)} | discount: ${val(p.discount)} | ${val(p.status)}${p.is_active ?? p.isActive ? " | active" : " | inactive"} | ${fmtDate(p.start_date ?? p.startDate)} → ${fmtDate(p.end_date ?? p.endDate)}`);
      return `Promotions (${body?.total ?? items.length})\n${lines.join("\n") || "No promotions found."}`;
    }

    if (n.includes("permission")) {
      const rows: any[] = await get("/api/drm/permissions");
      const lines = (Array.isArray(rows) ? rows : []).map((p, i) =>
        `${i + 1}. ${val(p.name)} | ${p.isActive ? "active" : "inactive"} | ${(p.allowedRoleIds ?? []).length} roles | ${(p.subUrls ?? []).length} sub menus`);
      return `DRM Permissions (${lines.length})\n${lines.join("\n") || "No permissions found."}`;
    }

    if (/\b(pms|assign)\b/.test(n)) {
      const act = await get("/api/pms/setting/activity").catch(() => null);
      const items: any[] = act?.items ?? [];
      if (items.length) {
        const lines = items.slice(0, 30).map((r, i) =>
          `${i + 1}. #${r.id} ${val(r.project)} | ${val(r.company)} | ${val(r.person)} | ${val(r.status)}`);
        return `List of Project Activity (${items.length})\n${lines.join("\n")}${items.length > 30 ? `\n… showing 30 of ${items.length}.` : ""}`;
      }
      const body = await get("/api/pms/department-assignments");
      const lines = (body?.departments ?? []).map((d: any, i: number) =>
        `${i + 1}. ${val(d.name)} | ratio ${val(d.ratio)} | managers: ${(d.managers ?? []).map((m: any) => m.name).join(", ") || "—"}`);
      return `PMS Project Setting — department assignment\n${lines.join("\n") || "No departments found."}`;
    }

    if (n.includes("attribute")) {
      const CATEGORIES = [
        "Company Detail", "Company Business Type", "Service Type", "RC Link", "Source", "Job Designation",
        "Q & A", "Whatsapp Message", "Contact Attribute", "Donation Head", "Penalty Head", "Company Branch",
        "Country", "Govt Leave", "Account Monthly Task",
      ];
      const rest = searchTerm(raw, ["attributes?", "attribute"]).toLowerCase();
      const category = CATEGORIES.find((c) => rest && (c.toLowerCase() === rest || c.toLowerCase().includes(rest)));
      if (!category) {
        return `Attributes — type a category to see its items, e.g. "attributes Penalty Head".\nCategories:\n${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
      }
      const rows: any[] = await get(`/api/attributes/${encodeURIComponent(category)}`);
      const list = Array.isArray(rows) ? rows : [];
      const lines = list.slice(0, 60).map((a, i) =>
        `${i + 1}. ${val(a.name)}${a.amount ? ` | ${a.amount}` : ""}${a.dateLabel ? ` | ${a.dateLabel}` : ""}`);
      return `Attributes — ${category} (${list.length})\n${lines.join("\n") || "No items."}${list.length > 60 ? `\n… showing 60 of ${list.length}.` : ""}`;
    }
  } catch (e: any) {
    if (e?.message === "NO_PERMISSION") return "You do not have permission to see this data.";
    return null;
  }
  return null;
}

export async function handleDrmSystemBotMessage(
  client: Pool | PoolClient,
  message: string,
  _userId?: string,
  callApi?: BotApiCaller,
): Promise<{ response: string; format?: "text" | "html" }> {
  const raw = message.trim();
  if (!raw) {
    return { response: "Type Hi, Hello, or click Get Commands for the command list." };
  }

  // Number shortcuts from the command list ("2" = Active Users, …).
  const NUMBERED: Record<string, string> = {
    "1": "hi", "2": "active users", "3": "show password", "4": "due payment",
    "5": "user yearly leaves", "6": "user penalties", "7": "user current increment",
  };
  const n = NUMBERED[normalize(raw)] ?? normalize(raw);

  if (/^(hi|hello|help|commands?|click here)/.test(n) || n.includes("get commands")) {
    return { response: HELP_TEXT };
  }

  // "active users", "active drm users list", "users list", "user list", "all users" → return the data.
  if (/\bactive\b.*\busers?\b/.test(n) || /\b(users?|employees?|staff) list\b/.test(n) || /^(all )?users$/.test(n)) {
    const roleRows = await client.query(`SELECT name FROM drm.roles`);
    const roleNames = new Map<string, string>();
    for (const r of roleRows.rows) {
      const m = /^(.*?)\s*\[L(\d+)\]\s*$/.exec(String(r.name));
      if (m) roleNames.set(m[2], m[1]);
    }
    const roleLabel = (v: unknown) =>
      String(v || "").split(",").map((s) => s.trim()).filter(Boolean)
        .map((s) => roleNames.get(s) ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
        .join(", ") || "—";
    const { rows } = await client.query(`
      SELECT coalesce(full_name, name, username) AS name,
             email,
             coalesce(role_id, role) AS role,
             branch
      FROM drm.users
      WHERE is_active = true AND coalesce(role_id, '') NOT IN ('54', '54,')
      ORDER BY coalesce(full_name, name, username) ASC NULLS LAST
    `);
    if (!rows.length) {
      return { response: "No active users found." };
    }
    const lines = rows.map(
      (r, i) =>
        `${i + 1}. ${r.name || "—"} | ${r.email || "—"} | ${roleLabel(r.role)}${r.branch ? ` | ${r.branch}` : ""}`,
    );
    return { response: `Active users (${rows.length}):\n${lines.join("\n")}` };
  }

  if (n.includes("show password") || n === "password") {
    return {
      response:
        "Passwords are stored hashed in the new DRM — plain passwords cannot be displayed.\nUse Admin → Users to reset a password.\nLegacy MySQL passwords are not exported for security.",
    };
  }

  if (n.includes("due payment")) {
    const { rows } = await client.query(`
      SELECT p.company_name AS company,
             coalesce(p.paid_amount, 0)::numeric AS paid,
             p.amount::numeric AS total,
             (p.amount - coalesce(p.paid_amount, 0))::numeric AS due
      FROM drm.product_posting_invoices p
      WHERE coalesce(p.paid_amount, 0) > 0
        AND (p.amount - coalesce(p.paid_amount, 0)) > 100
      ORDER BY due DESC
      LIMIT 25
    `);
    if (!rows.length) {
      return { response: "No due payments over $100 found (product posting invoices)." };
    }
    const lines = rows.map(
      (r, i) =>
        `${i + 1}. ${r.company || "—"} | due: $${Number(r.due || 0).toFixed(0)} | paid: $${Number(r.paid || 0).toFixed(0)} / $${Number(r.total || 0).toFixed(0)}`,
    );
    return {
      response: `Due payments (top ${rows.length}):\n${lines.join("\n")}\n\nFull report: /reports/due-payment`,
    };
  }

  if (n.includes("yearly leave") || n.includes("user leave") || /^user yearly leaves/.test(n)) {
    const tail = extractTailAfterCommand(raw, ["user yearly leaves", "user leaves", "yearly leaves"]);
    const yearMatch = tail.match(/\b(20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
    const namePart = tail.replace(/\b20\d{2}\b/g, "").trim();

    let userFilter = "";
    const params: string[] = [year];
    if (namePart.length >= 2) {
      params.push(`%${namePart}%`);
      userFilter = ` AND (u.name ILIKE $2 OR u.user_id = $2)`;
    }

    const archive = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_leave'
      LIMIT 1
    `);
    if (!archive.rows.length) {
      return { response: "Leave archive not available." };
    }

    const { rows } = await client.query(
      `
      SELECT l.leave_type, l.day, l.st_date, l.end_date, l.purpose, u.name AS user_name
      FROM legacy_archive.webxl_leave l
      LEFT JOIN legacy_archive.webxl_user u ON u.user_id = l.user_id
      WHERE (l.st_date LIKE $1 || '%' OR l.end_date LIKE $1 || '%' OR l.create_date LIKE $1 || '%')
      ${userFilter}
      ORDER BY l.create_date DESC NULLS LAST
      LIMIT 40
    `,
      params,
    );
    if (!rows.length) {
      return {
        response: `No leaves found for ${year}${namePart ? ` matching "${namePart}"` : ""}. Try: User Yearly Leaves Ali 2025`,
      };
    }
    const lines = rows.map(
      (r, i) =>
        `${i + 1}. ${r.user_name || "—"} | ${r.leave_type || r.purpose || "Leave"} | ${r.day || "?"} day(s) | ${r.st_date || ""} → ${r.end_date || ""}`,
    );
    return { response: `Leaves ${year}:\n${truncateLines(lines)}` };
  }

  if (n.includes("penalt")) {
    const tail = extractTailAfterCommand(raw, ["user penalties", "penalties"]);
    const idMatch = tail.match(/\d+/);
    let userFilter = "";
    const params: unknown[] = [];
    if (idMatch) {
      params.push(idMatch[0]);
      userFilter = ` AND p.user_id = $1`;
    } else if (tail.length >= 2) {
      params.push(`%${tail}%`);
      userFilter = ` AND u.name ILIKE $1`;
    }

    const { rows } = await client.query(
      `
      SELECT p.amount, p.date, p.head, p.confirm, u.name AS user_name
      FROM legacy_archive.webxl_penalty p
      LEFT JOIN legacy_archive.webxl_user u ON u.user_id = p.user_id
      WHERE 1=1 ${userFilter}
      ORDER BY p.date DESC NULLS LAST, p.id DESC
      LIMIT 40
    `,
      params,
    );
    if (!rows.length) {
      return { response: 'No penalties found. Try: "User Penalties 61" or "User Penalties Ali".' };
    }
    const lines = rows.map(
      (r, i) =>
        `${i + 1}. ${r.user_name || "—"} | ${r.head || "Penalty"} | Rs ${r.amount || "0"} | ${r.date || ""} | ${r.confirm || ""}`,
    );
    return { response: `Penalties:\n${truncateLines(lines)}` };
  }

  if (n.includes("increment")) {
    const tail = extractTailAfterCommand(raw, ["user current increment", "increment"]);
    const idMatch = tail.match(/\d+/);
    let userFilter = "";
    const params: unknown[] = [];
    if (idMatch) {
      params.push(idMatch[0]);
      userFilter = ` AND i.user_id = $1`;
    } else if (tail.length >= 2) {
      params.push(`%${tail}%`);
      userFilter = ` AND u.name ILIKE $1`;
    }

    const { rows } = await client.query(
      `
      SELECT i.target_achievment, i.skills, i.disciplinary, i.feedback, i.create_at, u.name AS user_name
      FROM legacy_archive.webxl_increments i
      LEFT JOIN legacy_archive.webxl_user u ON u.user_id = i.user_id
      WHERE 1=1 ${userFilter}
      ORDER BY i.create_at DESC NULLS LAST
      LIMIT 5
    `,
      params,
    );
    if (!rows.length) {
      return { response: 'No increment records. Try: "User Current Increment 61".' };
    }
    const lines = rows.map((r, idx) => {
      return [
        `#${idx + 1} ${r.user_name || "—"} (${r.create_at || "—"})`,
        `Target: ${r.target_achievment || "—"}`,
        `Skills: ${r.skills || "—"}`,
        `Disciplinary: ${r.disciplinary || "—"}`,
        `Feedback: ${(r.feedback || "—").toString().slice(0, 120)}`,
      ].join("\n");
    });
    return { response: lines.join("\n\n") };
  }

  // Menu commands: answer with the page's data (fetched through the page's own API with the
  // caller's token, so the same permissions apply). Falls back to the link if not possible.
  if (callApi) {
    const data = await menuData(n, raw, callApi);
    if (data) return { response: data };
  }

  for (const hint of MENU_HINTS) {
    if (hint.keywords.some((k) => n.includes(k))) {
      return {
        response: `${hint.title}\nOpen in DRM: ${hint.path}`,
      };
    }
  }

  return {
    response: `I did not understand "${raw}".\n\n${HELP_TEXT}`,
  };
}
