import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Plus,
  X,
  History,
  Briefcase,
  User,
} from "lucide-react";
import type { LeaveRequest } from "@shared/schema";

type LeaveStats = {
  totalRequests: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byType: Record<string, number>;
};

const LEAVE_TYPES = [
  { value: "Sick", label: "Sick Leave" },
  { value: "Casual", label: "Casual Leave" },
  { value: "Annual", label: "Annual Leave" },
  { value: "Emergency", label: "Emergency Leave" },
  { value: "Unpaid", label: "Unpaid Leave" },
  { value: "Maternity", label: "Maternity Leave" },
  { value: "Paternity", label: "Paternity Leave" },
  { value: "Other", label: "Other" },
];

const DURATION_TYPES = ["Full Day", "Half Day", "Short Leave"] as const;

const PURPOSE_OPTIONS = ["Wedding", "Unhealthy", "Urgent Work", "Passing Away", "Accident", "Other"] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Pending: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Clock },
  Approved: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  Rejected: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", icon: XCircle },
  Cancelled: { bg: "bg-slate-100 dark:bg-zinc-950/30", text: "text-slate-700 dark:text-slate-400", icon: X },
};

const leaveFormSchema = z.object({
  purpose: z.enum(PURPOSE_OPTIONS),
  leaveType: z.enum(["Sick", "Casual", "Annual", "Emergency", "Unpaid", "Maternity", "Paternity", "Other"]),
  duration: z.enum(DURATION_TYPES),
  alternative: z.string().min(1, "Alternative contact is required"),
  fromDate: z.date({ required_error: "Start date is required" }),
  toDate: z.date({ required_error: "End date is required" }),
  time: z.string().optional(),
  description: z.string().optional(),
}).refine((data) => data.toDate >= data.fromDate, {
  message: "End date must be after start date",
  path: ["toDate"],
});

type LeaveFormValues = z.infer<typeof leaveFormSchema>;

