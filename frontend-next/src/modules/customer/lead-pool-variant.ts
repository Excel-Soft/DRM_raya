"use client";

import { useEffect, useState } from "react";

/** Mirrors legacy `DynamicPrivatePool` / `DynamicPublicPool` in Vite App.tsx */
export function isServiceRoleFromSession(): boolean {
  if (typeof window === "undefined") return false;
  const roleStr = sessionStorage.getItem("activeRoleId") || sessionStorage.getItem("userRole") || "";
  return roleStr.toLowerCase().replace(/\s+/g, "_").includes("service");
}

export function useLeadPoolVariant(): { ready: boolean; isService: boolean } {
  const [ready, setReady] = useState(false);
  const [isService, setIsService] = useState(false);

  useEffect(() => {
    setIsService(isServiceRoleFromSession());
    setReady(true);
  }, []);

  return { ready, isService };
}
