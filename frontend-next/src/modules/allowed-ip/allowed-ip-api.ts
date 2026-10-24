/** Parse Express settings API error bodies (legacy allowed-ip-list parity). */
export async function readSettingsError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
      return (body as { error: string }).error;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export type AllowedIpForm = {
  ip_cidr: string;
  description: string;
  is_active: boolean;
};
