"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readStoredTheme,
  writeStoredTheme,
  type ThemePreference,
} from "@/lib/theme/theme-storage";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
  toggleLightDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveFromPreference(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemDark ? "dark" : "light";
}

function applyResolvedToDocument(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredTheme());
  const [systemDark, setSystemDark] = useState(readSystemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = useMemo(
    () => resolveFromPreference(preference, systemDark),
    [preference, systemDark],
  );

  useEffect(() => {
    applyResolvedToDocument(resolved);
  }, [resolved]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      writeStoredTheme(next);
      const nextResolved = resolveFromPreference(next, systemDark);
      applyResolvedToDocument(nextResolved);
      setPreferenceState(next);
    },
    [systemDark],
  );

  const toggleLightDark = useCallback(() => {
    const nextResolved = resolved === "dark" ? "light" : "dark";
    setPreference(nextResolved);
  }, [resolved, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggleLightDark }),
    [preference, resolved, setPreference, toggleLightDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
