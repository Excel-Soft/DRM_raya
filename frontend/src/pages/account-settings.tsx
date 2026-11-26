// My Settings (user menu → Settings): theme (light / dark + color combination) and the user's
// own "Active" status — others see a green tick when it is on, a red tick when it is off.
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { THEME_ACCENTS, applyThemeAccent, savedThemeAccent } from "@/lib/theme-accent";
import { UserTicksView } from "@/components/user-ticks";

type UserSettings = { themeMode: "light" | "dark" | null; themeAccent: string; statusActive: boolean };

export default function AccountSettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { data } = useQuery<UserSettings>({
    queryKey: ["/api/me/user-settings"],
    queryFn: () => apiRequestJson("GET", "/api/me/user-settings"),
  });
  const accent = data?.themeAccent || savedThemeAccent();
  const statusActive = data?.statusActive ?? true;

  const save = useMutation({
    mutationFn: (patch: Partial<UserSettings>) => apiRequestJson<UserSettings>("PUT", "/api/me/user-settings", patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(["/api/me/user-settings"], saved);
      queryClient.invalidateQueries({ queryKey: ["/api/user-badges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/profile-full"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e?.message, variant: "destructive" }),
  });

  const pickMode = (m: "light" | "dark") => { setTheme(m); save.mutate({ themeMode: m }); };
  const pickAccent = (a: string) => { applyThemeAccent(a); save.mutate({ themeAccent: a }); };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              Active status <UserTicksView active={statusActive} size={16} />
            </h2>
            <p className="text-sm text-muted-foreground">
              When on, admin and other users see a green tick next to your name. When off, they see a red tick.
            </p>
          </div>
          <Switch
            checked={statusActive}
            disabled={save.isPending || !data}
            onCheckedChange={(v) => save.mutate({ statusActive: v })}
            aria-label="Active status"
          />
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Theme</h2>
        <p className="mb-3 text-sm text-muted-foreground">Light or dark mode.</p>
        <div className="flex gap-3">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pickMode(m)}
              className={`flex w-32 flex-col items-center gap-2 rounded-md border p-3 text-sm capitalize ${theme === m ? "border-2 border-slate-900 dark:border-white" : ""}`}
            >
              <span className={`h-10 w-full rounded ${m === "light" ? "bg-white border" : "bg-zinc-900"}`} />
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Color combination</h2>
        <p className="mb-3 text-sm text-muted-foreground">Main color of buttons, badges and highlights.</p>
        <div className="flex flex-wrap gap-3">
          {THEME_ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => pickAccent(a.key)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${accent === a.key ? "border-2 border-slate-900 dark:border-white" : ""}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: a.swatch }}>
                {accent === a.key && <Check className="h-4 w-4 text-white" />}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
