import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getAuthHeader } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MessageCircle, Eye, Printer, History, Edit, Search } from "lucide-react";
import { Link } from "wouter";

type TracingSummary = Record<string, number>;

type TracingItem = {
  id: string;
  drmId: string;
  companyId: string;
  companyName: string;
  accountHolder: string;
  email: string | null;
  contactNo: string | null;
  ntn: string | null;
  cnic: string | null;
  grade: string;
  createdAt: string;
};

const gradeConfig: { key: string; label: string; color: string; gradient: string }[] = [
  { key: "A+", label: "A+", color: "#0f8a3c", gradient: "from-emerald-600 to-teal-700 shadow-emerald-200" },
  { key: "A-", label: "A-", color: "#e5533d", gradient: "from-rose-600 to-pink-700 shadow-rose-200" },
  { key: "B+", label: "B+", color: "#42c98f", gradient: "from-blue-600 to-indigo-700 shadow-blue-200" },
  { key: "B-", label: "B-", color: "#4a90e2", gradient: "from-indigo-600 to-violet-700 shadow-indigo-200" },
  { key: "B", label: "B", color: "#f5b642", gradient: "from-amber-500 to-orange-600 shadow-amber-200" },
  { key: "C+", label: "C+", color: "#6b7280", gradient: "from-slate-600 to-slate-800 shadow-slate-200" },
  { key: "C", label: "C", color: "#1f2937", gradient: "from-gray-700 to-gray-900 shadow-gray-200" },
  { key: "D", label: "D", color: "#22c55e", gradient: "from-red-600 to-rose-700 shadow-red-200" },
];

const addSchema = z.object({
  companyName: z.string().min(1, "Company Name is required"),
  accountHolder: z.string().min(1, "Account Holder is required"),
  contactNo: z.string().min(1, "Contact No is required"),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  ntn: z.string().optional(),
  cnic: z.string().optional(),
  grade: z.enum(["A+", "A-", "B+", "B-", "B", "C+", "C", "D"]),
});

type AddFormValues = z.infer<typeof addSchema>;

