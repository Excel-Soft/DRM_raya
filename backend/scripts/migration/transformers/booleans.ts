export function transformTinyIntBoolean(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "1" || s.toLowerCase() === "true") return true;
  if (s === "0" || s.toLowerCase() === "false") return false;
  return null;
}
