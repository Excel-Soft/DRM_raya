// Admin → Old Data Import. Old DRM keeps running after the 2026-11-04 snapshot; an admin
// uploads a newer MySQL dump of it and scripts/migration/incremental/import_old_dump.py
// merges it into legacy_archive.* (new rows inserted, changed rows updated with the old
// version kept in migration_meta.import_row_history, identical rows skipped).
//
//   GET    /api/admin/legacy-import/runs               list
//   GET    /api/admin/legacy-import/runs/:id           one run incl. full report
//   POST   /api/admin/legacy-import/uploads            {fileName, fileSize} -> run (status uploading)
//   PUT    /api/admin/legacy-import/uploads/:id/chunk?offset=N   raw bytes, appended in order
//   POST   /api/admin/legacy-import/uploads/:id/complete         size check, then starts "check"
//   POST   /api/admin/legacy-import/runs/:id/check | apply | rollback
//   POST   /api/admin/legacy-import/runs/:id/discard   delete the uploaded file (not for applied runs)
//
// Files live in backend/private/legacy-imports — NOT under backend/uploads, which is
// served publicly at /uploads. Admin / super admin only. One job at a time.
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { pool } from "../db";
import { recordAuditLog } from "../services/activity-service";

const STORE_DIR = path.resolve(process.cwd(), "private", "legacy-imports");
const SCRIPT = path.resolve(process.cwd(), "scripts", "migration", "incremental", "import_old_dump.py");
const CHUNK_LIMIT = "16mb";
const MAX_FILE = 4 * 1024 * 1024 * 1024; // 4 GB
const BUSY = ["checking", "applying", "rolling_back"];
const UUID_RE = /^[0-9a-f-]{36}$/i;

function userRoles(req: Request): string[] {
  const u = req.user as any;
  return [u?.activeRoleId, u?.roleId, u?.role, ...(Array.isArray(u?.roles) ? u.roles : [])]
    .filter(Boolean)
    .map((r: string) => String(r).toLowerCase());
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!userRoles(req).some((r) => r === "admin" || r === "super_admin")) {
    return res.status(403).json({ error: "Only admin can import old DRM data" });
  }
  next();
}
const userId = (req: Request) => (req.user as any)?.userId ?? (req.user as any)?.id ?? null;

