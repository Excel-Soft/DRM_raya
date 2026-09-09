import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

type StageCode = "LD" | "QF" | "AY" | "IN" | "PM" | "GM" | "BV" | "NC" | "RC" | "EC" | "FW" | "NF";

interface PipelineSummary {
  stages: Record<StageCode, number>;
}

interface TargetRow {
  target: string;
  bonus: string;
  priceTarget: string;
  reward: string;
  kwa: string;
  vas: string;
}

interface TargetsResponse {
  rows: TargetRow[];
}

const stageLabels: Record<StageCode, string> = {
  LD: "LD",
  QF: "QF",
  AY: "AY",
  IN: "IN",
  PM: "PM",
  GM: "GM",
  BV: "BV",
  NC: "NC",
  RC: "RC",
  EC: "EC",
  FW: "FW",
  NF: "NF",
};

export function PipelineSummary({ period = "MC", title = "Target" }: { period?: string, title?: string }) {
  const { data: pipelineData, isLoading: isLoadingPipeline } = useQuery<PipelineSummary>({
    queryKey: [`/api/sales/pipeline-summary?period=${period}`],
  });

  const { data: abTargets, isLoading: isLoadingAB } = useQuery<TargetsResponse>({
    queryKey: ["/api/sales/targets/ab"],
  });

  const { data: vasTargets, isLoading: isLoadingVAS } = useQuery<TargetsResponse>({
    queryKey: ["/api/sales/targets/vas"],
  });

  // Transform pipeline data for chart
  const chartData = pipelineData
    ? Object.keys(stageLabels).map((stage) => ({
      stage,
      count: pipelineData.stages[stage as StageCode] || 0,
      name: stageLabels[stage as StageCode],
    }))
    : [];

  return (
    <Card data-testid="card-pipeline-summary" className="shadow-sm border-border bg-card">
      <Tabs defaultValue="overall" className="w-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/10">
          <CardTitle className="text-xl font-bold text-slate-800 dark:text-zinc-100">{title}</CardTitle>
          <TabsList className="bg-transparent gap-2 p-0 h-auto">
            <TabsTrigger 
              value="overall" 
              data-testid="tab-overall"
              className="data-[state=active]:bg-[#059669] data-[state=active]:text-white data-[state=active]:shadow-md px-6 py-1.5 rounded-[4px] text-slate-500 font-bold transition-all text-[13px]"
            >
              OverAll
            </TabsTrigger>
            <TabsTrigger 
              value="tab" 
              data-testid="tab-ab"
              className="data-[state=active]:bg-[#059669] data-[state=active]:text-white data-[state=active]:shadow-md px-6 py-1.5 rounded-[4px] text-slate-500 font-bold transition-all text-[13px]"
            >
              T-AB
            </TabsTrigger>
            <TabsTrigger 
              value="vas" 
              data-testid="tab-vas"
              className="data-[state=active]:bg-[#059669] data-[state=active]:text-white data-[state=active]:shadow-md px-6 py-1.5 rounded-[4px] text-slate-500 font-bold transition-all text-[13px]"
            >
              T-VAS
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="pt-6">

          <TabsContent value="overall" className="m-0">
            {isLoadingPipeline ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading chart...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-zinc-800" />
                  <XAxis
                    dataKey="stage"
                    className="text-[12px] font-medium"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    className="text-[12px]"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value === 0 ? '' : value}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  >
                    <LabelList dataKey="count" position="top" fill="#94a3b8" fontSize={13} fontWeight={600} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>

          <TabsContent value="tab" className="space-y-4">
            {isLoadingAB ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading AB targets...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Price/Target</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Kwa</TableHead>
                    <TableHead>Vas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abTargets?.rows && abTargets.rows.length > 0 ? (
                    abTargets.rows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.target}</TableCell>
                        <TableCell>{row.bonus}</TableCell>
                        <TableCell>{row.priceTarget}</TableCell>
                        <TableCell>{row.reward}</TableCell>
                        <TableCell>{row.kwa}</TableCell>
                        <TableCell>{row.vas}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="vas" className="space-y-4">
            {isLoadingVAS ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading VAS targets...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Price/Target</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Kwa</TableHead>
                    <TableHead>Vas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vasTargets?.rows && vasTargets.rows.length > 0 ? (
                    vasTargets.rows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.target}</TableCell>
                        <TableCell>{row.bonus}</TableCell>
                        <TableCell>{row.priceTarget}</TableCell>
                        <TableCell>{row.reward}</TableCell>
                        <TableCell>{row.kwa}</TableCell>
                        <TableCell>{row.vas}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
