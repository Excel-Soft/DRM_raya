"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import { apiRequest } from "@/lib/query/query-client";
import { throwIfResNotOk } from "@/lib/api/errors";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export/export-utils";
import { PmsShell, DrmSection } from "@/modules/pms/pms-ui";

type PendingProject = {
  id: string;
  projectNumber?: string;
  company: string;
  project: string;
  serviceType?: string | null;
  status: string;
  person: string;
  date: string;
  paymentStatus: string;
  amount: number | string;
  verifiedAt: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  sentToManager?: boolean;
  hodApprovedAt?: string | null;
  accountsApprovedAt?: string | null;
  departmentType?: string | null;
  detailPackageName?: string | null;
  minisiteUrl?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  reference?: string | null;
  categories?: string | null;
  detailNotes?: string | null;
};

// Same catalog as the Service for Quotation form's Project Department field.
const DEPARTMENT_OPTIONS = [
  { value: "SALES", label: "Sales" },
  { value: "ACCOUNTS", label: "Accounts" },
  { value: "IT", label: "IT" },
  { value: "SOFTWARE", label: "Software" },
  { value: "DND", label: "D&D" },
  { value: "PRODUCT_POSTING", label: "Product Posting" },
  { value: "SEO_SMM", label: "SEO/SMM" },
  { value: "SERVICE", label: "Service" },
  { value: "MARKETING", label: "Marketing" },
  { value: "LEAD", label: "Lead" },
  { value: "QA", label: "QA" },
  { value: "RECEPTION", label: "Reception" },
  { value: "VERIFICATION", label: "Verification" },
] as const;

function departmentLabel(departmentType?: string | null): string {
  let normalized = (departmentType || "").toUpperCase().replace(/[\s/]+/g, "_");
  normalized = normalized.replace(/^DEP:/i, "");
  if (normalized === "PRODUCT_POSTING" || normalized === "9") return "P&P";
  if (normalized === "DND" || normalized === "DESIGN_DEVELOPMENT" || normalized === "10") return "D&D";
  if (normalized === "13") return "IT";
  if (normalized === "8") return "SEO/SMM";
  if (normalized === "11") return "Software";
  if (normalized === "12") return "Service";
  if (normalized === "1") return "Sales";
  if (normalized === "2") return "Accounts";
  const match = DEPARTMENT_OPTIONS.find((opt) => opt.value === normalized);
  return match?.label || normalized || "Manager";
}

