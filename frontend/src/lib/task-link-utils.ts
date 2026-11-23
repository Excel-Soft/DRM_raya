/** Normalize a posted product URL for duplicate comparison (case, trailing slash, www). */
export function normalizeTaskLinkKey(raw: string): string {
  const trimmed = raw.trim();
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

/** New links must be unique among themselves and must not match any already on the task. */
export function validateUniqueTaskLinks(newLinks: string[], alreadySubmitted: string[] = []): string | null {
  const existingKeys = new Set<string>();
  for (const url of alreadySubmitted) {
    const key = normalizeTaskLinkKey(url);
    if (key) existingKeys.add(key);
  }

  const newKeys: string[] = [];
  for (const link of newLinks) {
    const trimmed = link.trim();
    if (!trimmed) continue;
    const key = normalizeTaskLinkKey(trimmed);
    if (existingKeys.has(key)) {
      return `This link is already on this task: "${trimmed}"`;
    }
    if (newKeys.includes(key)) {
      return `You entered the same new link twice: "${trimmed}"`;
    }
    newKeys.push(key);
  }
  return null;
}

/** Every URL in the list must be unique (after normalization). */
export function assertAllTaskLinksUnique(urls: string[]): string | null {
  const keys: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    const key = normalizeTaskLinkKey(trimmed);
    if (!key) continue;
    if (keys.includes(key)) {
      return `Duplicate link: "${trimmed}" appears more than once. Each URL must be unique.`;
    }
    keys.push(key);
  }
  return null;
}