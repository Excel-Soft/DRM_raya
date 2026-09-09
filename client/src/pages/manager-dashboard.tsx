import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Users,
  Activity,
  Target,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  RefreshCcw,
  Phone,
  MessageCircle,
  MapPin,
  Mail,
  Users2,
  Video,
  Calendar,
  Handshake,
  FileSearch,
  CalendarClock,
  Timer,
  ClipboardList,
  GaugeCircle,
} from "lucide-react";

type KpiResponse = {
  success: boolean;
  data?: {
    totalLeads: number;
    activeLeads: number;
    closedLeads: number;
    followupsToday: number;
    teamMembers: number;
    renewals: number;
    expiredCustomers: number;
    gradeDistribution: Record<string, number>;
  };
};

type TeamPerformanceItem = {
  userId: string;
  name: string;
  totalCustomers: number;
  newCustomers: number;
  activities: number;
  meetings: number;
  revenue: number;
};

type TeamPerformanceResponse = {
  success: boolean;
  data: {
    performance: TeamPerformanceItem[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  };
};

type ActivitiesSummary = { success: boolean; data: { byType: Record<string, number>; total: number } };
type MeetingsResponse = {
  success: boolean;
  data: { meetings: any[]; total: number; page: number; pageSize: number; totalPages: number };
};
type QueueResponse = {
  success: boolean;
  data: { queue: any[]; total: number; page: number; pageSize: number; totalPages: number };
};

const gradesOrder = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];

