import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { FileSearch, Database, CheckCircle, Clock } from "lucide-react";

const actions = [
  {
    label: "Duplicate Check",
    icon: FileSearch,
    variant: "outline" as const,
    href: "/sales/duplicate-checker",
  },
  {
    label: "Add to Private Pool",
    icon: Database,
    variant: "outline" as const,
    href: "/sales/lead-pools?pool=Private",
  },
  {
    label: "Add to Service Pool",
    icon: Database,
    variant: "outline" as const,
    href: "/sales/lead-pools?pool=Service",
  },
  {
    label: "BV Pool",
    icon: CheckCircle,
    variant: "outline" as const,
    href: "/sales/lead-pools?pool=GMBV",
  },
  {
    label: "Overtime Request",
    icon: Clock,
    variant: "default" as const,
    href: "/hr/overtime",
  },
];

export function QuickActions() {
  const [, navigate] = useLocation();
  return (
    <Card data-testid="card-quick-actions">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant={action.variant}
              className="w-full justify-start gap-2"
              onClick={() => action.href && navigate(action.href)}
              data-testid={`button-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon className="w-4 h-4" />
              {action.label}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
