import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";

//todo: remove mock functionality
const mockData = [
  { date: "Mon", leadsAdded: 12, qualified: 8, analyzed: 6, invoices: 4, payments: 3, memberships: 2 },
  { date: "Tue", leadsAdded: 15, qualified: 10, analyzed: 8, invoices: 5, payments: 4, memberships: 3 },
  { date: "Wed", leadsAdded: 10, qualified: 7, analyzed: 5, invoices: 3, payments: 2, memberships: 2 },
  { date: "Thu", leadsAdded: 18, qualified: 12, analyzed: 10, invoices: 7, payments: 5, memberships: 4 },
  { date: "Fri", leadsAdded: 14, qualified: 9, analyzed: 7, invoices: 5, payments: 4, memberships: 3 },
  { date: "Sat", leadsAdded: 8, qualified: 5, analyzed: 4, invoices: 2, payments: 1, memberships: 1 },
  { date: "Sun", leadsAdded: 6, qualified: 4, analyzed: 3, invoices: 2, payments: 1, memberships: 1 },
];

export function PerformanceGraph() {
  return (
    <Card data-testid="card-performance-graph">
      <CardHeader>
        <CardTitle>Lead Progression</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="leadsAdded" stroke="hsl(var(--chart-1))" name="Leads Added" strokeWidth={2} />
            <Line type="monotone" dataKey="qualified" stroke="hsl(var(--chart-2))" name="Qualified" strokeWidth={2} />
            <Line type="monotone" dataKey="analyzed" stroke="hsl(var(--chart-3))" name="Analyzed" strokeWidth={2} />
            <Line type="monotone" dataKey="invoices" stroke="hsl(var(--chart-4))" name="Invoices" strokeWidth={2} />
            <Line type="monotone" dataKey="payments" stroke="hsl(var(--chart-5))" name="Payments" strokeWidth={2} />
            <Line type="monotone" dataKey="memberships" stroke="hsl(var(--primary))" name="Memberships" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
