/** Parse monetary strings without float rounding (archive stores raw text). */

export type DecimalTransformResult =
  | { ok: true; value: string; archivedRaw: string }
  | { ok: false; reason: string; archivedRaw: string };

export function transformDecimalString(raw: string | null | undefined): DecimalTransformResult {
  if (raw === null || raw === undefined) {
    return { ok: true, value: "0", archivedRaw: "" };
  }
  const s = String(raw).trim();
  if (s === "") {
    return { ok: true, value: "0", archivedRaw: s };
  }
  const cleaned = s.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { ok: false, reason: "non_numeric_decimal", archivedRaw: s };
  }
  return { ok: true, value: cleaned, archivedRaw: s };
}
