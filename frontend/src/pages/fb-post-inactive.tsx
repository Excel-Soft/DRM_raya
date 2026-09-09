import { RouteInactive } from "@/components/route-states";

export default function FbPostInactive() {
  return (
    <RouteInactive
      title="Facebook posting unavailable"
      message="The Facebook Post module is currently disabled for this phase. Please contact an administrator if you believe you need access."
      actionHref="/dashboard"
      actionLabel="Back to Dashboard"
    />
  );
}
