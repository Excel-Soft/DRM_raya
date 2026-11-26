// Theme color combination (Settings page). Green is the app's own color; the others recolor the
// app's green buttons / badges / sidebar highlight through CSS (index.css, [data-accent=…]).
export const THEME_ACCENTS = [
  { key: "green", label: "Green (default)", swatch: "#00a65a" },
  { key: "blue", label: "Blue", swatch: "#2563eb" },
  { key: "purple", label: "Purple", swatch: "#7c3aed" },
  { key: "orange", label: "Orange", swatch: "#ea580c" },
  { key: "rose", label: "Rose", swatch: "#e11d48" },
  { key: "teal", label: "Teal", swatch: "#0d9488" },
] as const;

const STORAGE_KEY = "themeAccent";

export function applyThemeAccent(accent: string | null | undefined) {
  const key = THEME_ACCENTS.some((a) => a.key === accent) ? String(accent) : "green";
  const root = document.documentElement;
  if (key === "green") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", key);
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
}

export function savedThemeAccent(): string {
  try { return localStorage.getItem(STORAGE_KEY) || "green"; } catch { return "green"; }
}
