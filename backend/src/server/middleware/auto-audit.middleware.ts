// Auto audit: every successful add / edit / update / delete API call (POST, PUT, PATCH, DELETE
// with a 2xx response) is written to drm.activity_logs, so Admin → Audit Logs shows activity
// from every module.
//
// - Requests whose route already wrote its own detailed entry (recordAuditLog) are skipped,
//   so nothing is logged twice (request context via AsyncLocalStorage).
// - Read-only POSTs (search / preview / chat / mark-as-read …) and auth calls are skipped
//   (logins are in drm.login_audit).
// - Secrets in the body (password, token, otp, …) are never stored; long values are cut.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";

type AuditCtx = { audited: boolean };
const als = new AsyncLocalStorage<AuditCtx>();

/** Called by explicit audit writers: this request already has a detailed audit entry. */
export function markRequestAudited(): void {
  const ctx = als.getStore();
  if (ctx) ctx.audited = true;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SKIP_PATHS: RegExp[] = [
  /^\/api\/auth\//,
  /^\/api\/ai\//,
  /^\/api\/copilot\/(ask|conversations|actions\/followup\/propose)/,
  /\/(search|preview|download|diagnose|export)(\/|$)/,
  /\/notifications?(\/|$)/,
  /\/read$/,
];
const SECRET_KEY = /pass(word)?|token|secret|otp|authorization|api[_-]?key|hash/i;
const ID_SEG = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|legacy-[\w-]*\d+)$/i;
const MODULE_NAMES: Record<string, string> = {
  pms: "PMS", drm: "DRM Setting", hr: "HR", gm: "GM", bv: "BV", crm: "CRM", it: "IT", seo: "SEO",
};

function sanitize(v: unknown, depth = 0): unknown {
  if (v == null) return v;
  if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  if (typeof v !== "object") return v;
  if (depth > 3) return "[…]";
  if (Array.isArray(v)) {
    const items = v.slice(0, 20).map((x) => sanitize(x, depth + 1));
    return v.length > 20 ? [...items, `… ${v.length - 20} more`] : items;
  }
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 60)) {
    out[k] = SECRET_KEY.test(k) ? "[hidden]" : sanitize(val, depth + 1);
  }
  return out;
}

const titleCase = (s: string) =>
  MODULE_NAMES[s.toLowerCase()] ?? s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** "/api/account/gm-entries/12/approve" -> module Account, type gm-entries, id 12, action gm-entries.approve */
function describe(method: string, path: string) {
  const segs = path.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const moduleSeg = segs[0] || "api";
  const idSeg = segs.find((s) => ID_SEG.test(s)) ?? null;
  const words = segs.filter((s) => !ID_SEG.test(s));
  const resource = (words.length > 1 ? words[1] : words[0]) || moduleSeg;
  const idIdx = idSeg ? segs.indexOf(idSeg) : -1;
  const tail = segs[segs.length - 1];
  let verb: string;
  if (idIdx >= 0 && idIdx < segs.length - 1 && !ID_SEG.test(tail)) verb = tail;
  else if (idIdx < 0 && words.length > 2 && method === "POST") verb = words[words.length - 1];
  else verb = method === "POST" ? "create" : method === "DELETE" ? "delete" : "update";
  return { module: titleCase(moduleSeg), resourceType: resource, resourceId: idSeg, action: `${resource}.${verb}` };
}

function responseId(body: any): string | null {
  const pick = (o: any) => (o && (typeof o.id === "string" || typeof o.id === "number") ? String(o.id) : null);
  return pick(body) ?? pick(body?.data) ?? pick(body?.item) ?? pick(body?.result) ?? null;
}

export function autoAuditMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = (req.method || "").toUpperCase();
  const path = (req.originalUrl || "").split("?")[0].replace(/\/$/, "");
  if (!MUTATING.has(method) || !path.startsWith("/api/") || SKIP_PATHS.some((re) => re.test(path))) {
    return next();
  }

  const ctx: AuditCtx = { audited: false };
  let resBody: any;
  const origJson = res.json.bind(res);
  res.json = (body: any) => { resBody = body; return origJson(body); };

  res.on("finish", () => {
    try {
      if (ctx.audited || res.statusCode < 200 || res.statusCode >= 300) return;
      const u = req.user as any;
      const actor = u?.impersonatorId || u?.userId;
      if (!actor) return;
      const d = describe(method, path);
      const details = {
        module: d.module,
        source: "auto",
        method,
        path,
        status: res.statusCode,
        activeRole: u?.activeRoleId || u?.roleId,
        ...(u?.impersonatorId ? { impersonatedUserId: u.userId } : {}),
        ip: String(req.ip || "").replace(/^::ffff:/, ""),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
        body: req.is("multipart/form-data") ? "[file upload]" : sanitize(req.body),
      };
      let text = JSON.stringify(details);
      if (text.length > 8000) text = JSON.stringify({ ...details, body: "[too large]" });
      pool.query(
        `INSERT INTO drm.activity_logs (user_id, action, resource_type, resource_id, details)
         SELECT $1::uuid, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM drm.users WHERE id = $1::uuid)`,
        [actor, d.action, d.resourceType, d.resourceId ?? responseId(resBody) ?? "-", text],
      ).catch((err) => console.warn("[auto-audit] write failed:", err?.message));
    } catch (err) {
      console.warn("[auto-audit] failed:", (err as Error)?.message);
    }
  });

  als.run(ctx, () => next());
}