export default function ManagerDashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [perfPage, setPerfPage] = useState(1);
  const [perfPageSize, setPerfPageSize] = useState(10);
  const [dateFrom] = useState<Date | null>(null);
  const [dateTo] = useState<Date | null>(null);

  const kpiQuery = useQuery<KpiResponse>({
    queryKey: ["manager-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom.toISOString());
      if (dateTo) params.set("dateTo", dateTo.toISOString());
      const res = await apiRequest("GET", `/api/manager/dashboard/kpis?${params.toString()}`);
      return res.json();
    },
  });

  const perfQuery = useQuery<TeamPerformanceResponse>({
    queryKey: ["team-performance", month, year, perfPage, perfPageSize],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/crm/team-performance?month=${month}&year=${year}&page=${perfPage}&pageSize=${perfPageSize}`,
      );
      return res.json();
    },
  });

  const activitySummaryQuery = useQuery<ActivitiesSummary>({
    queryKey: ["activity-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/manager/dashboard/activities/summary");
      return res.json();
    },
  });

  const meetingsQuery = useQuery<MeetingsResponse>({
    queryKey: ["manager-meetings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/meetings?page=1&pageSize=10");
      return res.json();
    },
  });

  const queueQuery = useQuery<QueueResponse>({
    queryKey: ["manager-queue"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/queue-sales?status=Waiting&page=1&pageSize=10");
      return res.json();
    },
  });

  const kpis = kpiQuery.data?.data;
  const perf = perfQuery.data?.data;
  const activitiesSummary = activitySummaryQuery.data?.data;

  const perfTotalPages = perf?.meta?.totalPages ?? 1;

  const renderCard = (title: string, value: number | string, desc: string, Icon?: any, color = "") => (
    <Card className="rounded-xl shadow-sm h-full">
      <CardContent className="p-4 flex items-start gap-3">
        {Icon && (
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color || "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Dashboard / Sales Department</p>
          <h1 className="text-2xl font-bold">Sales Manager Dashboard</h1>
        </div>
        <Badge variant="outline" className="text-xs">Role: Manager</Badge>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* KPI Cards */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {kpiQuery.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            ) : (
              <>
                {renderCard("Total Leads", kpis?.totalLeads ?? 0, "Count", Target, "bg-emerald-100 text-emerald-700")}
                {renderCard("Active Leads", kpis?.activeLeads ?? 0, "Active", ShieldCheck, "bg-blue-100 text-blue-700")}
                {renderCard("Closed Leads", kpis?.closedLeads ?? 0, "Closed/Renewed", TrendingUp, "bg-purple-100 text-purple-700")}
                {renderCard("Followups Today", kpis?.followupsToday ?? 0, "Due today", CalendarClock, "bg-orange-100 text-orange-700")}
                {renderCard("Team Members", kpis?.teamMembers ?? 0, "Across teams", Users, "bg-gray-100 text-gray-700")}
                {renderCard("Renewals", kpis?.renewals ?? 0, "Renewed", RefreshCcw, "bg-indigo-100 text-indigo-700")}
                {renderCard("Expired Customers", kpis?.expiredCustomers ?? 0, "Expired", AlertTriangle, "bg-red-100 text-red-700")}
                <Card className="rounded-xl shadow-sm md:col-span-2 lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Grade Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {gradesOrder.map((g) => (
                      <Badge key={g} variant="outline" className="text-xs">
                        {g}: {kpis?.gradeDistribution?.[g] ?? 0}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Activities Summary */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2"><CardTitle>Activities Summary</CardTitle></CardHeader>
            <CardContent>
              {activitySummaryQuery.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-sm">
                  {[
                    { key: "mobile", label: "Mobile", icon: Phone },
                    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
                    { key: "onsite", label: "OnSite", icon: MapPin },
                    { key: "email", label: "Email", icon: Mail },
                    { key: "seminar", label: "Seminar", icon: Users2 },
                    { key: "webinar", label: "Webinar", icon: Video },
                    { key: "appointment", label: "Appointment", icon: Calendar },
                    { key: "meeting", label: "Meeting", icon: Handshake },
                  ].map((item) => (
                    <div key={item.key} className="flex flex-col items-center gap-1 rounded border px-2 py-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <item.icon className="h-4 w-4" /> <span>{item.label}</span>
                      </div>
                      <span className="text-base font-semibold">
                        {activitiesSummary?.byType?.[item.key] ?? 0}
                      </span>
                    </div>
                  ))}
                  {(!activitiesSummary || Object.keys(activitiesSummary.byType ?? {}).length === 0) && (
                    <p className="text-muted-foreground text-sm">No activity</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Queue Sales Performance */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Team Queue Sale Performance</CardTitle>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{`Month ${i + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {queueQuery.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueQuery.data?.data?.queue?.length ? queueQuery.data.data.queue.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.salesPersonId}</TableCell>
                        <TableCell>{q.priority}</TableCell>
                        <TableCell>{q.status}</TableCell>
                        <TableCell>{q.assignedAt ? format(new Date(q.assignedAt), "dd MMM") : "-"}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data available</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Team Performance */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Team Performance</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setPerfPage(1); }}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{`Month ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setPerfPage(1); }}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 3 }).map((_, i) => {
                      const y = now.getFullYear() - 1 + i;
                      return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {perfQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>New</TableHead>
                        <TableHead>Activities</TableHead>
                        <TableHead>Meetings</TableHead>
                        <TableHead>Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perf?.performance?.length ? perf.performance.map((p) => (
                        <TableRow key={p.userId}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{p.totalCustomers}</TableCell>
                          <TableCell>{p.newCustomers}</TableCell>
                          <TableCell>{p.activities}</TableCell>
                          <TableCell>{p.meetings}</TableCell>
                          <TableCell>${p.revenue}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
                    <div>Page {perf?.meta?.page ?? perfPage} of {perfTotalPages}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={perfPage <= 1} onClick={() => setPerfPage((p) => Math.max(1, p - 1))}>Prev</Button>
                      <Button variant="outline" size="sm" disabled={perfPage >= perfTotalPages} onClick={() => setPerfPage((p) => Math.min(perfTotalPages, p + 1))}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Meetings */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader><CardTitle>Recent Meetings</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {meetingsQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meetingsQuery.data?.data?.meetings?.length ? meetingsQuery.data.data.meetings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.purpose}</TableCell>
                        <TableCell>{m.dateTime ? format(new Date(m.dateTime), "dd MMM yyyy") : "-"}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No meetings</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="rounded-xl shadow-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <CardHeader>
              <CardTitle>Q4 Sales Push</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              Achieve 120% target for bonus!
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader><CardTitle>Quick Entries</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href="/sales/duplicate-checker" className="flex items-center gap-2 text-primary hover:underline">
                <FileSearch className="h-4 w-4" /> Duplication Check
              </Link>
              <Link href="/hr/leave-request" className="flex items-center gap-2 text-primary hover:underline">
                <CalendarClock className="h-4 w-4" /> Leave Application
              </Link>
              <Link href="/dashboard/manager" className="flex items-center gap-2 text-primary hover:underline">
                <GaugeCircle className="h-4 w-4" /> Performance
              </Link>
              <Link href="/hr/overtime" className="flex items-center gap-2 text-primary hover:underline">
                <Timer className="h-4 w-4" /> Over Time
              </Link>
              <Link href="/pms/tasks" className="flex items-center gap-2 text-primary hover:underline">
                <ClipboardList className="h-4 w-4" /> My Tasks
              </Link>
              <Link href="/reports" className="flex items-center gap-2 text-primary hover:underline">
                <Target className="h-4 w-4" /> Team Targets
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
