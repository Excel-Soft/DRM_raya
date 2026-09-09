import { RouteInactive } from "@/components/route-states";

export default function OnlineFormInactive() {
  return (
    <RouteInactive
      title="Online form unavailable"
      message="The Online Form module is currently disabled for this phase. Please contact an administrator if you believe you need access."
      actionHref="/dashboard"
      actionLabel="Back to Dashboard"
    />
  );
}
