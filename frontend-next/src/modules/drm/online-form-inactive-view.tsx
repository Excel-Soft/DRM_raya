"use client";

import { DrmRouteInactive } from "@/modules/drm/route-inactive";

export function OnlineFormInactive() {
  return (
    <DrmRouteInactive
      title="Online form unavailable"
      message="The Online Form module is currently disabled for this phase. Please contact an administrator if you believe you need access."
    />
  );
}
