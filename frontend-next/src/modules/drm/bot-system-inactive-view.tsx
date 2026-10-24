"use client";

import { DrmRouteInactive } from "@/modules/drm/route-inactive";

export function BotSystemInactive() {
  return (
    <DrmRouteInactive
      title="Bot system unavailable"
      message="The Bot System module is currently disabled for this phase. Please contact an administrator if you believe you need access."
    />
  );
}
