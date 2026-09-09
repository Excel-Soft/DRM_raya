import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileSearch, Database, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";

const quickActions = [
    { label: "Duplication Check", icon: FileSearch, href: "/sales/duplicate-checker" },
    { label: "Private Pool", icon: Database, href: "/sales/lead-pools?pool=Private" },
    { label: "Service Pool", icon: Database, href: "/service/pool" },
    { label: "BV Checking", icon: CheckCircle, href: "/service/bv-checking" },
    { label: "Over Time", icon: Clock, href: "/hr/overtime" },
    { label: "Public Pool", icon: Database, href: "/service/public-pool" },
    { label: "New In Service", icon: CheckCircle, href: "/reports/vas" }, // Assuming new in service routes to VAS report or similar, typical in service
];

export function ServiceQuickEntriesCard() {
    return (
        <Card data-testid="card-service-quick-entries">
            <CardHeader>
                <CardTitle className="text-base text-gray-600 dark:text-zinc-300">Quick Enteries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action) => {
                        return (
                            <Link key={action.label} href={action.href}>
                                <div
                                    className="flex items-center justify-between px-3 py-2 bg-slate-50/50 hover:bg-slate-100 border border-slate-100 rounded cursor-pointer transition-colors group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
                                    data-testid={`button-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                    <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-800 tracking-tight dark:text-zinc-300 dark:group-hover:text-zinc-100">{action.label}</span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#059669]" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
