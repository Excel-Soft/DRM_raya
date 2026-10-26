"use client";

import { DrmRouteInactive } from "@/modules/drm/route-inactive";

export function FbPostInactive() {
  return (
    <DrmRouteInactive
      title="FB Post unavailable"
      message="The FB Post module is currently disabled for this phase. Please contact an administrator if you believe you need access."
    />
  );
}
