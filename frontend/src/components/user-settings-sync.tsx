// After login: apply the user's saved theme (light / dark) and color combination from the
// server (Settings page), so they follow the user to any browser.
import { useEffect } from "react";
import { apiRequestJson } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import { applyThemeAccent } from "@/lib/theme-accent";

export function UserSettingsSync() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    let cancelled = false;
    apiRequestJson<{ themeMode: "light" | "dark" | null; themeAccent: string }>("GET", "/api/me/user-settings")
      .then((s) => {
        if (cancelled || !s) return;
        applyThemeAccent(s.themeAccent);
        if (s.themeMode && s.themeMode !== theme) setTheme(s.themeMode);
      })
      .catch(() => { /* keep the local theme */ });
    return () => { cancelled = true; };
    // run once per login
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