export default function LeaveRequestPage() {
  const { toast } = useToast();
  const { updateVisibleData } = useScreenContext();
  const [activeTab, setActiveTab] = useState("new");
  const [, setLocation] = useLocation();

  const userRoleRaw = typeof window !== "undefined" ? sessionStorage.getItem("userRole") : null;
  const activeRoleKey = (userRoleRaw || "").toLowerCase().replace(/\s+/g, "_");
  const isSoftwareManager = activeRoleKey === "software_manager";

  useEffect(() => {
    if (isSoftwareManager) {
      setLocation("/dashboard/software-manager?view=leave-application");
    }
  }, [isSoftwareManager, setLocation]);

  if (isSoftwareManager) return null;

  useEffect(() => {
    updateVisibleData({
      screenName: "Leave Request",
      description: "Submit new leave requests and view request history with status tracking",
      features: [
        "Submit new leave requests with purpose, type, and dates",
        "View leave request history with status",
        "Track pending, approved, and rejected requests",
        "Cancel pending leave requests",
      ],
    });
  }, [updateVisibleData]);

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      purpose: "Wedding",
      leaveType: "Casual",
      duration: "Full Day",
      alternative: "",
      fromDate: new Date(),
      toDate: new Date(),
      time: "",
      description: "",
    },
  });

  const { data: leaveRequests, isLoading: loadingRequests } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave"],
  });

  const { data: leaveStats, isLoading: loadingStats } = useQuery<LeaveStats>({
    queryKey: ["/api/leave/stats"],
  });

  const [colleagueError, setColleagueError] = useState<string>("");

  const { data: colleagues, isLoading: loadingColleagues } = useQuery<any[]>({
    queryKey: ["/api/leave/colleagues", activeRoleKey],
    queryFn: async () => {
      try {
        setColleagueError("");
        const res = await apiRequest("GET", `/api/leave/colleagues?role=${activeRoleKey}`);
        if (!res.ok) {
          const text = await res.text();
          setColleagueError(`HTTP Error ${res.status}: ${text}`);
          return [];
        }
        const data = await res.json();
        if (!data.users) {
          setColleagueError(`No users array in response. Keys: ${Object.keys(data).join(',')}`);
          return [];
        }
        return data.users;
      } catch (err: any) {
        setColleagueError(`Exception: ${err.message}`);
        return [];
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LeaveFormValues) => {
      return apiRequest("POST", "/api/leave", {
        purpose: data.purpose,
        leaveType: data.leaveType,
        duration: data.duration,
        alternative: data.alternative,
        fromDate: data.fromDate.toISOString(),
        toDate: data.toDate.toISOString(),
        time: data.time || null,
        description: data.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/stats"] });
      toast({ title: "Leave request submitted successfully" });
      form.reset();
      setActiveTab("history");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit leave request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/leave/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/stats"] });
      toast({ title: "Leave request cancelled successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to cancel leave request",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LeaveFormValues) => {
    createMutation.mutate(data);
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
    return format(d, "MMM d, yyyy");
  };

  const getLeaveTypeLabel = (type: string) => {
    const found = LEAVE_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="max-w-full mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Leave Request</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Submit leave requests and track your request history
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loadingStats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          ) : leaveStats ? (
            <>
              <Card data-testid="card-total">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
                  <FileText className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{leaveStats.totalRequests}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    all time
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-pending">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{leaveStats.pending}</div>
                  <p className="text-xs text-muted-foreground mt-1">awaiting approval</p>
                </CardContent>
              </Card>

              <Card data-testid="card-approved">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{leaveStats.approved}</div>
                  <p className="text-xs text-muted-foreground mt-1">requests approved</p>
                </CardContent>
              </Card>

              <Card data-testid="card-rejected">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{leaveStats.rejected}</div>
                  <p className="text-xs text-muted-foreground mt-1">requests rejected</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="new" data-testid="tab-new-request">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              Request History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submit Leave Request</CardTitle>
                <CardDescription>Fill in the details below to submit a new leave request</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="purpose"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purpose</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-purpose">
                                  <SelectValue placeholder="Select purpose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PURPOSE_OPTIONS.map((purpose) => (
                                  <SelectItem key={purpose} value={purpose}>
                                    {purpose}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="leaveType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leave Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-leave-type">
                                  <SelectValue placeholder="Select leave type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {LEAVE_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-duration">
                                  <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DURATION_TYPES.map((duration) => (
                                  <SelectItem key={duration} value={duration}>
                                    {duration}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="alternative"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alternative Contact</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-alternative">
                                <SelectValue placeholder="Select an alternative contact" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingColleagues ? (
                                <SelectItem value="loading" disabled>Loading colleagues...</SelectItem>
                              ) : colleagueError ? (
                                <SelectItem value="error" disabled>Error: {colleagueError}</SelectItem>
                              ) : colleagues && colleagues.length > 0 ? (
                                colleagues.map((colleague) => (
                                  <SelectItem key={colleague.id} value={colleague.fullName || colleague.email}>
                                    {colleague.fullName || colleague.email}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>No colleagues found</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="fromDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>From Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                    data-testid="button-from-date"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="toDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>To Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                    data-testid="button-to-date"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < form.getValues("fromDate")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 9:00 AM - 5:00 PM"
                              {...field}
                              data-testid="input-time"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional details about your leave request..."
                              className="resize-none"
                              rows={4}
                              {...field}
                              data-testid="input-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        data-testid="button-reset"
                      >
                        Reset
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        data-testid="button-submit"
                      >
                        {createMutation.isPending ? "Submitting..." : "Submit Request"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request History</CardTitle>
                <CardDescription>View all your leave requests and their current status</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>From Date</TableHead>
                        <TableHead>To Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingRequests ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={8}>
                              <Skeleton className="h-10 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : !leaveRequests || leaveRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No leave requests found</p>
                            <Button
                              variant="ghost"
                              onClick={() => setActiveTab("new")}
                              className="mt-2 underline"
                              data-testid="link-create-request"
                            >
                              Submit your first leave request
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        leaveRequests.map((request) => (
                          <TableRow key={request.id} data-testid={`row-leave-${request.id}`}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {(request as any).reason || request.purpose || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getLeaveTypeLabel((request as any).type || request.leaveType)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{(request as any).duration || "Full Day"}</Badge>
                            </TableCell>
                            <TableCell>{formatDate(request.fromDate)}</TableCell>
                            <TableCell>{formatDate(request.toDate)}</TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(request.createdAt)}
                            </TableCell>
                            <TableCell>
                              {request.status === "Pending" ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => cancelMutation.mutate(request.id)}
                                  disabled={cancelMutation.isPending}
                                  data-testid={`button-cancel-${request.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
