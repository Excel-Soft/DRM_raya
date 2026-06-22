import { apiRequest } from "./queryClient";

/**
 * Patch 2 Stage 1 — shared report query/export helpers.
 *
 * These exist so report pages share one honest path for building query params,
 * validating filters, and exporting. Exports NEVER save an error envelope as a
 * file: a non-2xx response (or a JSON body where a file was expected) throws
 * instead of producing a fake download.
 */

export type ReportFilterValue = string | number | boolean | null | undefined;

export interface FilterValidation {
  valid: boolean;
  message?: string;
}

/**
 * Build a URL query string from a filter object, skipping empty/undefined/null
 * values so omitted filters do not turn into `?x=undefined`.
 */
export function buildReportQueryParams(filters: Record<string, ReportFilterValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    const str = String(value);
    if (str === "") continue;
    params.set(key, str);
  }
  return params.toString();
}

/**
 * Validate that `start <= end`. Empty inputs are treated as "no constraint" and
 * pass. Invalid date strings fail.
 */
export function validateDateRange(start?: string, end?: string): FilterValidation {
  if (!start && !end) return { valid: true };
  if (start && end) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return { valid: false, message: "Enter a valid start and end date." };
    }
    if (s.getTime() > e.getTime()) {
      return { valid: false, message: "Start date must be on or before the end date." };
    }
  }
  return { valid: true };
}

/** Validate that a required filter has a non-empty value. */
export function validateRequiredFilter(value: ReportFilterValue, label: string): FilterValidation {
  const empty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");
  return empty ? { valid: false, message: `${label} is required.` } : { valid: true };
}

/**
 * Build a safe export filename from the report name and active context
 * (date range, user, branch). Always slugified; never produces path separators.
 */
export function safeReportFilename(
  reportName: string,
  opts?: { from?: string; to?: string; user?: string; branch?: string; ext?: string; timestamp?: boolean },
): string {
  const slug = (s: string) =>
    s
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [slug(reportName) || "report"];
  if (opts?.user) parts.push(slug(opts.user));
  if (opts?.branch) parts.push(slug(opts.branch));
  if (opts?.from || opts?.to) {
    parts.push(`${opts?.from || "start"}_to_${opts?.to || "end"}`);
  }
  if (opts?.timestamp) {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    parts.push(
      `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
        `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
    );
  }
  const ext = (opts?.ext || "csv").replace(/[^a-z0-9]/gi, "") || "csv";
  return `${parts.filter(Boolean).join("_")}.${ext}`;
}

export interface DownloadReportExportOptions {
  url: string;
  filename: string;
  method?: string;
  filters?: Record<string, ReportFilterValue>;
}

/**
 * Download a report export from the backend. Includes all active `filters` in
 * the request. Throws (does NOT download) when the response is not OK or when a
 * JSON error envelope is returned where a file was expected — so the caller can
 * surface a real error instead of saving a fake `.csv`.
 */
export async function downloadReportExport(opts: DownloadReportExportOptions): Promise<void> {
  const query = opts.filters ? buildReportQueryParams(opts.filters) : "";
  const fullUrl = query
    ? `${opts.url}${opts.url.includes("?") ? "&" : "?"}${query}`
    : opts.url;

  const res = await apiRequest(opts.method || "GET", fullUrl);

  if (!res.ok) {
    let message = `Export failed (${res.status}).`;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await res.json();
        message = body?.error?.message || body?.message || message;
      }
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    // A JSON body on a 2xx is not a file — never save it as a download.
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || body?.message || "Export did not return a file.");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
