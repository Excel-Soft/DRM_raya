import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ArrowRight, Loader2, Check, X, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Mirrors server/services/approval-visibility.service.ts (PendingApprovalItem).
interface ApprovalAction {
  method: "GET" | "POST" | "PATCH" | "PUT";
  url: string;
  reasonRequired?: boolean;
  reasonKey?: string;
  body?: Record<string, unknown>;
}
interface ApprovalActions {
  approve?: ApprovalAction;
  reject?: ApprovalAction;
  view?: string;
}
interface PendingApprovalItem {
  module: string;
  moduleLabel: string;
  stage: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  currency?: string | null;
  requestedByName?: string | null;
  department?: string | null;
  status: string;
  createdAt: string | null;
  actions: ApprovalActions;
}
interface SummaryModule {
  module: string;
  label: string;
  count: number;
}

export default function Approvals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [rejectTarget, setRejectTarget] = useState<PendingApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: summary } = useQuery<{ success: boolean; summary: { total: number; byModule: SummaryModule[] } }>({
    queryKey: ["/api/approvals/summary"],
  });

  const { data: pending, isLoading } = useQuery<{ success: boolean; items: PendingApprovalItem[] }>({
    queryKey: ["/api/approvals/pending"],
  });

  const items = pending?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/approvals/summary"] });
  };

  const runAction = async (action: ApprovalAction, reason?: string) => {
    const body: Record<string, unknown> = { ...(action.body || {}) };
    if (action.reasonRequired && reason !== undefined) {
      body[action.reasonKey || "reason"] = reason;
    }
    const hasBody = Object.keys(body).length > 0;
    const res = await apiRequest(action.method, action.url, hasBody ? body : undefined);
    await throwIfResNotOk(res);
    return res.json().catch(() => ({}));
  };

  const approveMutation = useMutation({
    mutationFn: async (item: PendingApprovalItem) => {
      if (!item.actions.approve) throw new Error("No approve action available");
      return runAction(item.actions.approve);
    },
    onSuccess: () => {
      toast({ title: "Approved" });
      invalidate();
    },
    onError: (error: any) => {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ item, reason }: { item: PendingApprovalItem; reason: string }) => {
      if (!item.actions.reject) throw new Error("No reject action available");
      return runAction(item.actions.reject, reason);
    },
    onSuccess: () => {
      toast({ title: "Rejected" });
      setRejectTarget(null);
      setRejectReason("");
      invalidate();
    },
    onError: (error: any) => {
      toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
    },
  });

  const modules = useMemo(() => summary?.summary.byModule ?? [], [summary]);

  const filteredData = useMemo(() => {
    let rows = items;
    if (moduleFilter !== "all") rows = rows.filter((r) => r.module === moduleFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.title || "").toLowerCase().includes(q) ||
          String(r.subtitle || "").toLowerCase().includes(q) ||
          String(r.requestedByName || "").toLowerCase().includes(q) ||
          String(r.moduleLabel || "").toLowerCase().includes(q) ||
          String(r.stage || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [items, moduleFilter, searchQuery]);

  const isBusy = (item: PendingApprovalItem) =>
    (approveMutation.isPending && approveMutation.variables?.entityId === item.entityId) ||
    (rejectMutation.isPending && rejectMutation.variables?.item.entityId === item.entityId);

  return (
    <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
      <div className="mb-6 flex space-x-1 uppercase text-[15px] font-bold tracking-wide text-[#00a65a] items-center dark:text-zinc-400">
        <ArrowRight className="w-4 h-4 mr-1 text-[#00a65a] dark:text-zinc-400" />
        Approvals — Unified Dashboard
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <button
          onClick={() => setModuleFilter("all")}
          className={cn(
            "bg-white border rounded shadow-sm p-3 text-left transition-colors dark:bg-zinc-900 dark:border-zinc-800",
            moduleFilter === "all" ? "border-[#00a65a] ring-1 ring-[#00a65a]" : "border-gray-100",
          )}
        >
          <div className="text-[11px] uppercase font-bold text-gray-400">All Pending</div>
          <div className="text-2xl font-bold text-[#333] dark:text-zinc-200">{summary?.summary.total ?? 0}</div>
        </button>
        {modules.map((m) => (
          <button
            key={m.module}
            onClick={() => setModuleFilter(m.module)}
            className={cn(
              "bg-white border rounded shadow-sm p-3 text-left transition-colors dark:bg-zinc-900 dark:border-zinc-800",
              moduleFilter === m.module ? "border-[#00a65a] ring-1 ring-[#00a65a]" : "border-gray-100",
            )}
          >
            <div className="text-[11px] uppercase font-bold text-gray-400 truncate">{m.label}</div>
            <div className="text-2xl font-bold text-[#333] dark:text-zinc-200">{m.count}</div>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded shadow-sm overflow-hidden p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
          <div className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">
            Pending items you can act on. Actions call each module's own approve/reject endpoint.
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[220px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
            />
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-[#d1e7dd] text-[#0a3622] border-b border-[#badbcc] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Module</th>
                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Item</th>
                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Stage</th>
                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Requested By</th>
                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Amount</th>
                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Date</th>
                <th className="px-4 py-3 text-[13px] font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#495057] dark:text-zinc-400">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                    <div className="flex justify-center items-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading pending approvals...
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                    No pending approvals.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr
                    key={`${item.module}:${item.entityId}`}
                    className="hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800"
                  >
                    <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                      <span className="inline-flex text-[11px] px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.moduleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                      <div className="font-bold text-[#333] dark:text-zinc-200">{item.title}</div>
                      {item.subtitle && <div className="text-[12px] text-blue-500 font-medium">{item.subtitle}</div>}
                    </td>
                    <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                      <span className="inline-flex text-[11px] px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {item.stage}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                      {item.requestedByName || "—"}
                    </td>
                    <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                      {item.amount != null ? `${item.currency || ""} ${item.amount}`.trim() : "—"}
                    </td>
                    <td className="px-4 py-4 text-[13px] border-r border-gray-100 whitespace-nowrap dark:border-zinc-800">
                      {item.createdAt ? format(new Date(item.createdAt), "dd-MM-yyyy") : "N/A"}
                    </td>
                    <td className="px-4 py-4 text-[13px]">
                      <div className="flex items-center gap-2">
                        {item.actions.approve && (
                          <button
                            onClick={() => approveMutation.mutate(item)}
                            disabled={isBusy(item)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#00a65a] text-white rounded-[3px] hover:bg-[#008d4c] transition-colors disabled:opacity-50 text-[12px] font-semibold"
                          >
                            {isBusy(item) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                        )}
                        {item.actions.reject && (
                          <button
                            onClick={() => {
                              setRejectTarget(item);
                              setRejectReason("");
                            }}
                            disabled={isBusy(item)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-[3px] hover:bg-red-600 transition-colors disabled:opacity-50 text-[12px] font-semibold"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        )}
                        {item.actions.view && (
                          <button
                            onClick={() => navigate(item.actions.view as string)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-[3px] hover:bg-slate-200 transition-colors text-[12px] font-semibold dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal — reason required */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-bold uppercase tracking-wider">Reject — reason required</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-[13px] text-gray-600 dark:text-zinc-400">
              {rejectTarget?.moduleLabel}: <span className="font-semibold">{rejectTarget?.title}</span>
            </div>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ item: rejectTarget, reason: rejectReason.trim() })}
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
