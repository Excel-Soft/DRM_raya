// ---------------------------------------------------------------------------
// Route state components (Stage 2)
//
// Lightweight, reusable states for dynamic routes (e.g. /support/tickets/:id):
//   - RouteLoading      → data is being fetched
//   - RouteInvalidId    → the URL parameter is missing or malformed
//   - RouteNotFound     → the record does not exist (or the request errored)
//   - RouteUnauthorized → the user may not view this record
//   - RouteInactive     → the record exists but is deleted/inactive
//
// These reuse the existing Card/Button design language and do NOT change any
// business logic — pages opt in by rendering the appropriate state.
// ---------------------------------------------------------------------------
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  AlertCircle,
  Loader2,
  Lock,
  SearchX,
  Archive,
  type LucideIcon,
} from "lucide-react";

export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex h-full min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-label={label}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

interface RouteStateProps {
  title: string;
  message: string;
  icon: LucideIcon;
  iconClassName?: string;
  /** Optional action; defaults to a "Go back" link to the home dashboard. */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

function RouteState({
  title,
  message,
  icon: Icon,
  iconClassName = "text-red-500",
  actionLabel = "Back to Dashboard",
  actionHref = "/",
  onAction,
}: RouteStateProps) {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <Icon className={`h-10 w-10 ${iconClassName}`} />
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {onAction ? (
            <Button variant="outline" onClick={onAction} data-testid="button-route-state-action">
              {actionLabel}
            </Button>
          ) : (
            <Button asChild variant="outline" data-testid="button-route-state-action">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function RouteInvalidId({
  message = "The link is missing a valid identifier. Please open this page from a list instead of typing the address directly.",
  ...rest
}: Partial<RouteStateProps>) {
  return (
    <RouteState
      title="Invalid link"
      message={message}
      icon={AlertCircle}
      iconClassName="text-amber-500"
      {...rest}
    />
  );
}

export function RouteNotFound({
  message = "We couldn't find the record you're looking for. It may have been moved or removed.",
  ...rest
}: Partial<RouteStateProps>) {
  return (
    <RouteState
      title="Not found"
      message={message}
      icon={SearchX}
      iconClassName="text-red-500"
      {...rest}
    />
  );
}

export function RouteUnauthorized({
  message = "You don't have permission to view this record.",
  ...rest
}: Partial<RouteStateProps>) {
  return (
    <RouteState
      title="Access denied"
      message={message}
      icon={Lock}
      iconClassName="text-red-500"
      {...rest}
    />
  );
}

export function RouteInactive({
  message = "This record is inactive or has been archived and can no longer be edited.",
  ...rest
}: Partial<RouteStateProps>) {
  return (
    <RouteState
      title="Record unavailable"
      message={message}
      icon={Archive}
      iconClassName="text-muted-foreground"
      {...rest}
    />
  );
}
