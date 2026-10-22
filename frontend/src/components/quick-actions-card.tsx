import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, FileText, UserPlus, CalendarPlus, FilePlus2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { CreateManualInvoiceDialog } from "@/components/create-manual-invoice-dialog";
import { TodayAppointment } from "@/components/today-appointment";
import { cn } from "@/lib/utils";

const tileClass =
    "group flex flex-col items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm dark:hover:bg-emerald-950/20 w-full";

function Tile({ icon: Icon, iconBg, label }: { icon: typeof Zap; iconBg: string; label: string }) {
    return (
        <>
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
                <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold leading-tight text-foreground">{label}</span>
        </>
    );
}

export function QuickActionsCard() {
    const [, setLocation] = useLocation();

    return (
        <Card className="rounded-2xl border border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                        <Zap className="h-4 w-4" />
                    </span>
                    Quick Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
                <div className="grid grid-cols-2 gap-3">
                    <CreateManualInvoiceDialog
                        trigger={
                            <button type="button" className={tileClass} data-testid="quick-action-new-invoice">
                                <Tile icon={FileText} iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" label="New Invoice" />
                            </button>
                        }
                    />

                    <Link href="/sales/add-customer">
                        <div className={tileClass} data-testid="quick-action-add-customer">
                            <Tile icon={UserPlus} iconBg="bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400" label="Add Customer" />
                        </div>
                    </Link>

                    <button type="button" className={tileClass} onClick={() => setLocation("/customers/private-pool")} data-testid="quick-action-add-followup">
                        <Tile icon={CalendarPlus} iconBg="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400" label="Add Followup" />
                    </button>

                    <Link href="/sales/quotation">
                        <div className={tileClass} data-testid="quick-action-add-quotation">
                            <Tile icon={FilePlus2} iconBg="bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" label="Add Quotation" />
                        </div>
                    </Link>
                </div>

                <div className="border-t border-border pt-3">
                    <TodayAppointment />
                </div>
            </CardContent>
        </Card>
    );
}
