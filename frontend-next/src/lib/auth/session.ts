const TOKEN_KEY = "token";
const USER_NAME_KEY = "userName";
const USER_ROLE_KEY = "userRole";
const USER_ROLES_KEY = "userRoles";
const USER_ID_KEY = "userId";
const AUTH_MESSAGE_KEY = "authMessage";

function safeSession(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return safeSession()?.getItem(TOKEN_KEY) ?? null;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  const actingRole = safeSession()?.getItem(USER_ROLE_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (actingRole) headers["x-acting-role"] = actingRole;
  return headers;
}

export function persistLoginSession(login: {
  token: string;
  user: { id?: string; fullName?: string; role?: string; roles?: string[] };
}): void {
  const s = safeSession();
  if (!s) return;
  s.setItem(TOKEN_KEY, login.token);
  if (login.user.id) s.setItem(USER_ID_KEY, login.user.id);
  if (login.user.fullName) s.setItem(USER_NAME_KEY, login.user.fullName);
  if (login.user.role) s.setItem(USER_ROLE_KEY, login.user.role);
  if (login.user.roles) s.setItem(USER_ROLES_KEY, JSON.stringify(login.user.roles));
}

export function clearSession(): void {
  const s = safeSession();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
  s.removeItem(USER_ID_KEY);
  s.removeItem(USER_NAME_KEY);
  s.removeItem(USER_ROLE_KEY);
  s.removeItem(USER_ROLES_KEY);
}

export function setAuthMessage(message: string): void {
  safeSession()?.setItem(AUTH_MESSAGE_KEY, message);
}

export function consumeAuthMessage(): string | null {
  const s = safeSession();
  if (!s) return null;
  const msg = s.getItem(AUTH_MESSAGE_KEY);
  if (msg) s.removeItem(AUTH_MESSAGE_KEY);
  return msg;
}
