import { z } from "zod";

const serverEnvSchema = z.object({
  BACKEND_URL: z
    .string()
    .url()
    .optional()
    .describe("Express API origin for rewrites and server-side fetches"),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Validated server-only env (safe to call from Server Components / build). */
export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    BACKEND_URL: process.env.BACKEND_URL,
  });
}

/** Validated public env (`NEXT_PUBLIC_*` only). */
export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}

/** Default Express origin aligned with legacy Vite proxy (`frontend/vite.config.ts`). */
export function getBackendUrl(): string {
  const { BACKEND_URL } = getServerEnv();
  return (BACKEND_URL ?? "http://localhost:5001").replace(/\/$/, "");
}
