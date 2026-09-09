import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useScreenContext } from "@/contexts/screen-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import type { OvertimeRecord } from "@shared/schema";

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

export default function OvertimeSubmissionPage() {
  const { toast } = useToast();
  const { updateVisibleData } = useScreenContext();
  const userRole = typeof window !== 'undefined' ? (sessionStorage.getItem("userRole") || "") : "";
  const isManager = userRole.toLowerCase().includes("manager") || userRole === "admin" || userRole === "super_admin";
  const [activeTab, setActiveTab] = useState("new");
  const [isAddMode, setIsAddMode] = useState(false);
  const [confirmData, setConfirmData] = useState<OvertimeFormValues | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    updateVisibleData({
      screenName: "Overtime Submission",
      description: "Submit overtime hours and view approval status",
      features: [
        "Submit overtime records with task title and time spent",
        "View overtime history with status tracking",
        "Track pending, approved, and rejected overtime",
        "Delete pending overtime records",
      ],
    });
  }, [updateVisibleData]);

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

  const formatDate = (date: Date | string) => {
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
    <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
        <h1 className="text-[16px] font-bold tracking-wide uppercase mb-6 flex items-center">
            <span className="text-[#495057] dark:text-zinc-400">OVERTIME</span>
            <span className="mx-1 text-[#495057] dark:text-zinc-400">/</span>
            <span 
                className="text-[#00a65a] cursor-pointer hover:underline dark:text-zinc-400"
                onClick={() => setIsAddMode(!isAddMode)}
            >
                ADD OVERTIME
            </span>
        </h1>

      {isAddMode && (
        <Card className="border border-gray-100 shadow-sm rounded-md bg-white mb-6 dark:bg-zinc-900 dark:border-zinc-800">
            <CardContent className="p-5">
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
                    <Button
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={createMutation.isPending}
                        className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-[13px] font-medium shadow-none"
                    >
                    {createMutation.isPending ? "Submitting..." : "Submit"}
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}

      <Card className="border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <CardContent className="p-5">
            {/* Table Controls */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#495057] dark:text-zinc-400">Show</span>
                    <Select defaultValue="10">
                        <SelectTrigger className="h-8 w-[70px] bg-white text-[13px] text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-[13px] text-[#495057] dark:text-zinc-400">entries</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                    <Input 
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 w-[200px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                    />
                </div>
            </div>

          <div className="w-full border border-gray-200 overflow-hidden mb-4 mt-2 dark:border-zinc-800">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-[#f2f2f2] border-b border-gray-200 dark:bg-zinc-800 dark:border-zinc-800">
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white w-[50px] dark:text-zinc-400">#</th>
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Name</th>
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Task</th>
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Time</th>
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Task Detail</th>
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Manager</th>
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Create</th>
                  <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Action</th>
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
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                      <td className="py-4 px-4 text-[13px] font-bold text-slate-700 dark:text-zinc-400">{index + 1}</td>
                      <td className="py-4 px-4 text-[13px] font-medium text-slate-600 dark:text-zinc-300">{(record as any).userName || (record as any).full_name || "Employee"}</td>
                      <td className="py-4 px-4 text-[13px] font-medium text-slate-600 dark:text-zinc-300">{record.taskTitle}</td>
                      <td className="py-4 px-4 text-[13px] font-medium text-slate-600 dark:text-zinc-300">{record.timeSpent}</td>
                      <td className="py-4 px-4 text-[13px] font-medium text-slate-600 dark:text-zinc-300">{record.taskDetails}</td>
                      <td className="py-4 px-4 text-[13px] font-medium">
                        <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                          record.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                          record.status === 'Rejected' ? 'bg-red-50 text-red-500' :
                          'bg-amber-50 text-amber-500'
                        }`}>{record.status || 'Pending'}</span>
                      </td>
                      <td className="py-4 px-4 text-[13px] font-medium text-slate-600 dark:text-zinc-300">{formatDate(record.createdAt)}</td>
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
        </CardContent>
      </Card>

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
    </div>
  );
}
