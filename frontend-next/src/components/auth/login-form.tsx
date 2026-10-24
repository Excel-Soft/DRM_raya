"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth/auth-api";
import { consumeAuthMessage, persistLoginSession } from "@/lib/auth/session";
import { useAuth } from "@/providers/auth-provider";
import { getDefaultDashboardPath } from "@/lib/auth/role-dashboards";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/lib/toast";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-emerald-500 dark:focus-visible:ring-emerald-500/30";

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42M9.88 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.45 18.45 0 0 1-4.06 5.06M6.12 6.12A18.45 18.45 0 0 0 2 12s3.5 7 10 7a10.94 10.94 0 0 0 4.76-1.12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { applyLogin, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const initialMessage = useMemo(() => consumeAuthMessage() ?? "", []);
  const [error, setError] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const errorId = useId();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (initialMessage) toast.error(initialMessage);
  }, [initialMessage]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const trimmedEmail = email.trim();
    try {
      const payload = await login(trimmedEmail, password);
      persistLoginSession(payload);
      applyLogin({
        token: payload.token,
        user: {
          id: payload.user.id,
          fullName: payload.user.fullName,
          email: payload.user.email,
          role: payload.user.role,
          roles: payload.user.roles,
          activeRoleId: payload.user.activeRoleId,
          isActive: true,
        },
      });
      router.replace(getDefaultDashboardPath(payload.user.activeRoleId));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
      aria-busy={loading}
      noValidate={false}
    >
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email address
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          disabled={loading}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={cn(inputClassName, "pr-11")}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label={showPassword ? "Hide typed characters" : "Show typed characters"}
            aria-pressed={showPassword}
          >
            {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