function fmtDate(value: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "N/A";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

const exportColumns: ExportColumn<PendingProject>[] = [
  { key: "projectNumber", header: "#P-ID", format: (v) => `#${v || "N/A"}` },
  { key: "project", header: "Projects", format: (_v, row) => `${row.project} (${row.company})` },
  { key: "status", header: "Status" },
  { key: "hodApprovedAt", header: "Hod", format: (v) => (v ? "Verified" : "Waiting") },
  { key: "accountsApprovedAt", header: "Account", format: (v) => (v ? "Verified" : "Waiting") },
  { key: "departmentType", header: "Dep", format: (v) => departmentLabel(v) },
  { key: "date", header: "Date", format: (v) => fmtDate(v) },
];

const emptyUploadForm = {
  packageName: "",
  minisiteUrl: "",
  phone: "",
  mobile: "",
  address: "",
  reference: "",
  categories: "",
  detailNotes: "",
};

export function PendingProjectPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [uploadFormData, setUploadFormData] = useState(emptyUploadForm);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const { data: projects = [], isLoading, isError, refetch } = useQuery<PendingProject[]>({
    queryKey: ["/api/pms/pending-documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/pending-documents");
      if (!res.ok) throw new Error("Failed to load pending projects.");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiRequest("POST", `/api/projects/${selectedProjectId}/documents`, formData);
      await throwIfResNotOk(res);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document and details uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/pms/pending-documents"] });
      setIsUploadOpen(false);
      setUploadFormData(emptyUploadForm);
      setDocumentFile(null);
    },
    onError: (error: Error) => toast({ title: "Failed to upload document", description: error.message, variant: "destructive" }),
  });

  const handleUploadClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find((p) => p.id === projectId);
    // Pre-fill from whatever was already saved — the backend does a full
    // overwrite on submit (no COALESCE), so opening this blank on a
    // re-upload would silently null out any field the user doesn't retype.
    setUploadFormData({
      packageName: project?.detailPackageName || project?.serviceType || "",
      minisiteUrl: project?.minisiteUrl || "",
      phone: project?.phone || "",
      mobile: project?.mobile || "",
      address: project?.address || "",
      reference: project?.reference || "",
      categories: project?.categories || "",
      detailNotes: project?.detailNotes || "",
    });
    setDocumentFile(null);
    setIsUploadOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries(uploadFormData).forEach(([key, value]) => formData.append(key, value));
    if (documentFile) formData.append("document", documentFile);
    uploadMutation.mutate(formData);
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((row) =>
      [row.id, row.company, row.project, row.person, row.status, row.date].some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [searchQuery, projects]);

  const handleCopy = () => {
    if (filteredData.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = exportColumns.map((c) => c.header);
    const rows = filteredData.map((row) => [
      `#${row.projectNumber || "N/A"}`,
      `${row.project} (${row.company})`,
      row.status,
      row.hodApprovedAt ? "Verified" : "Waiting",
      row.accountsApprovedAt ? "Verified" : "Waiting",
      departmentLabel(row.departmentType),
      fmtDate(row.date),
    ]);
    const text = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    void navigator.clipboard.writeText(text);
    toast({ title: "Data copied to clipboard" });
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const columns = useMemo((): DataTableColumn<PendingProject>[] => [
    { id: "pid", header: "#P-ID", cell: (r) => <span className="font-bold text-zinc-400">#{r.projectNumber || "N/A"}</span> },
    {
      id: "project",
      header: "Projects",
      cell: (r) => {
        const rejectedAtTime = r.rejectedAt ? new Date(r.rejectedAt).getTime() : 0;
        const verifiedAtTime = r.verifiedAt ? new Date(r.verifiedAt).getTime() : 0;
        const isVerifiedNow = verifiedAtTime > rejectedAtTime;
        const showRejection = !!r.rejectionReason && !isVerifiedNow;
        return (
          <div>
            <div className="mb-1 font-bold text-zinc-800 dark:text-zinc-200">{r.serviceType || r.project}</div>
            <div className="text-xs font-medium text-blue-500">{r.company}</div>
            {showRejection ? (
              <div className="mt-2 rounded-sm border border-red-100 bg-red-50 p-1.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-900/20">
                <span className="font-bold">Rejected Reason:</span> {r.rejectionReason}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => {
        const rejectedAtTime = r.rejectedAt ? new Date(r.rejectedAt).getTime() : 0;
        const verifiedAtTime = r.verifiedAt ? new Date(r.verifiedAt).getTime() : 0;
        const isVerifiedNow = verifiedAtTime > rejectedAtTime;
        const showRejection = !!r.rejectionReason && !isVerifiedNow;
        if (r.sentToManager && !isVerifiedNow) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              Sent to {departmentLabel(r.departmentType)}
            </span>
          );
        }
        if (showRejection) {
          return <span className="inline-flex rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-medium text-red-700">Re-Upload</span>;
        }
        return (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
              r.status === "Documents Pending" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-100 text-emerald-700"
            }`}
          >
            {r.status}
          </span>
        );
      },
    },
    {
      id: "hod",
      header: "Hod",
      cell: (r) =>
        r.hodApprovedAt ? (
          <span className="font-bold text-emerald-600">Verified</span>
        ) : (
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Waiting
          </span>
        ),
    },
    {
      id: "account",
      header: "Account",
      cell: (r) =>
        r.accountsApprovedAt ? (
          <span className="font-bold text-emerald-600">Verified</span>
        ) : (
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Waiting
          </span>
        ),
    },
    {
      id: "dep",
      header: "Dep",
      cell: (r) => {
        const rejectedAtTime = r.rejectedAt ? new Date(r.rejectedAt).getTime() : 0;
        const verifiedAtTime = r.verifiedAt ? new Date(r.verifiedAt).getTime() : 0;
        const isVerifiedNow = verifiedAtTime > rejectedAtTime;
        const showRejection = !!r.rejectionReason && !isVerifiedNow;
        if (showRejection) {
          return <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">Waiting</span>;
        }
        if (isVerifiedNow) return <span className="font-bold text-emerald-600">Verified</span>;
        return <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">Waiting</span>;
      },
    },
    { id: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
    {
      id: "action",
      header: "Action",
      cell: (r) => {
        const rejectedAtTime = r.rejectedAt ? new Date(r.rejectedAt).getTime() : 0;
        const verifiedAtTime = r.verifiedAt ? new Date(r.verifiedAt).getTime() : 0;
        const isVerifiedNow = verifiedAtTime > rejectedAtTime;
        if (isVerifiedNow) {
          return (
            <button
              disabled
              title="This document has already been verified by the department — no further upload is needed."
              className="flex cursor-not-allowed items-center gap-1.5 rounded-sm border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Documents
            </button>
          );
        }
        if (r.sentToManager) {
          return (
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600">
                ✓ Documents Sent {r.rejectionReason ? "Again " : ""}to {departmentLabel(r.departmentType)}
              </span>
              <button
                onClick={() => handleUploadClick(r.id)}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 underline transition-colors hover:text-zinc-700"
              >
                {r.rejectionReason ? "Re-send again" : "Upload again"}
              </button>
            </div>
          );
        }
        return (
          <button
            onClick={() => handleUploadClick(r.id)}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-1.5 rounded-sm bg-emerald-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {uploadMutation.isPending && selectedProjectId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload Documents
          </button>
        );
      },
    },
  ], [uploadMutation.isPending, selectedProjectId]);

  return (
    <PmsShell title="Pending Approvals (Documents)" description="Upload documents for projects awaiting approval.">
      <DrmSection
        title="Projects"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
              Copy
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => exportToExcel(filteredData, exportColumns, "Pending_Approvals")}>
              Excel
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => exportToCSV(filteredData, exportColumns, "Pending_Approvals")}>
              CSV
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => exportToPDF(filteredData, exportColumns, "Pending_Approvals", { title: "Pending Approvals" })}>
              PDF
            </Button>
            <Input type="search" placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-52" aria-label="Search pending projects" />
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={filteredData}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={isError ? "Failed to load pending projects." : null}
          onRetry={() => refetch()}
          emptyMessage="No pending documents to upload."
          className="min-w-[1100px]"
        />
      </DrmSection>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Project Detail</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field id="pp-company" label="Company Name">
                <Input readOnly value={selectedProject?.company || ""} className="bg-zinc-100 dark:bg-zinc-800" />
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedProject ? (selectedProject.projectNumber ? `${selectedProject.project} (#${selectedProject.projectNumber})` : selectedProject.project) : ""}
                </p>
              </Field>
              <Field id="pp-package" label="Package">
                <Select value={uploadFormData.packageName} onValueChange={(v) => setUploadFormData((prev) => ({ ...prev, packageName: v }))}>
                  <SelectTrigger id="pp-package">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Basic Plus">Basic Plus</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Verified Supplier">Verified Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="pp-minisite" label="Minisite Url">
                <Input
                  placeholder="Minisite Url"
                  value={uploadFormData.minisiteUrl}
                  onChange={(e) => setUploadFormData((prev) => ({ ...prev, minisiteUrl: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field id="pp-phone" label="Phone">
                <Input placeholder="Phone" maxLength={11} value={uploadFormData.phone} onChange={(e) => setUploadFormData((prev) => ({ ...prev, phone: e.target.value }))} />
              </Field>
              <Field id="pp-mobile" label="Mobile">
                <Input placeholder="Mobile" maxLength={11} value={uploadFormData.mobile} onChange={(e) => setUploadFormData((prev) => ({ ...prev, mobile: e.target.value }))} />
              </Field>
              <Field id="pp-address" label="Address">
                <Input placeholder="Address" value={uploadFormData.address} onChange={(e) => setUploadFormData((prev) => ({ ...prev, address: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field id="pp-reference" label="Reference">
                <Input placeholder="Reference Website" value={uploadFormData.reference} onChange={(e) => setUploadFormData((prev) => ({ ...prev, reference: e.target.value }))} />
              </Field>
              <Field id="pp-categories" label="Categories">
                <Input placeholder="Enter categories" value={uploadFormData.categories} onChange={(e) => setUploadFormData((prev) => ({ ...prev, categories: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field id="pp-detail" label="Detail">
                <Textarea rows={4} value={uploadFormData.detailNotes} onChange={(e) => setUploadFormData((prev) => ({ ...prev, detailNotes: e.target.value }))} />
              </Field>
              <Field id="pp-file" label="Add Logo/Banner/Certificates">
                <div className="flex h-10 w-full items-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <label className="mr-2 cursor-pointer rounded-sm border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                    Choose file
                    <input type="file" className="hidden" onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <span className="truncate text-xs text-zinc-400">{documentFile?.name || "No file chosen"}</span>
                </div>
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Upload
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PmsShell>
  );
}
