import { FormEvent, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const api = {
  async login(body: { email: string; password: string }) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      let msg = text;
      try {
        const json = JSON.parse(text);
        // Support both the Stage 10 error envelope ({error:{message}, message})
        // and the legacy shape ({error:"string"}).
        msg =
          json?.error?.message ||
          json?.message ||
          (typeof json?.error === "string" ? json.error : "") ||
          msg;
      } catch (e) {
        // ignore
      }
      throw new Error(msg || "Login failed");
    }
    return response.json();
  },
  async signup(body: { fullName: string; email: string; password: string }) {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Sign up failed");
    }
    return response.json();
  },
  async forgotPassword(body: { email: string }) {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json(); // Always returns success: true
  },
  async resetPasswordToken(body: { email: string; token: string; newPassword: string }) {
    const response = await fetch("/api/auth/reset-password-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({} as any));
      const msg =
        json?.error?.message ||
        json?.message ||
        (typeof json?.error === "string" ? json.error : "") ||
        "Password reset failed";
      throw new Error(msg);
    }
    return response.json();
  },
};

const cardClass =
  "max-w-md w-full rounded-3xl border border-border bg-card px-8 py-10 shadow-sm shadow-black/5";

type AuthMode = "login" | "signup" | "forgot-request" | "forgot-reset";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");

  // Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");



  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Surface an expired/invalid-session message set during a forced logout.
  useEffect(() => {
    const msg = sessionStorage.getItem("authMessage");
    if (msg) {
      setError(msg);
      sessionStorage.removeItem("authMessage");
    }
  }, []);

  // Handle URL parameters for password reset link from console
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    const urlEmail = params.get('email');
    const urlToken = params.get('token');

    if (urlMode === 'reset' && urlEmail && urlToken) {
      setMode('forgot-reset');
      setEmail(urlEmail);
      setToken(urlToken);
      toast({
        title: "Reset Link Loaded",
        description: "Enter your new password to reset.",
      });
    }
  }, [toast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        await api.signup({ fullName, email, password });
        // Auto login or switch to login? Let's switch to login for clarity
        setMode("login");
        toast({ title: "Account created", description: "Please sign in with your new account." });
      } else if (mode === "login") {
        const { token, user } = await api.login({ email, password });
        sessionStorage.setItem("token", token);
        if (user?.id) sessionStorage.setItem("userId", user.id);
        if (user?.fullName) sessionStorage.setItem("userName", user.fullName);
        if (user?.role) sessionStorage.setItem("userRole", user.role);
        if (user?.roles && Array.isArray(user.roles)) sessionStorage.setItem("userRoles", JSON.stringify(user.roles));

        // Redirect each role to their specific dashboard
        const role = user?.role?.toLowerCase().replace(/\s+/g, "_") || "";
        const ROLE_DASHBOARDS: Record<string, string> = {
          admin: "/dashboard",
          administrator: "/dashboard",
          super_admin: "/dashboard",
          super_hod: "/dashboard",
          hod: "/dashboard",
          sales_manager: "/dashboard/sales-manager",
          sales_assistant_manager: "/dashboard/sales-assistant-manager",
          sales_executive: "/dashboard/sales-executive",
          account_manager: "/dashboard",
          service_manager: "/dashboard/service-manager",
          service_assistant_manager: "/dashboard/service-manager",
          service_executive: "/dashboard/service-executive",
          developer: "/dashboard/developer",
          dd_manager: "/dashboard/dd-manager",
          dd_executive: "/dashboard/dd-executive",
          product_posting_manager: "/product-posting",
          product_posting_executive: "/product-posting",
          posting_executive: "/product-posting",
          qa_manager: "/qa/manager",
          verification_manager: "/verification/manager",
          reception_manager: "/dashboard/reception",
          software_manager: "/dashboard/software-manager",
          software_executive: "/dashboard/software-executive",
          lead_manager: "/dashboard/lead-manager",
          lead_executive: "/dashboard/lead-executive",
          marketing_manager: "/dashboard/marketing-manager",
        };
        const destination = ROLE_DASHBOARDS[role] || "/dashboard";
        setLocation(destination);
      } else if (mode === "forgot-request") {
        await api.forgotPassword({ email });
        // Move to reset step and guide user to check console
        setMode("forgot-reset");
        toast({
          title: "Reset Link Generated",
          description: "Check the server console for your password reset link!"
        });
      } else if (mode === "forgot-reset") {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        if (password.length < 6) throw new Error("Password must be at least 6 characters");

        await api.resetPasswordToken({ email, token, newPassword: password });
        toast({ title: "Success", description: "Password reset successful. Please sign in." });
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setToken("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const renderTitle = () => {
    switch (mode) {
      case "login": return "Sign In";
      case "signup": return "Sign Up";
      case "forgot-request": return "Reset Password";
      case "forgot-reset": return "New Password";
    }
  };

  const renderSubtitle = () => {
    switch (mode) {
      case "login": return "Welcome Back";
      case "signup": return "Start a new account";
      case "forgot-request": return "Enter your email to get reset link";
      case "forgot-reset": return "Enter reset token from console";
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10">
      <div className={cardClass}>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                {renderSubtitle()}
              </p>
              <h1 className="text-2xl font-semibold text-foreground">
                {renderTitle()}
              </h1>
            </div>
            {(mode === "login" || mode === "signup") && (
              <button
                type="button"
                className="text-sm font-semibold text-blue-600 underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </button>
            )}
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Full Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Talha Ahmed"
                required
              />
            </div>
          )}

          {(mode === "login" || mode === "signup" || mode.startsWith("forgot-")) && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                disabled={mode === "forgot-reset"} // Lock email during flow
              />
            </div>
          )}


          {mode === "forgot-reset" && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Reset Token</label>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from console"
                required
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">Check the server console/terminal for your reset link</p>
            </div>
          )}

          {(mode === "login" || mode === "signup" || mode === "forgot-reset") && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">
                {mode === "forgot-reset" ? "New Password" : "Password"}
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 pr-10 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === "forgot-reset" && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Confirm Password</label>
              <div className="relative mt-1">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 pr-10 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" && "Sign In"}
            {mode === "signup" && "Create Account"}
            {mode === "forgot-request" && "Get Reset Link"}
            {mode === "forgot-reset" && "Reset Password"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-blue-600 underline-offset-4 hover:underline"
              onClick={() => { setMode("forgot-request"); setError(""); }}
            >
              Forgot password? Reset
            </button>
          )}

          {(mode.startsWith("forgot-")) && (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 text-sm text-slate-500 hover:text-foreground dark:text-zinc-400"
              onClick={() => { setMode("login"); setError(""); }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

