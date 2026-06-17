import { RouteInactive } from "@/components/route-states";

// Patch 4 Stage 6 (ISS-02 P2): shown in place of Support pages while the Support
// module is deactivated for the current phase. Prevents direct-URL access from
// rendering ticket/complaint pages (and from crashing) without deleting any code.
export default function SupportInactive() {
  return (
    <RouteInactive
      title="Support module unavailable"
      message="The Support module is currently disabled for this phase. Please contact an administrator if you believe you need access."
      actionHref="/dashboard"
      actionLabel="Back to Dashboard"
    />
  );
}
