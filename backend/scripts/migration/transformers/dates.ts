/** Legacy MySQL date/datetime normalization for modern PG (archive keeps raw text). */

const ZERO_DATE_RE = /^0000-00-00( 00:00:00)?$/;

export type DateTransformResult =
  | { ok: true; value: Date | null; archivedRaw: string | null }
  | { ok: false; reason: string; archivedRaw: string };

export function transformLegacyDateTime(raw: string | null | undefined): DateTransformResult {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null, archivedRaw: null };
  }
  const s = String(raw);
  if (ZERO_DATE_RE.test(s.trim())) {
    return { ok: true, value: null, archivedRaw: s };
  }
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) {
    return { ok: false, reason: "invalid_datetime", archivedRaw: s };
  }
  return { ok: true, value: d, archivedRaw: s };
}

export function transformLegacyDate(raw: string | null | undefined): DateTransformResult {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null, archivedRaw: null };
  }
  const s = String(raw).trim();
  if (s === "0000-00-00") {
    return { ok: true, value: null, archivedRaw: s };
  }
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) {
    return { ok: false, reason: "invalid_date", archivedRaw: s };
  }
  return { ok: true, value: d, archivedRaw: s };
}
