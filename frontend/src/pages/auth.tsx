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
          super_hod: "/dashboard/super-hod",
          hod: "/dashboard/hod",
          sales_manager: "/dashboard/sales-manager",
          sales_assistant_manager: "/dashboard/sales-assistant-manager",
          sales_executive: "/dashboard/sales-executive",
          account_manager: "/dashboard/account-manager",
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
          it_manager: "/dashboard/it-manager",
          it_executive: "/dashboard/it-executive",
          seo_smm_manager: "/dashboard/seo-smm",
          seo_smm_executive: "/dashboard/seo-smm-executive",
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
    <div 
      className="flex min-h-screen w-full items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-10 font-['Poppins']"
      style={{ backgroundImage: `url('/images/bg.jpg')` }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
      
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {renderTitle()}
            </h1>
            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-emerald-400">
              {renderSubtitle()}
            </p>
          </div>
          
          {(mode === "login" || mode === "signup") && (
            <div className="flex justify-center mt-2">
              <span className="text-xs text-slate-300 mr-2">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-white hover:text-emerald-400 transition-colors"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Create one" : "Sign in instead"}
              </button>
            </div>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-slate-400 shadow-sm backdrop-blur-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
          )}

          {(mode === "login" || mode === "signup" || mode.startsWith("forgot-")) && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-slate-400 shadow-sm backdrop-blur-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                disabled={mode === "forgot-reset"}
              />
            </div>
          )}

          {mode === "forgot-reset" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Reset Token</label>
              <input
                type="text"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-slate-400 shadow-sm backdrop-blur-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token here"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">Check the server console for your reset link</p>
            </div>
          )}

          {(mode === "login" || mode === "signup" || mode === "forgot-reset") && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  {mode === "forgot-reset" ? "New Password" : "Password"}
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-[11px] text-slate-400 hover:text-white transition-colors"
                    onClick={() => { setMode("forgot-request"); setError(""); }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-400 shadow-sm backdrop-blur-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
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
              <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-400 shadow-sm backdrop-blur-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-white/20" />
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" && "Sign In"}
              {mode === "signup" && "Create Account"}
              {mode === "forgot-request" && "Get Reset Link"}
              {mode === "forgot-reset" && "Reset Password"}
            </button>
          </div>

          {(mode.startsWith("forgot-")) && (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mt-4"
              onClick={() => { setMode("login"); setError(""); }}
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

