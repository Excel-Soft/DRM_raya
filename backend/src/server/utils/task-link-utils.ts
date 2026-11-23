export function normalizeTaskLinkKey(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "";
    const port =
      u.port && !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80"))
        ? `:${u.port}`
        : "";
    return `${u.protocol}//${host}${port}${path}${u.search}${u.hash}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

export function taskLinkDuplicateMessage(
  description: string,
  existingDescriptions: string[],
): string | null {
  const key = normalizeTaskLinkKey(description);
  if (!key) return null;
  const seen = new Set<string>();
  for (const other of existingDescriptions) {
    const otherKey = normalizeTaskLinkKey(other);
    if (otherKey) seen.add(otherKey);
  }
  if (seen.has(key)) {
    return "This link is already submitted for this task. Each URL must be unique.";
  }
  return null;
}