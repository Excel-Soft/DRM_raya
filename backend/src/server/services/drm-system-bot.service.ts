import type { Pool, PoolClient } from "pg";

const HELP_TEXT = `Chat Bot

1 — Hi / Hello : How to get data through this bot.
2 — Active Users : Active DRM users list.
3 — Show Password : Password policy (passwords are never shown in plain text).
4 — Due Payment : Open due payments summary.
5 — User Yearly Leaves : Leaves for a user (example: "User Yearly Leaves Ali 2025").
6 — User Penalties : Penalties for a user (example: "User Penalties 61").
7 — User Current Increment : Latest increment snapshot from archive.

You can also type menu names (e.g. "delay project", "related customer", "pms setting") to get the new-system link.`;

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

export async function handleDrmSystemBotMessage(
  client: Pool | PoolClient,
  message: string,
  _userId?: string,
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
