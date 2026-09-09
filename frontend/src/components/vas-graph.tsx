import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";

//todo: remove mock functionality
const data = [
  { month: "Jan", target: 30000, achieved: 28500 },
  { month: "Feb", target: 30000, achieved: 31200 },
  { month: "Mar", target: 30000, achieved: 29800 },
  { month: "Apr", target: 30000, achieved: 32400 },
];

export function VasGraph() {
  return (
    <Card data-testid="card-vas-graph">
      <CardHeader>
        <CardTitle className="text-base">VAS Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Bar dataKey="target" fill="hsl(var(--muted))" name="Target" radius={[4, 4, 0, 0]} />
            <Bar dataKey="achieved" fill="hsl(var(--chart-2))" name="Achieved" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