export default function TracingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeGrade, setActiveGrade] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // sync grade from query param if present
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const gradeParam = params.get("grade");
      if (gradeParam) {
        setActiveGrade(gradeParam);
      }
      // if no grade param, stay empty → show all
    } catch {
      // ignore
    }
  }, []);

  const { data: summary } = useQuery<TracingSummary>({
    queryKey: ["/api/sales/tracing/summary"],
    queryFn: async () => {
      const res = await fetch("/api/sales/tracing/summary", {
        headers: getAuthHeader(),
        credentials: "include",
      });
      return res.json();
    },
  });

  const { data: listData = { items: [], total: 0, page: 1, pageSize: 10 }, isLoading } = useQuery<{ items: TracingItem[]; total: number; page: number; pageSize: number }>({
    queryKey: ["/api/sales/tracing/list", activeGrade, page, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeGrade) params.set("grade", activeGrade);
      params.set("page", String(page));
      params.set("pageSize", "10");
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/sales/tracing/list?${params.toString()}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });
      const json = await res.json();
      return json as { items: TracingItem[]; total: number; page: number; pageSize: number };
    },
  });

  const displayItems = useMemo(() => {
    // API already filters by grade — no need to re-filter on client
    return listData?.items ?? [];
  }, [listData]);

  const form = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: {
      companyName: "",
      accountHolder: "",
      contactNo: "",
      email: "",
      ntn: "",
      cnic: "",
      grade: "A+",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: AddFormValues) => {
      const res = await fetch("/api/sales/tracing/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to add customer");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Customer created" });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/tracing/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/tracing/list"] });
      form.reset({ companyName: "", accountHolder: "", contactNo: "", email: "", ntn: "", cnic: "", grade: "A+" });
      setPage(1);
      setPageInput("1");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to add customer", variant: "destructive" });
    },
  });

  const pageCount = useMemo(() => {
    const size = listData?.pageSize ?? 10;
    const total = activeGrade ? displayItems.length : listData?.total ?? 0;
    return Math.max(1, Math.ceil(total / size));
  }, [listData, displayItems, activeGrade]);

  const handlePageGo = () => {
    const num = Math.max(1, Math.min(pageCount, parseInt(pageInput || "1", 10)));
    setPage(num);
  };

  const activeSummaryCount = (summary && summary[activeGrade]) || 0;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tracing / Customer Tracking</h1>
          <p className="text-muted-foreground">Monitor customers by grade and take quick actions</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-add-tracing">
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Customer</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}>
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter company name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountHolder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter account holder" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact No</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Email (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="ntn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NTN</FormLabel>
                        <FormControl>
                          <Input placeholder="NTN (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cnic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNIC</FormLabel>
                        <FormControl>
                          <Input placeholder="CNIC (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {gradeConfig.map((g) => (
                              <SelectItem key={g.key} value={g.key}>
                                {g.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={addMutation.isPending}>
                    {addMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {gradeConfig.map((grade) => {
              const count = summary?.[grade.key] ?? 0;
              const active = activeGrade === grade.key;
              return (
                <button
                  key={grade.key}
                  onClick={() => {
                    const next = active ? "" : grade.key;
                    setActiveGrade(next);
                    setPage(1);
                    setPageInput("1");
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 bg-gradient-to-br ${grade.gradient} text-white shadow-sm outline-none ${
                    active
                      ? "shadow-lg scale-105 ring-4 ring-primary/30 z-10"
                      : "opacity-90 hover:opacity-100 hover:scale-[1.02] hover:-translate-y-0.5"
                  }`}
                >
                  <div className="text-sm font-semibold">{grade.label}</div>
                  <div className="text-lg font-bold">{count}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4">
          <CardTitle className="flex items-center justify-between">
            <span>Tracing List</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  className="pl-8"
                  placeholder="Search company, email, contact"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                    setPageInput("1");
                  }}
                  data-testid="input-tracing-search"
                />
              </div>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Page</span>
            <Input
              className="w-16"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePageGo();
                }
              }}
            />
            <Button variant="outline" onClick={handlePageGo}>
              Go
            </Button>
            <span className="text-sm text-muted-foreground">
              of {pageCount}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>DRM ID</TableHead>
                  <TableHead>Co Name</TableHead>
                  <TableHead>Acc Holder</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact No</TableHead>
                  <TableHead>NTN</TableHead>
                  <TableHead>CNIC</TableHead>
                  <TableHead>Account Create Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : (listData?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-emerald-600 font-bold">
                        {item.drmId
                          ? item.drmId
                          : item.companyId && item.companyId.length < 20
                            ? item.companyId
                            : <span className="text-gray-400 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="font-semibold">{item.companyName}</TableCell>
                      <TableCell>{item.accountHolder}</TableCell>
                      <TableCell>{item.email || "-"}</TableCell>
                      <TableCell>{item.contactNo || "-"}</TableCell>
                      <TableCell>{item.ntn || "-"}</TableCell>
                      <TableCell>{item.cnic || "-"}</TableCell>
                      <TableCell>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/sales/tracing/view/${item.id}`}>
                            <ActionIcon icon={Eye} label="View" />
                          </Link>
                          <ActionIcon href={`mailto:${item.email || ""}`} icon={Mail} label="Email" />
                          <ActionIcon href={`https://wa.me/${item.contactNo || ""}`} icon={MessageCircle} label="WhatsApp" />
                          <ActionIcon href={`tel:${item.contactNo || ""}`} icon={Phone} label="Call" />
                          <ActionIcon href={`/sales/customers/${item.id}/print`} icon={Printer} label="Print" />
                          <ActionIcon href={`/sales/customers/${item.id}/history`} icon={History} label="History" />
                          <ActionIcon href={`/sales/customers/${item.id}/edit`} icon={Edit} label="Edit" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
            <span>
              Showing {(page - 1) * (listData?.pageSize ?? 10) + 1}-
              {Math.min(page * (listData?.pageSize ?? 10), listData?.total ?? 0)} of {listData?.total ?? 0}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  setPageInput(String(next));
                }}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => {
                  const next = Math.min(pageCount, page + 1);
                  setPage(next);
                  setPageInput(String(next));
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionIcon({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href?: string;
  icon: typeof Eye;
  label: string;
  onClick?: () => void;
}) {
  const isExternal = href && (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("https://wa.me/"));
  const body = (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center transition-all border shadow-sm shrink-0 bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200/60 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
      title={label}
      role={onClick ? "button" : undefined}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );

  if (href && !onClick) {
    return (
      <a
        href={href}
        onClick={(e) => {
          if (isExternal) return;
          e.preventDefault();
          window.location.href = href;
        }}
      >
        {body}
      </a>
    );
  }
  if (href && onClick) {
    return (
      <a
        href={href}
        onClick={(e) => {
          if (isExternal) return;
          e.preventDefault();
          onClick();
        }}
      >
        {body}
      </a>
    );
  }
  return body;
}
