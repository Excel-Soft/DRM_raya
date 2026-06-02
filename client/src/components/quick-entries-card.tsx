import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileSearch, Database, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { TodayAppointment } from "@/components/today-appointment";

const quickActions = [
  { label: "Duplication Check", icon: FileSearch, href: "/sales/duplicate-checker" },
  { label: "Services Pool", icon: Database, href: "/sales/lead-pools?pool=Service" },
  { label: "Over Time", icon: Clock, href: "/hr/overtime" },
  { label: "Private Pool", icon: Database, href: "/sales/lead-pools?pool=Private" },
  { label: "BV Checking", icon: CheckCircle, href: "/sales/lead-pools?pool=GMBV" },
  { label: "Public Pool", icon: Database, href: "/sales/lead-pools?pool=Public" },
];

export function QuickEntriesCard() {
  return (
    <Card data-testid="card-quick-entries">
      <CardHeader>
        <CardTitle className="text-base">Quick Entries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href}>
              <Button
                variant="ghost"
                className="w-full justify-between hover-elevate"
                data-testid={`button-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{action.label}</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          );
        })}

        <div className="border-t pt-3">
          <TodayAppointment />
        </div>
      </CardContent>
    </Card>
  );
}
