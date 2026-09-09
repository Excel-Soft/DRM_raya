// ---------------------------------------------------------------------------
// Page breadcrumb / title (Stage 2)
//
// A lightweight, registry-driven breadcrumb + page-title pattern for major
// modules. Two ways to use it:
//
//   1. Auto from the current location (uses the route registry):
//        <PageBreadcrumb />
//
//   2. Explicit, when a dynamic page wants a record-specific trail:
//        <PageBreadcrumb items={[{label:"Support", href:"/support/tickets"},
//                               {label: ticket.subject}]} title={ticket.subject} />
//
// This is presentational only and does not affect routing or permissions.
// ---------------------------------------------------------------------------
import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import {
  getBreadcrumbsForPath,
  type Breadcrumb,
} from "@/routes/route-registry";

interface PageBreadcrumbProps {
  /** Explicit trail; when omitted it is derived from the current location. */
  items?: Breadcrumb[];
  /** Optional page title rendered under the trail. Defaults to the last crumb. */
  title?: string;
  className?: string;
}

export function PageBreadcrumb({ items, title, className }: PageBreadcrumbProps) {
  const [location] = useLocation();
  const crumbs = items ?? getBreadcrumbsForPath(location);
  const heading = title ?? crumbs[crumbs.length - 1]?.label;

  return (
    <div className={className ?? "mb-4"}>
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
      >
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-foreground" : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast && <ChevronRight className="h-3 w-3 opacity-50" />}
            </span>
          );
        })}
      </nav>
      {heading && (
        <h1 className="mt-1 text-lg font-semibold text-foreground">{heading}</h1>
      )}
    </div>
  );
}
