import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/team-report/link-report";

interface ReportUser {
  id: string;
  name: string;
  fullName?: string | null;
  email?: string;
}

interface LinkRow {
  id: string;
  displayId: string;
  company: string;
  links: string;
  date: string | null;
  sourceModule: string;
  sourceRecordId: string;
}

interface ReportResponse {
  rows: LinkRow[];
  summary: { total: number; reward: number; commissionVerified: boolean };
  canVerify: boolean;
}

interface FetchParams {
  userId: string;
  startDate: string;
  endDate: string;
}

export default function PostingDataLinkReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);

  const { data: usersData } = useQuery<{ users: ReportUser[] }>({
    queryKey: [`${BASE}/users`],
    queryFn: async () => {
      const res = await apiRequest("GET", `${BASE}/users`);
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });
  const users = usersData?.users ?? [];

  const { data: reportData, isLoading } = useQuery<ReportResponse>({
    queryKey: [BASE, fetchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("userId", fetchParams!.userId);
      params.set("startDate", fetchParams!.startDate);
      params.set("endDate", fetchParams!.endDate);
      const res = await apiRequest("GET", `${BASE}?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to load link report");
      }
      return res.json();
    },
    enabled: !!fetchParams,
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!fetchParams) return;
      const res = await apiRequest("POST", `${BASE}/verify-commission`, {
        userId: fetchParams.userId,
        startDate: fetchParams.startDate,
        endDate: fetchParams.endDate,
        linkReportIds: (reportData?.rows ?? []).map((r) => r.id),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to verify commission");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Commission verified" });
      queryClient.invalidateQueries({ queryKey: [BASE, fetchParams] });
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err?.message, variant: "destructive" });
    },
  });

  const handleView = () => {
    if (!selectedUser || !startDate || !endDate) {
      toast({ title: "Please select a user and date range", variant: "destructive" });
      return;
    }
    setFetchParams({ userId: selectedUser, startDate, endDate });
  };

  const rows = reportData?.rows ?? [];
  const summary = reportData?.summary;
  const canVerify = reportData?.canVerify ?? false;
  const commissionVerified = summary?.commissionVerified ?? false;

  const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd-MM-yyyy") : "-");

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        LINK REPORT
      </h1>

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-white dark:bg-zinc-800" data-testid="select-user">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 relative">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start Date</label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2 relative">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End Date</label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleView}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8"
              data-testid="button-view"
            >
              View
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">List</h2>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-4 px-4 font-bold border-b">#</th>
                  <th className="py-4 px-4 font-bold border-b">ID</th>
                  <th className="py-4 px-4 font-bold border-b">Company</th>
                  <th className="py-4 px-4 font-bold border-b">Links</th>
                  <th className="py-4 px-4 font-bold border-b">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Loading data...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No entries found
                    </td>
                  </tr>
                ) : (
                  rows.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                      data-testid={`row-link-${index}`}
                    >
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400">{index + 1}</td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400">{item.displayId || "-"}</td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400">{item.company || "-"}</td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400 break-all">
                        {item.links ? (
                          <a
                            href={item.links}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#00a65a] hover:underline"
                          >
                            {item.links}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400">{fmtDate(item.date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {fetchParams && !isLoading && (
            <div
              className="flex flex-wrap items-center justify-between gap-4 p-4 border-t border-slate-100 dark:border-zinc-800"
              data-testid="summary-row"
            >
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-700 dark:text-zinc-300">
                <span className="font-semibold">
                  Total: <span data-testid="summary-total">{summary?.total ?? rows.length}</span>
                </span>
                <span className="font-semibold">
                  Reward: <span data-testid="summary-reward">{summary?.reward ?? 0}</span>
                </span>
              </div>
              {canVerify && (
                <Button
                  onClick={() => verifyMutation.mutate()}
                  disabled={commissionVerified || verifyMutation.isPending || rows.length === 0}
                  className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-6"
                  data-testid="button-verify-commission"
                >
                  {commissionVerified ? "Commission Verified" : "Verify Commission"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
