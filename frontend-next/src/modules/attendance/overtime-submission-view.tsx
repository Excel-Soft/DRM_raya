"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/legacy/button";
import { Badge } from "@/components/ui/legacy/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/legacy/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/legacy/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/legacy/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/legacy/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/legacy/tabs";
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  History,
  Timer,
  Trash2,
  Check,
  X,
} from "lucide-react";
import type { OvertimeRecord } from "@/modules/attendance/attendance-types";
import {
  AttendanceActionButton,
  AttendanceShell,
  DrmInlineActions,
  DrmSection,
  attTableBodyCellClass,
  attTableBodyRowClass,
  attTableHeadCellClass,
  attTableHeadRowClass,
  attSelectTriggerClass,
  AttendanceToolbar,
  drmFieldClass,
} from "@/modules/attendance/attendance-ui";
import { cn } from "@/lib/utils/cn";

type OvertimeStats = {
  totalRecords: number;
  pending: number;
  approved: number;
  rejected: number;
  totalMinutesApproved: number;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Pending: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Clock },
  Approved: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  Rejected: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", icon: XCircle },
};

const overtimeFormSchema = z.object({
  userId: z.string().optional(),
  taskTitle: z.string().min(3, "Task title must be at least 3 characters"),
  timeSpent: z.number().min(1, "Time spent must be at least 1 minute").max(720, "Time spent cannot exceed 12 hours"),
  taskDetails: z.string().min(10, "Task details must be at least 10 characters"),
});

type OvertimeFormValues = z.infer<typeof overtimeFormSchema>;

