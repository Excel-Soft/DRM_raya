import type { Response } from "express";

/**
 * Financial CSV export helper (PATCH 4 Stage 1).
 *
 * Guarantees SAFE serialization and a descriptive, timestamped filename for
 * Office Accounts exports. It never invents data. The CALLER remains
 * responsible for:
 *   1. authenticating + RBAC-gating the request (requireFinancialPermission),
 *   2. applying the SAME filters the on-screen view uses to the query that
 *      produced `rows` (exports must respect active filters), and
 *   3. writing an audit row for the export.
 *
 * See EXPORT_STANDARD.md for the project-wide export rules this enforces.
 */

export interface CsvColumn<Row> {
  header: string;
  /** Cell accessor; return a primitive. null/undefined render as an empty cell. */
  value: (row: Row) => unknown;
}

export interface DateRangeMeta {
  from?: string | Date | null;
  to?: string | Date | null;
}

export interface CsvExportOptions<Row> {
  /** Module/report slug used in the filename, e.g. "office_expenses". */
  module: string;
  columns: CsvColumn<Row>[];
  rows: Row[];
  /** Optional applied date range — embedded in the filename for traceability. */
  range?: DateRangeMeta;
}

/**
 * Safe cell serialization:
 *  1. CSV-injection neutralization — a cell beginning with a formula
 *     metacharacter (`=` `+` `-` `@`, tab or CR) can execute when the file is
 *     opened in Excel/Sheets. Such cells are prefixed with a single quote.
 *     Plain (including negative) numbers are left intact so amounts stay numeric.
 *  2. RFC-4180 quoting — quote when the value contains `"`, comma or a newline.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);

  const trimmed = s.trim();
  const isPlainNumber = trimmed !== "" && Number.isFinite(Number(trimmed));
  if (/^[=+\-@\t\r]/.test(s) && !isPlainNumber) {
    s = `'${s}`;
  }

  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Serialize columns + rows to an RFC-4180 CSV string (CRLF line breaks). */
export function buildCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const head = columns.map((c) => csvEscape(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvEscape(c.value(row))).join(","))
    .join("\r\n");
  return body ? `${head}\r\n${body}` : head;
}

function toYmd(d?: string | Date | null): string | undefined {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

/**
 * Build a descriptive, timestamped filename, e.g.
 *   office_expenses_2026-01-01_2026-01-31_20260616T101500Z.csv
 * The date range (when supplied) and a timestamp make each export traceable
 * and unambiguous.
 */
export function buildExportFilename(
  module: string,
  range?: DateRangeMeta,
): string {
  const safe = module.replace(/[^a-z0-9_-]/gi, "_");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const parts = [safe];
  const from = toYmd(range?.from);
  const to = toYmd(range?.to);
  if (from) parts.push(from);
  if (to) parts.push(to);
  parts.push(stamp);
  return `${parts.join("_")}.csv`;
}

/**
 * Serialize `rows` to CSV and stream them as a file download with a safe,
 * descriptive filename. Returns the row count actually written (useful for the
 * caller's audit entry).
 */
export function sendCsvExport<Row>(
  res: Response,
  opts: CsvExportOptions<Row>,
): number {
  const csv = buildCsv(opts.columns, opts.rows);
  const filename = buildExportFilename(opts.module, opts.range);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
  return opts.rows.length;
}
