/**
 * Legacy asset proxy — files that only exist on the old DRM server.
 *
 * The old DRM serves its uploads over http only (https certificate is invalid), so the
 * https app would block them as mixed content. Each route fetches a file once from the
 * legacy host, caches it under backend/uploads/<cache folder>/, and serves it from here.
 *
 *   GET /api/legacy-assets/posting-data?f=<file>  View Products images   (images only)
 *       <- http://webexcels.pk/drm/assets/posting_data/
 *   GET /api/legacy-assets/user-image?f=<file>    User List photos         (images only)
 *       <- http://webexcels.pk/drm/assets/images/user/
 *   GET /api/legacy-assets/expense-bill?f=<file>  Office Expense receipts (images + PDF)
 *       <- http://webexcels.pk/drm/assets/images/expense_bill/
 *
 * Public on purpose (registered BEFORE the /api auth middleware): <img>/<a> tags cannot
 * send the bearer token, and these are the same files the legacy site already serves
 * publicly. Locked down to a plain file name inside one fixed legacy folder; only the
 * allowed content types are cached/served.
 *
 * The file name is passed as ?f=<name> (not in the path) because nginx's static
 * image-extension rule would otherwise catch any /api/...png URL.
 */
import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";

// Plain file names only (no "/" or ".."). ":" "(" ")" "+" occur in old GM screenshot
// names, e.g. pay_54855_11-03-12:44:50.jpeg.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._ :()+-]{0,199}$/;

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp", ".jfif": "image/jpeg",
  ".pdf": "application/pdf",
};

interface LegacyFolder {
  baseUrl: string;
  cacheDir: string;
  ext: RegExp;
  maxBytes: number;
  /** content-type check for what the legacy host returns */
  okType: (contentType: string) => boolean;
}

const FOLDERS: Record<string, LegacyFolder> = {
  "posting-data": {
    baseUrl: (process.env.LEGACY_POSTING_ASSETS_URL || "http://webexcels.pk/drm/assets/posting_data/").replace(/\/?$/, "/"),
    cacheDir: path.join(process.cwd(), "uploads", "legacy-posting-data"),
    ext: /\.(png|jpe?g|gif|webp|bmp)$/i,
    maxBytes: 15 * 1024 * 1024,
    okType: (t) => t.startsWith("image/"),
  },
  // User List profile photos (legacy webxl_user.picture)
  "user-image": {
    baseUrl: (process.env.LEGACY_USER_IMAGE_URL || "http://webexcels.pk/drm/assets/images/user/").replace(/\/?$/, "/"),
    cacheDir: path.join(process.cwd(), "uploads", "legacy-user-image"),
    ext: /\.(png|jpe?g|gif|webp|bmp)$/i,
    maxBytes: 10 * 1024 * 1024,
    okType: (t) => t.startsWith("image/"),
  },
  // Create GM payment screenshots (legacy webxl_verify_gm.screen_shot)
  "gm-screenshot": {
    baseUrl: (process.env.LEGACY_GM_SCREENSHOT_URL || "http://webexcels.pk/drm/assets/images/gm_payment_screen_short/").replace(/\/?$/, "/"),
    cacheDir: path.join(process.cwd(), "uploads", "legacy-gm-screenshot"),
    ext: /\.(png|jpe?g|gif|webp|bmp|jfif)$/i,
    maxBytes: 15 * 1024 * 1024,
    okType: (t) => t.startsWith("image/") || t.startsWith("application/octet-stream"),
  },
  "expense-bill": {
    baseUrl: (process.env.LEGACY_EXPENSE_BILL_URL || "http://webexcels.pk/drm/assets/images/expense_bill/").replace(/\/?$/, "/"),
    cacheDir: path.join(process.cwd(), "uploads", "legacy-expense-bill"),
    ext: /\.(png|jpe?g|gif|webp|bmp|pdf)$/i,
    maxBytes: 30 * 1024 * 1024,
    okType: (t) => t.startsWith("image/") || t.startsWith("application/pdf") || t.startsWith("application/octet-stream"),
  },
};

// One in-flight download per file, so a page full of thumbnails doesn't fetch twice.
const inflight = new Map<string, Promise<boolean>>();

async function download(folder: LegacyFolder, name: string, target: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const resp = await fetch(folder.baseUrl + encodeURIComponent(name), { signal: ctrl.signal });
    const type = resp.headers.get("content-type") || "";
    if (!resp.ok || !folder.okType(type)) return false;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0 || buf.length > folder.maxBytes) return false;
    await fs.promises.mkdir(folder.cacheDir, { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmp, buf);
    await fs.promises.rename(tmp, target);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function cachePath(folder: LegacyFolder, name: string): string | null {
  if (!SAFE_NAME.test(name) || !folder.ext.test(name) || name.includes("..")) return null;
  const target = path.join(folder.cacheDir, name);
  return path.dirname(target) === folder.cacheDir ? target : null;
}

async function ensureFile(key: string, name: string): Promise<string | null> {
  const folder = FOLDERS[key];
  const target = folder ? cachePath(folder, name) : null;
  if (!folder || !target) return null;
  if (fs.existsSync(target)) return target;
  const jobKey = `${key}/${name}`;
  let job = inflight.get(jobKey);
  if (!job) {
    job = download(folder, name, target).finally(() => inflight.delete(jobKey));
    inflight.set(jobKey, job);
  }
  return (await job) ? target : null;
}

/** Validate a legacy posting_data file name; returns its cache path or null. */
export function legacyPostingCachePath(name: string): string | null {
  return cachePath(FOLDERS["posting-data"], name);
}

/** Make sure a legacy posting_data image is in the local cache; returns its path or null. */
export function ensureLegacyPostingFile(name: string): Promise<string | null> {
  return ensureFile("posting-data", name);
}

export function registerLegacyAssetRoutes(app: Express) {
  for (const key of Object.keys(FOLDERS)) {
    app.get(`/api/legacy-assets/${key}`, async (req: Request, res: Response) => {
      const name = String(req.query.f ?? "");
      if (!cachePath(FOLDERS[key], name)) return res.status(400).json({ error: "Invalid file name" });
      const target = await ensureFile(key, name);
      if (!target) return res.status(404).json({ error: "File not found" });
      res.setHeader("Content-Type", MIME[path.extname(name).toLowerCase()] || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // PDFs open in the browser's viewer instead of downloading.
      res.setHeader("Content-Disposition", `inline; filename="${name.replace(/"/g, "")}"`);
      fs.createReadStream(target).on("error", () => res.status(404).end()).pipe(res);
    });
  }
}
