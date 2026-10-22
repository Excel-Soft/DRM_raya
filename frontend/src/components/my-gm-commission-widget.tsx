import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

// PLACEHOLDER: the real my-gm-commission-widget implementation was missing
// from this checkout (imported by sales-executive-dashboard.tsx but absent
// from src/components). Replace with the real implementation once restored.
export function MyGmCommissionWidget() {
  return (
    <Card className="shadow-none border-0 bg-transparent">
      <CardHeader className="px-0 pt-0 pb-3">
        <CardTitle className="text-sm font-bold tracking-tight text-foreground">My GM Commission</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 px-0 pb-0 pt-0 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Wallet className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          This widget is a placeholder — the real my-gm-commission-widget implementation is missing from this checkout.
        </p>
      </CardContent>
    </Card>
  );
}