export function OvertimeSubmissionView() {
  const { toast } = useToast();
  const userRole = typeof window !== 'undefined' ? (sessionStorage.getItem("userRole") || "") : "";
  const isManager = userRole.toLowerCase().includes("manager") || userRole === "admin" || userRole === "super_admin";
  const [activeTab, setActiveTab] = useState("new");
  const [isAddMode, setIsAddMode] = useState(false);
  const [confirmData, setConfirmData] = useState<OvertimeFormValues | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<OvertimeFormValues>({
    resolver: zodResolver(overtimeFormSchema),
    defaultValues: {
      userId: "self",
      taskTitle: "",
      timeSpent: 30,
      taskDetails: "",
    },
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      const data = await res.json();
      return data.users || [];
    }
  });

  const { data: overtimeRecords, isLoading: loadingRecords } = useQuery<OvertimeRecord[]>({
    queryKey: isManager ? ["/api/overtime/all"] : ["/api/overtime"],
    queryFn: async () => {
      const url = isManager ? "/api/overtime/all" : "/api/overtime";
      const res = await apiRequest("GET", url);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: overtimeStats, isLoading: loadingStats } = useQuery<OvertimeStats>({
    queryKey: ["/api/overtime/stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: OvertimeFormValues) => {
      const payload: any = {
        taskTitle: data.taskTitle,
        timeSpent: data.timeSpent,
        taskDetails: data.taskDetails,
      };
      if (data.userId && data.userId !== "self") {
        payload.userId = data.userId;
      }
      return apiRequest("POST", "/api/overtime", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overtime/stats"] });
      toast({ title: "Overtime record submitted successfully" });
      form.reset();
      setActiveTab("history");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit overtime record",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/overtime/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overtime/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overtime/stats"] });
      toast({ title: "Overtime record deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to delete overtime record",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/overtime/${id}/approve`, {});
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime/all"] });
      toast({ title: "✅ Overtime Approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/overtime/${id}/reject`, { reason: "Rejected by manager" });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime/all"] });
      toast({ title: "❌ Overtime Rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const onSubmit = (data: OvertimeFormValues) => {
    setConfirmData(data);
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_COLORS[status] || STATUS_COLORS.Pending;
    const IconComponent = config.icon;
    return (
      <Badge className={`${config.bg} ${config.text} gap-1`}>
        <IconComponent className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "yyyy-MM-dd hh:mm:a");
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const totalHoursApproved = overtimeStats
    ? Math.floor(overtimeStats.totalMinutesApproved / 60)
    : 0;
  const totalMinsApproved = overtimeStats
    ? overtimeStats.totalMinutesApproved % 60
    : 0;

  const filteredRecords = overtimeRecords?.filter((record) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const userName = (record as any).userName || (record as any).full_name || "Employee";
    return (
      userName.toLowerCase().includes(term) ||
      (record.taskTitle || "").toLowerCase().includes(term) ||
      (record.taskDetails || "").toLowerCase().includes(term) ||
      (record.status || "Pending").toLowerCase().includes(term)
    );
  }) || [];

  return (
    <AttendanceShell
      title="Overtime submission"
      description="Log overtime hours and track manager approval status."
      actions={
        <DrmInlineActions
          items={[
            { id: "list", label: "Records", onClick: () => setIsAddMode(false), active: !isAddMode },
            { id: "add", label: "Add overtime", onClick: () => setIsAddMode(true), active: isAddMode },
          ]}
        />
      }
    >
      <h1 className="sr-only">Overtime submission</h1>

      {isAddMode && (
        <DrmSection title="Add overtime" description="Submit a new overtime entry for approval.">
                <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Employee (Optional)</Label>
                    <Select
                        value={form.watch('userId') || "self"}
                        onValueChange={(val) => form.setValue('userId', val, { shouldValidate: true })}
                    >
                        <SelectTrigger className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                            <SelectValue placeholder="Select Employee (Self)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="self">{typeof window !== 'undefined' ? sessionStorage.getItem("userName") || "Self" : "Self"} (Logged in user)</SelectItem>
                            {users?.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Task</Label>
                    <Input
                    value={form.watch('taskTitle')}
                    onChange={(e) => form.setValue('taskTitle', e.target.value, { shouldValidate: true })}
                    placeholder="purpose"
                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                    />
                    {form.formState.errors.taskTitle && <span className="text-red-500 text-[11px]">{form.formState.errors.taskTitle.message}</span>}
                </div>
                <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Time In Mint</Label>
                    <Input
                    type="number"
                    value={form.watch('timeSpent') || ""}
                    onChange={(e) => form.setValue('timeSpent', parseInt(e.target.value) || 0, { shouldValidate: true })}
                    placeholder="time in mint"
                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                    />
                    {form.formState.errors.timeSpent && <span className="text-red-500 text-[11px]">{form.formState.errors.timeSpent.message}</span>}
                </div>
                <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Task Detail</Label>
                    <Input
                    value={form.watch('taskDetails')}
                    onChange={(e) => form.setValue('taskDetails', e.target.value, { shouldValidate: true })}
                    placeholder="add detail"
                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                    />
                    {form.formState.errors.taskDetails && <span className="text-red-500 text-[11px]">{form.formState.errors.taskDetails.message}</span>}
                </div>
                </div>
                <div>
                    <AttendanceActionButton
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={createMutation.isPending}
                    >
                    {createMutation.isPending ? "Submitting…" : "Submit"}
                    </AttendanceActionButton>
                </div>
                </div>
        </DrmSection>
      )}

      <DrmSection title="Overtime records" description="Search and review submitted overtime.">
            {/* Table Controls */}
            <AttendanceToolbar
              left={
                <>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Show</span>
                    <Select defaultValue="10">
                        <SelectTrigger className={attSelectTriggerClass("w-[4.5rem]")}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">entries</span>
                </>
              }
              right={
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Search
                      <Input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={cn(drmFieldClass, "mt-1 h-9 w-48 text-sm")}
                      />
                    </label>
              }
            />

          <div className="mb-4 mt-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={attTableHeadRowClass}>
                  <th className={cn(attTableHeadCellClass, "w-[50px]")}>#</th>
                  <th className={attTableHeadCellClass}>Name</th>
                  <th className={attTableHeadCellClass}>Task</th>
                  <th className={attTableHeadCellClass}>Time</th>
                  <th className={attTableHeadCellClass}>Task detail</th>
                  <th className={attTableHeadCellClass}>Status</th>
                  <th className={attTableHeadCellClass}>Created</th>
                  <th className={attTableHeadCellClass}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record.id} className={attTableBodyRowClass}>
                      <td className={attTableBodyCellClass}>{index + 1}</td>
                      <td className={attTableBodyCellClass}>{(record as any).userName || (record as any).full_name || "Employee"}</td>
                      <td className={attTableBodyCellClass}>{record.taskTitle}</td>
                      <td className={attTableBodyCellClass}>{record.timeSpent}</td>
                      <td className={attTableBodyCellClass}>{record.taskDetails}</td>
                      <td className="py-4 px-4 text-[13px] font-medium">
                        <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                          record.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                          record.status === 'Rejected' ? 'bg-red-50 text-red-500' :
                          'bg-amber-50 text-amber-500'
                        }`}>{record.status || 'Pending'}</span>
                      </td>
                      <td className={attTableBodyCellClass}>{formatDate(record.createdAt)}</td>
                      <td className="py-4 px-4 w-32">
                        {isManager && record.status === 'Pending' ? (
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => approveMutation.mutate(record.id)}
                              disabled={approveMutation.isPending}
                              title="Approve"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white transition-colors disabled:opacity-50 shadow-sm"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectMutation.mutate(record.id)}
                              disabled={rejectMutation.isPending}
                              title="Reject"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white transition-colors disabled:opacity-50 shadow-sm"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          !isManager && record.status === 'Pending' && (
                            <button type="button" onClick={() => deleteMutation.mutate(record.id)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors dark:text-zinc-400 dark:border-zinc-800">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            <div className="flex justify-between items-center text-[13px] text-[#495057] dark:text-zinc-400">
                <div>Showing {filteredRecords.length ? 1 : 0} to {filteredRecords.length} of {filteredRecords.length} entries</div>
                <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-zinc-800">
                    <button className="px-3 py-1.5 bg-[#f9f9f9] text-[#b0b0b0] cursor-not-allowed border-r border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                        Previous
                    </button>
                    <button className="px-3 py-1.5 bg-white text-[#b0b0b0] cursor-not-allowed dark:bg-zinc-900">
                        Next
                    </button>
                </div>
            </div>
      </DrmSection>

      <AlertDialog open={!!confirmData} onOpenChange={(open) => !open && setConfirmData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this overtime entry? Once submitted, it will be sent to the manager for approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (confirmData) {
                  createMutation.mutate(confirmData);
                  setConfirmData(null);
                }
              }}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
            >
              Confirm & Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AttendanceShell>
  );
}
