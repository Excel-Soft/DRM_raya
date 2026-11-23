// GM type (old DRM `renwal` code) → label, same mapping as Create GM
// (account-gm-entries.tsx) and the reports API: 1 New, 0 Rc, 2 Ec, 3 Rc-Up, 4 Kwa,
// any other code → None. Text that is already a label (e.g. "New", "Rc") is kept.
const GM_TYPE_BY_CODE: Record<string, string> = { "1": "New", "0": "Rc", "2": "Ec", "3": "Rc-Up", "4": "Kwa" };

export function gmTypeLabel(value: unknown): string {
  if (value === null || value === undefined) return "None";
  const v = String(value).trim();
  if (v === "") return "None";
  if (/^-?\d+$/.test(v)) return GM_TYPE_BY_CODE[String(Number(v))] ?? "None";
  return v;
}
