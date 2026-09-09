import { RouteInactive } from "@/components/route-states";

export default function BotSystemInactive() {
  return (
    <RouteInactive
      title="Bot system unavailable"
      message="The Bot System module is currently disabled for this phase. Please contact an administrator if you believe you need access."
      actionHref="/dashboard"
      actionLabel="Back to Dashboard"
    />
  );
}
