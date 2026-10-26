/** Shape from `GET /api/auth/me` — auth.routes.ts */
export type AuthMeResponse = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  roles: string[];
  activeRoleId: string;
  isActive: boolean;
  isImpersonating?: boolean;
};

/** Shape from `POST /api/auth/login` success body — issueAuthPayload + user */
export type LoginResponse = {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    roles: string[];
    activeRoleId: string;
  };
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export type AuthUser = AuthMeResponse;
