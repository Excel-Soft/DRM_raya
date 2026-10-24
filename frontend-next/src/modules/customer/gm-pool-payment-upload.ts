import { getAuthHeaders } from "@/lib/auth/session";

export async function uploadGmPaymentProof(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/gm-pool/upload-payment-proof", {
    method: "POST",
    credentials: "include",
    headers: { ...getAuthHeaders() },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.error || "Failed to upload payment screenshot");
  }
  if (!json.url) throw new Error("Upload succeeded but no URL returned");
  return json.url;
}
