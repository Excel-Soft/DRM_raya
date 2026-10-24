import { LoginForm } from "@/components/auth/login-form";

export default function AuthPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50 via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/30"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgb(16 185 129 / 0.15), transparent 45%), radial-gradient(circle at 80% 0%, rgb(24 24 27 / 0.08), transparent 40%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            WebExcels
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            DRM WebExcels
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Sign in to continue</p>
        </header>

        <div
          data-testid="login-card"
          className="rounded-2xl border border-zinc-200/80 bg-white/95 p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-zinc-900/5 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:ring-white/10 sm:p-8"
        >
          <h2 className="sr-only">Sign in form</h2>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