function pidAlive(pid: number | null | undefined): boolean {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** A job whose process is gone but whose status still says busy -> failed. */
async function reapDeadJobs() {
  const { rows } = await pool.query(
    `SELECT id, pid FROM migration_meta.import_runs WHERE status = ANY($1)`, [BUSY]);
  for (const r of rows) {
    if (!pidAlive(r.pid)) {
      await pool.query(
        `UPDATE migration_meta.import_runs SET status = 'failed', progress = 'Failed',
                error = coalesce(error, 'The import process stopped unexpectedly (server restart?). Run it again.')
          WHERE id = $1 AND status = ANY($2)`, [r.id, BUSY]);
    }
  }
}

async function getRun(id: string) {
  if (!UUID_RE.test(id)) return null;
  const { rows } = await pool.query(`SELECT * FROM migration_meta.import_runs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function startJob(runId: string, mode: "check" | "apply" | "rollback", filePath: string | null) {
  await reapDeadJobs();
  const busy = await pool.query(
    `SELECT id FROM migration_meta.import_runs WHERE status = ANY($1) LIMIT 1`, [BUSY]);
  if (busy.rows[0]) throw Object.assign(new Error("Another import job is already running. Wait for it to finish."), { status: 409 });
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const log = fs.openSync(path.join(STORE_DIR, `${runId}.${mode}.log`), "a");
  const args = [SCRIPT, "--run-id", runId, "--mode", mode];
  if (filePath) args.push("--file", filePath);
  const child = spawn("python3", args, {
    env: { ...process.env },
    detached: true,
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  const busyStatus = { check: "checking", apply: "applying", rollback: "rolling_back" }[mode];
  await pool.query(
    `UPDATE migration_meta.import_runs SET status = $2, pid = $3, error = NULL, progress = 'Starting…' WHERE id = $1`,
    [runId, busyStatus, child.pid ?? null]);
  child.unref();
}

function fail(res: Response, e: any, what: string) {
  const status = e?.status ?? 500;
  if (status >= 500) console.error(`[legacy-import] ${what}:`, e);
  res.status(status).json({ error: e?.status ? e.message : `Failed to ${what}` });
}

export function registerLegacyImportRoutes(app: Express) {
  const base = "/api/admin/legacy-import";

  app.get(`${base}/runs`, requireAdmin, async (_req, res) => {
    try {
      await reapDeadJobs();
      const { rows } = await pool.query(
        `SELECT r.id, r.file_name AS "fileName", r.file_size AS "fileSize", r.status, r.progress, r.error,
                r.created_at AS "createdAt", r.checked_at AS "checkedAt", r.applied_at AS "appliedAt",
                r.rolled_back_at AS "rolledBackAt", r.report->'totals' AS totals, r.report->>'mode' AS "reportMode",
                cu.name AS "createdByName", au.name AS "appliedByName",
                EXISTS (SELECT 1 FROM migration_meta.import_row_history h WHERE h.run_id = r.id) AS "hasChanges"
           FROM migration_meta.import_runs r
           LEFT JOIN drm.users cu ON cu.id = r.created_by
           LEFT JOIN drm.users au ON au.id = r.applied_by
          ORDER BY r.created_at DESC LIMIT 100`);
      res.json(rows);
    } catch (e) { fail(res, e, "list imports"); }
  });

  app.get(`${base}/runs/:id`, requireAdmin, async (req, res) => {
    try {
      const run = await getRun(req.params.id);
      if (!run) return res.status(404).json({ error: "Import not found" });
      res.json({
        id: run.id, fileName: run.file_name, fileSize: run.file_size, status: run.status,
        progress: run.progress, error: run.error, report: run.report, createdAt: run.created_at,
        checkedAt: run.checked_at, appliedAt: run.applied_at, rolledBackAt: run.rolled_back_at,
      });
    } catch (e) { fail(res, e, "load import"); }
  });

  app.post(`${base}/uploads`, requireAdmin, async (req, res) => {
    try {
      const fileName = String(req.body?.fileName ?? "").trim();
      const fileSize = Number(req.body?.fileSize);
      if (!/\.sql$/i.test(fileName)) return res.status(400).json({ error: "Please upload the old DRM MySQL dump (.sql file)" });
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE) {
        return res.status(400).json({ error: "File size must be between 1 byte and 4 GB" });
      }
      fs.mkdirSync(STORE_DIR, { recursive: true });
      const ins = await pool.query(
        `INSERT INTO migration_meta.import_runs (file_name, file_path, file_size, status, created_by, progress)
         VALUES ($1, '', $2, 'uploading', $3, 'Uploading…') RETURNING id`,
        [fileName.slice(0, 255), fileSize, userId(req)]);
      const id = ins.rows[0].id as string;
      const filePath = path.join(STORE_DIR, `${id}.sql`);
      fs.writeFileSync(filePath, "");
      await pool.query(`UPDATE migration_meta.import_runs SET file_path = $2 WHERE id = $1`, [id, filePath]);
      res.status(201).json({ id });
    } catch (e) { fail(res, e, "start upload"); }
  });

  app.put(`${base}/uploads/:id/chunk`, requireAdmin, express.raw({ type: "*/*", limit: CHUNK_LIMIT }), async (req, res) => {
    try {
      const run = await getRun(req.params.id);
      if (!run) return res.status(404).json({ error: "Import not found" });
      if (run.status !== "uploading") return res.status(409).json({ error: "This upload is already finished" });
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: "Empty chunk" });
      const size = fs.statSync(run.file_path).size;
      const offset = Number(req.query.offset);
      // Chunks must arrive in order; a retried chunk that was already written is accepted as-is.
      if (offset + body.length <= size) return res.json({ received: size });
      if (offset !== size) return res.status(409).json({ error: "Chunk out of order", received: size });
      if (size + body.length > Number(run.file_size)) return res.status(400).json({ error: "More data than the declared file size" });
      fs.appendFileSync(run.file_path, body);
      const received = size + body.length;
      await pool.query(`UPDATE migration_meta.import_runs SET progress = $2 WHERE id = $1`,
        [run.id, `Uploading… ${Math.floor((received / Number(run.file_size)) * 100)}%`]);
      res.json({ received });
    } catch (e) { fail(res, e, "save upload chunk"); }
  });

  app.post(`${base}/uploads/:id/complete`, requireAdmin, async (req, res) => {
    try {
      const run = await getRun(req.params.id);
      if (!run) return res.status(404).json({ error: "Import not found" });
      if (run.status !== "uploading") return res.status(409).json({ error: "This upload is already finished" });
      const size = fs.statSync(run.file_path).size;
      if (size !== Number(run.file_size)) {
        return res.status(400).json({ error: `Upload incomplete: ${size} of ${run.file_size} bytes received` });
      }
      await pool.query(`UPDATE migration_meta.import_runs SET status = 'uploaded', progress = 'Uploaded' WHERE id = $1`, [run.id]);
      await startJob(run.id, "check", run.file_path);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "finish upload"); }
  });

  app.post(`${base}/runs/:id/:action(check|apply|rollback|discard)`, requireAdmin, async (req, res) => {
    try {
      const run = await getRun(req.params.id);
      if (!run) return res.status(404).json({ error: "Import not found" });
      const action = req.params.action as "check" | "apply" | "rollback" | "discard";
      const fileExists = !!run.file_path && fs.existsSync(run.file_path);

      if (action === "discard") {
        if (["applied", ...BUSY].includes(run.status)) {
          return res.status(409).json({ error: "An applied or running import can't be discarded (roll it back first)" });
        }
        if (fileExists) fs.unlinkSync(run.file_path);
        await pool.query(`UPDATE migration_meta.import_runs SET status = 'discarded', progress = 'File deleted' WHERE id = $1`, [run.id]);
        return res.json({ ok: true });
      }
      if (action === "check") {
        if (!["uploaded", "checked", "failed", "rolled_back"].includes(run.status)) {
          return res.status(409).json({ error: `Can't check an import that is ${run.status}` });
        }
        if (!fileExists) return res.status(409).json({ error: "The uploaded file is no longer on the server" });
        await startJob(run.id, "check", run.file_path);
      } else if (action === "apply") {
        // Apply only after a successful check, so the admin has seen what will change.
        if (run.status !== "checked") return res.status(409).json({ error: "Run the check first and review the report" });
        if (!fileExists) return res.status(409).json({ error: "The uploaded file is no longer on the server" });
        await pool.query(`UPDATE migration_meta.import_runs SET applied_by = $2 WHERE id = $1`, [run.id, userId(req)]);
        await startJob(run.id, "apply", run.file_path);
      } else {
        // An import that failed half-way may already have changed some tables: roll that back too.
        const partial = run.status === "failed" && (await pool.query(
          `SELECT 1 FROM migration_meta.import_row_history WHERE run_id = $1 LIMIT 1`, [run.id])).rows.length > 0;
        if (run.status !== "applied" && !partial) return res.status(409).json({ error: "Only an imported run can be rolled back" });
        const later = await pool.query(
          `SELECT 1 FROM migration_meta.import_runs WHERE id <> $1 AND status = 'applied' AND applied_at > $2 LIMIT 1`,
          [run.id, run.applied_at ?? run.created_at]);
        if (later.rows[0]) return res.status(409).json({ error: "A later import was applied after this one. Roll back the later import first." });
        await pool.query(`UPDATE migration_meta.import_runs SET rolled_back_by = $2 WHERE id = $1`, [run.id, userId(req)]);
        await startJob(run.id, "rollback", null);
      }
      if (action !== "check") {
        recordAuditLog({
          actorUserId: userId(req) ?? undefined,
          activeRole: userRoles(req)[0],
          action: `legacy_import.${action}`,
          module: "admin",
          entityType: "LegacyImportRun",
          entityId: run.id,
          after: { fileName: run.file_name, totals: run.report?.totals ?? null },
          req,
        }).catch((e) => console.error("[legacy-import] audit log failed:", e));
      }
      res.json({ ok: true });
    } catch (e) { fail(res, e, `${req.params.action} import`); }
  });
}
