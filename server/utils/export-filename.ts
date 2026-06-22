/**
 * Patch 6 Stage 8 — shared export-filename builder.
 *
 * Enforces EXPORT_STANDARD.md rule 4 server-side: an export filename always
 * carries the report name + (date range / period where relevant) + (user /
 * branch where relevant) + a UTC timestamp, so two exports of the same report
 * never collide and every download is self-describing. Slugged so it can never
 * contain path separators or quote characters that would break the
 * Content-Disposition header.
 *
 * The visible filename in the browser is set client-side (`a.download`); this
 * helper gives the SAME standard to the server Content-Disposition so direct /
 * API / curl consumers get an equally descriptive name.
 */

function coerce(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

/** Report token: keep [a-z0-9_] (so e.g. `bv_report` survives verbatim). */
function slugReport(s: string): string {
  return (
    s
      .replace(/[^a-z0-9_]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "report"
  );
}

/** Data-derived part (user / branch): hyphen-slug, lower-case. */
function slugPart(s: string): string {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Date / period part: keep digits, letters and hyphens only. */
function safeRange(s: string): string {
  return s.replace(/[^0-9a-zA-Z-]/g, "").slice(0, 24);
}

/** Compact UTC timestamp, e.g. `20260622-174500`. */
export function exportTimestamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

export interface ExportFilenameOptions {
  from?: unknown;
  to?: unknown;
  user?: unknown;
  branch?: unknown;
  ext?: string;
}

/**
 * Build a standard, timestamped export filename.
 *
 * @param report A filename-safe report token (e.g. `raw_attendance`,
 *   `salary_report`, `bv_report`). Passed through verbatim where possible.
 */
export function buildExportFilename(report: string, opts?: ExportFilenameOptions): string {
  const parts = [slugReport(report)];

  const user = coerce(opts?.user);
  const branch = coerce(opts?.branch);
  const from = coerce(opts?.from);
  const to = coerce(opts?.to);

  if (user) parts.push(`user-${slugPart(user).slice(0, 16) || "all"}`);
  if (branch) parts.push(`branch-${slugPart(branch) || "all"}`);
  if (from && to) parts.push(`${safeRange(from)}_${safeRange(to)}`);
  else if (from) parts.push(safeRange(from));
  else if (to) parts.push(safeRange(to));

  parts.push(exportTimestamp());

  const ext = (opts?.ext || "csv").replace(/[^a-z0-9]/gi, "") || "csv";
  return `${parts.join("_")}.${ext}`;
}
