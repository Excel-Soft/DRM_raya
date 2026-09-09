import { apiRequest, extractApiError } from "./queryClient";

/**
 * Error thrown when an authenticated file download fails with a non-2xx
 * response. Carries the HTTP `status` so callers can branch (e.g. show an
 * authorization-specific message on 403).
 */
export class DownloadError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DownloadError";
    this.status = status;
  }
}

/**
 * Download a protected file (CSV / XLSX / PDF export, import template, …) using
 * the app's standard auth headers.
 *
 * It reuses `apiRequest`, so a 401 triggers the same session-expiry redirect as
 * every other request in the app — previously each export hand-rolled its own
 * `fetch(..., { headers: getAuthHeader() })` and silently swallowed expired
 * sessions. On any other non-2xx response it throws a {@link DownloadError}
 * (with a friendly message for 403) that the caller surfaces via a toast.
 *
 * The success path is identical to the inline implementations it replaces:
 * read the body as a Blob, click a temporary object-URL anchor, then revoke it.
 */
export async function downloadAuthedFile(
  url: string,
  filename: string,
  method: string = "GET",
  data?: unknown,
): Promise<void> {
  const res = await apiRequest(method, url, data);

  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    if (res.status === 403) {
      message = "You are not authorized to download this file.";
    } else {
      const body = await res
        .clone()
        .json()
        .catch(() => null);
      if (body) {
        message = extractApiError(body, res.status);
      } else {
        const text = await res.text().catch(() => "");
        if (text) message = text;
      }
    }
    throw new DownloadError(res.status, message);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
