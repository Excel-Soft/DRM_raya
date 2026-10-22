import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ChevronRight, FileSearch, Database, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const quickActions = [
  { label: "Duplication Check", icon: FileSearch, href: "/sales/duplicate-checker", color: "bg-sky-500" },
  { label: "Services Pool", icon: Database, href: "/sales/lead-pools?pool=Service", color: "bg-violet-500" },
  { label: "Over Time", icon: Clock, href: "/hr/overtime", color: "bg-amber-500" },
  { label: "Private Pool", icon: Database, href: "/sales/lead-pools?pool=Private", color: "bg-rose-500" },
  { label: "BV Checking", icon: CheckCircle, href: "/reports/bv-system", color: "bg-emerald-500" },
  { label: "Public Pool", icon: Database, href: "/sales/lead-pools?pool=Public", color: "bg-indigo-500" },
];

export function QuickEntriesCard() {
  return (
    <Card data-testid="card-quick-entries" className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <Zap className="h-4 w-4" />
          </span>
          Quick Entries
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href}>
              <div
                className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                data-testid={`button-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-white", action.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
