import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// PLACEHOLDER: the real my-gm-commission-widget implementation was missing
// from this checkout (imported by sales-executive-dashboard.tsx but absent
// from src/components). Replace with the real implementation once restored.
export function MyGmCommissionWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My GM Commission</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This widget is a placeholder — the real my-gm-commission-widget implementation is missing from this checkout.
        </p>
      </CardContent>
    </Card>
  );
}
