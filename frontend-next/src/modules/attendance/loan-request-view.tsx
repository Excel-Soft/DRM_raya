"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiRequestJson } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/legacy/button";
import { Input } from "@/components/ui/input";
import type { LoanRequest } from "@/modules/attendance/attendance-types";
import {
  AttendanceActionButton,
  AttendanceExportBar,
  AttendanceShell,
  AttendanceTable,
  AttendanceToolbar,
  DrmInlineActions,
  DrmSection,
  attTableBodyCellClass,
  attTableBodyRowClass,
  attTableHeadCellClass,
  attTableHeadRowClass,
  drmFieldClass,
} from "@/modules/attendance/attendance-ui";
import { cn } from "@/lib/utils/cn";
import { Trash2, CheckCircle, XCircle } from "lucide-react";

// ─── Role helpers ────────────────────────────────────────────────────────────
function getActiveRole(): string {
  return (
    (typeof window !== "undefined"
      ? sessionStorage.getItem("userRole") ?? ""
      : ""
    )
      .toLowerCase()
      .replace(/\s+/g, "_")
  );
}

// Mirrors the literal role keys in backend/src/shared/roles.ts — kept as an
// explicit list (not a shared import) since frontend's @shared alias points
// at a different folder than the backend's. Covers every manager/assistant-
// manager tier, not just sales, so service/dd/it/etc. managers correctly get
// the team view instead of silently falling through to the executive one.
const MANAGER_ROLES = [
  "sales_manager", "sales_assistant_manager",
  "service_manager", "service_assistant_manager",
  "account_manager", "product_posting_manager",
  "qa_manager", "verification_manager",
  "dd_manager", "it_manager", "reception_manager",
  "seo_smm_manager", "software_manager",
  "lead_manager", "marketing_manager", "complaint_manager",
  "manager",
];
const HOD_ROLES = ["hod", "super_hod", "admin"];

function isManagerialRole(role: string) {
  return MANAGER_ROLES.includes(role) || HOD_ROLES.includes(role);
}

// ─── Component ───────────────────────────────────────────────────────────────
export function LoanRequestView() {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const userRoleName = getActiveRole();

    const isSalesExecutive      = userRoleName === "sales_executive";
    const isManager             = MANAGER_ROLES.includes(userRoleName);
    const isHod                 = HOD_ROLES.includes(userRoleName);
    const isManagerOrHigher     = isManager || isHod;

    // Managers see team loans; executives see own loans
    const loansQueryKey = isManagerOrHigher ? ["/api/admin/loans/team"] : ["/api/loans"];
    const loansEndpoint = isManagerOrHigher ? "/api/admin/loans/team" : "/api/loans";

    // Tabs — managers skip ADD LOAN
    type TabType = "list" | "add" | "history";
    const [activeTab, setActiveTab] = useState<TabType>("list");

    // Add form state (only for executive/self)
    const [addForm, setAddForm] = useState({
        employee: sessionStorage.getItem("userName") || "",
        amount: "",
        instalment: "",
        detail: "",
    });

    // History form state
    const [historyForm, setHistoryForm] = useState({
        employee: sessionStorage.getItem("userName") || "",
        start: "",
        end: "",
    });
    const [appliedStart, setAppliedStart] = useState("");
    const [appliedEnd,   setAppliedEnd]   = useState("");

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: loanRequests, isLoading: loadingRequests, isError: loansError } = useQuery<LoanRequest[]>({
        queryKey: loansQueryKey,
        queryFn: () => apiRequestJson<LoanRequest[]>("GET", loansEndpoint),
    });

    // ── Mutations ────────────────────────────────────────────────────────────
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/loans/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: loansQueryKey });
            queryClient.invalidateQueries({ queryKey: ["/api/loans/stats"] });
            toast({ title: "Loan request deleted successfully" });
        },
        onError: () => toast({ title: "Failed to delete loan request", variant: "destructive" }),
    });

    const addMutation = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/loans", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: loansQueryKey });
            toast({ title: "Loan added successfully" });
            setAddForm({ employee: sessionStorage.getItem("userName") || "", amount: "", instalment: "", detail: "" });
            setActiveTab("list");
        },
        onError: () => toast({ title: "Failed to add loan", variant: "destructive" }),
    });

    const managerApproveMutation = useMutation({
        mutationFn: async (id: string) => apiRequest("PATCH", `/api/loans/${id}/manager-approve`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: loansQueryKey });
            toast({ title: "Loan approved by manager ✓" });
        },
        onError: (err: any) => toast({ title: "Approval failed", description: err?.message, variant: "destructive" }),
    });

    const hodApproveMutation = useMutation({
        mutationFn: async (id: string) => apiRequest("PATCH", `/api/loans/${id}/hod-approve`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: loansQueryKey });
            toast({ title: "Loan HOD-approved ✓" });
        },
        onError: (err: any) => toast({ title: "HOD approval failed", description: err?.message, variant: "destructive" }),
    });

    const rejectMutation = useMutation({
        mutationFn: async (id: string) => apiRequest("PATCH", `/api/loans/${id}/reject`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: loansQueryKey });
            toast({ title: "Loan rejected" });
        },
        onError: (err: any) => toast({ title: "Rejection failed", description: err?.message, variant: "destructive" }),
    });

    // ── Export ───────────────────────────────────────────────────────────────
    const exportData = (formatType: "copy" | "csv" | "excel" | "pdf") => {
        if (!loanRequests || loanRequests.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const headers = ["No#", "Employee", "Advance", "Detail", "Instalment", "Remaining", "Manager", "HOD", "Date"];
        const rows = loanRequests.map((loan, idx) => [
            (idx + 1).toString(),
            (loan as any).userName || "Employee",
            loan.amount.toString(),
            loan.detail ?? "",
            loan.installmentAmount.toString(),
            loan.remainingAmount.toString(),
            loan.managerApprovedByUserId ? "Approved" : "Pending",
            loan.hodApprovedByUserId     ? "Approved" : "Pending",
            loan.createdAt ? format(new Date(loan.createdAt), "MMM d, yyyy") : "-",
        ]);

        if (formatType === "copy") {
            const text = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
            navigator.clipboard.writeText(text);
            toast({ title: "Data copied to clipboard" });
        } else if (formatType === "csv" || formatType === "excel") {
            const csv  = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
            const mime = formatType === "csv" ? "text/csv" : "application/vnd.ms-excel";
            const ext  = formatType === "csv" ? "csv" : "xls";
            const blob = new Blob([csv], { type: mime });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `advance-salary.${ext}`;
            link.click();
            toast({ title: `${formatType.toUpperCase()} file downloaded` });
        } else if (formatType === "pdf") {
            window.print();
        }
    };

    // ── Filter ───────────────────────────────────────────────────────────────
    const filteredRequests = (Array.isArray(loanRequests) ? loanRequests : []).filter((l) => {
        if (activeTab === "history") {
            if (appliedStart && l.createdAt) {
                const d = new Date(appliedStart); d.setHours(0, 0, 0, 0);
                if (new Date(l.createdAt).getTime() < d.getTime()) return false;
            }
            if (appliedEnd && l.createdAt) {
                const d = new Date(appliedEnd); d.setHours(23, 59, 59, 999);
                if (new Date(l.createdAt).getTime() > d.getTime()) return false;
            }
        }
        if (!searchQuery) return true;
        const q  = searchQuery.toLowerCase();
        const nm = ((l as any).userName || "Employee").toLowerCase();
        return nm.includes(q) || l.detail?.toLowerCase().includes(q) || l.status?.toLowerCase().includes(q);
    });

    const handleAddSubmit = () => {
        if (!addForm.amount || !addForm.instalment) {
            toast({ title: "Amount and Instalment are required", variant: "destructive" });
            return;
        }
        addMutation.mutate({
            amount:            addForm.amount,
            installmentAmount: addForm.instalment,
            remainingAmount:   addForm.amount,
            detail:            addForm.detail,
            status:            "Pending",
        });
    };

    // ── Status label helper ───────────────────────────────────────────────────
    function statusBadge(status: string) {
        const map: Record<string, string> = {
            Pending:         "bg-yellow-100 text-yellow-700",
            ManagerApproved: "bg-blue-100 text-blue-700",
            HODApproved:     "bg-green-100 text-green-700",
            Rejected:        "bg-red-100 text-red-700",
            Completed:       "bg-gray-100 text-gray-600",
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
                {status}
            </span>
        );
    }

    const loanTabItems = [
        {
            id: "list",
            label: isManagerOrHigher ? "Team loan list" : "Advance salary list",
            onClick: () => setActiveTab("list"),
            active: activeTab === "list",
        },
        ...(!isManagerOrHigher
            ? [{
                id: "add",
                label: "Add loan",
                onClick: () => setActiveTab("add"),
                active: activeTab === "add",
            }]
            : []),
        {
            id: "history",
            label: "Loan history",
            onClick: () => setActiveTab("history"),
            active: activeTab === "history",
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <AttendanceShell
            title="Loan / advance salary"
            description={
                isManagerOrHigher
                    ? "Review and approve team loan requests."
                    : "Apply for advance salary and track repayment."
            }
            actions={<DrmInlineActions items={loanTabItems} />}
        >
            {isManagerOrHigher && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
                    <strong>Manager view:</strong> Showing loan requests from your team. To apply for your own loan, switch to your executive role.
                </div>
            )}

            <DrmSection
                title={
                    activeTab === "add"
                        ? "New loan request"
                        : activeTab === "history"
                          ? "Loan history"
                          : isManagerOrHigher
                            ? "Team loans"
                            : "Your loans"
                }
            >
                <div className="space-y-4">

                    {/* ── Add form (executive only) ── */}
                    {activeTab === "add" && !isManagerOrHigher && (
                        <div className="mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Employee</label>
                                    <Input value={addForm.employee} readOnly className="h-9 text-[13px] bg-gray-200 cursor-not-allowed dark:bg-zinc-800" />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Amount:</label>
                                    <Input
                                        type="number" placeholder="00:00"
                                        value={addForm.amount}
                                        onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                                        className="h-9 text-[13px]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Instalment:</label>
                                    <Input
                                        type="number" placeholder="Instalment"
                                        value={addForm.instalment}
                                        onChange={(e) => setAddForm({ ...addForm, instalment: e.target.value })}
                                        className="h-9 text-[13px]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Detail</label>
                                    <Input
                                        placeholder="add detail"
                                        value={addForm.detail}
                                        onChange={(e) => setAddForm({ ...addForm, detail: e.target.value })}
                                        className="h-9 text-[13px]"
                                    />
                                </div>
                            </div>
                            <AttendanceActionButton onClick={handleAddSubmit} disabled={addMutation.isPending}>
                                Submit
                            </AttendanceActionButton>
                        </div>
                    )}

                    {/* ── History filters ── */}
                    {activeTab === "history" && (
                        <div className="mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {!isManagerOrHigher && (
                                    <div>
                                        <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Employee</label>
                                        <Input value={historyForm.employee} readOnly className="h-9 text-[13px] bg-gray-200 cursor-not-allowed dark:bg-zinc-800" />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Start:</label>
                                    <Input
                                        type="date"
                                        value={historyForm.start}
                                        onChange={(e) => setHistoryForm({ ...historyForm, start: e.target.value })}
                                        className="h-9 text-[13px]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">End:</label>
                                    <Input
                                        type="date"
                                        value={historyForm.end}
                                        onChange={(e) => setHistoryForm({ ...historyForm, end: e.target.value })}
                                        className="h-9 text-[13px]"
                                    />
                                </div>
                            </div>
                            <AttendanceActionButton
                                onClick={() => {
                                  setAppliedStart(historyForm.start);
                                  setAppliedEnd(historyForm.end);
                                }}
                            >
                                Apply dates
                            </AttendanceActionButton>
                        </div>
                    )}

                    {/* ── Table controls ── */}
                    <AttendanceToolbar
                      left={
                        <AttendanceExportBar
                          labels={["Copy", "Excel", "CSV", "PDF"]}
                          onAction={(label) => exportData(label.toLowerCase() as "copy" | "excel" | "csv" | "pdf")}
                        />
                      }
                      right={
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Search
                          <Input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn(drmFieldClass, "mt-1 h-9 w-48 text-sm")}
                          />
                        </label>
                      }
                    />

                    <AttendanceTable minWidth="1100px">
                            <thead>
                                <tr className={attTableHeadRowClass}>
                                    {["#", "Employee", "Advance", "Detail", "Instalment", "Remaining", "Status", "Manager", "HOD", "Date", "Action"].map((h) => (
                                      <th key={h} className={attTableHeadCellClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loadingRequests ? (
                                    <tr>
                                        <td colSpan={11} className="px-3 py-4 text-[13px] text-center text-[#495057] dark:text-zinc-400">
                                            Loading…
                                        </td>
                                    </tr>
                                ) : loansError ? (
                                    <tr>
                                        <td colSpan={11} className="px-3 py-4 text-[13px] text-center text-red-500">
                                            Could not load loan requests. Please try again.
                                        </td>
                                    </tr>
                                ) : filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-3 py-4 text-[13px] text-[#495057] text-center dark:text-zinc-400">
                                            No data available in table
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map((loan, idx) => (
                                        <tr key={loan.id} className={attTableBodyRowClass}>
                                            <td className={attTableBodyCellClass}>{idx + 1}</td>
                                            <td className={attTableBodyCellClass}>{(loan as any).userName || "Employee"}</td>
                                            <td className={attTableBodyCellClass}>{loan.amount}</td>
                                            <td className={attTableBodyCellClass}>{loan.detail}</td>
                                            <td className={attTableBodyCellClass}>{loan.installmentAmount}</td>
                                            <td className={attTableBodyCellClass}>{loan.remainingAmount}</td>
                                            <td className={attTableBodyCellClass}>{statusBadge(loan.status ?? "Pending")}</td>
                                            <td className={attTableBodyCellClass}>
                                                {loan.managerApprovedByUserId ? "✓ Approved" : "—"}
                                            </td>
                                            <td className={attTableBodyCellClass}>
                                                {loan.hodApprovedByUserId ? "✓ Approved" : "—"}
                                            </td>
                                            <td className={attTableBodyCellClass}>
                                                {loan.createdAt ? format(new Date(loan.createdAt), "MMM d, yyyy") : "—"}
                                            </td>
                                            <td className={attTableBodyCellClass}>
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {/* Manager approve — shown when Pending and user is manager */}
                                                    {isManagerOrHigher && loan.status === "Pending" && (
                                                        <button
                                                            title="Manager Approve"
                                                            onClick={() => managerApproveMutation.mutate(loan.id)}
                                                            disabled={managerApproveMutation.isPending}
                                                            className="w-7 h-7 bg-green-50 text-green-600 rounded flex items-center justify-center hover:bg-green-100 border border-green-200"
                                                        >
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {/* HOD approve — shown when ManagerApproved and user is HOD */}
                                                    {isHod && loan.status === "ManagerApproved" && (
                                                        <button
                                                            title="HOD Approve"
                                                            onClick={() => hodApproveMutation.mutate(loan.id)}
                                                            disabled={hodApproveMutation.isPending}
                                                            className="w-7 h-7 bg-blue-50 text-blue-600 rounded flex items-center justify-center hover:bg-blue-100 border border-blue-200"
                                                        >
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {/* Reject — manager can reject Pending; HOD can reject Pending or ManagerApproved */}
                                                    {isManagerOrHigher && (loan.status === "Pending" || (isHod && loan.status === "ManagerApproved")) && (
                                                        <button
                                                            title="Reject"
                                                            onClick={() => rejectMutation.mutate(loan.id)}
                                                            disabled={rejectMutation.isPending}
                                                            className="w-7 h-7 bg-red-50 text-red-500 rounded flex items-center justify-center hover:bg-red-100 border border-red-100"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {/* Delete — only for own (executive) loans in Pending status */}
                                                    {!isManagerOrHigher && loan.status === "Pending" && (
                                                        <button
                                                            title="Delete"
                                                            onClick={() => deleteMutation.mutate(loan.id)}
                                                            className="w-7 h-7 bg-red-50 text-red-500 rounded flex items-center justify-center hover:bg-red-100 border border-red-100"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {/* Nothing to do */}
                                                    {!isManagerOrHigher && loan.status !== "Pending" && (
                                                        <span className="text-gray-400 text-[12px]">—</span>
                                                    )}
                                                    {isManagerOrHigher && loan.status !== "Pending" && !(isHod && loan.status === "ManagerApproved") && (
                                                        <span className="text-gray-400 text-[12px]">—</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                    </AttendanceTable>

                    {/* ── Summary row when empty ── */}
                    {!loadingRequests && filteredRequests.length === 0 && (
                        <div className="flex border-b border-gray-100 py-3 px-3 dark:border-zinc-800">
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">Total</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">0</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">Remaining</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">0</div>
                            <div className="flex-[4]" />
                        </div>
                    )}

                    {/* ── Totals row when data exists ── */}
                    {!loadingRequests && filteredRequests.length > 0 && (
                        <div className="flex border-b border-gray-100 py-3 px-3 dark:border-zinc-800">
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">Total</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">
                                {filteredRequests.reduce((s, l) => s + parseFloat(String(l.amount ?? 0)), 0).toFixed(2)}
                            </div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">Remaining</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">
                                {filteredRequests.reduce((s, l) => s + parseFloat(String(l.remainingAmount ?? 0)), 0).toFixed(2)}
                            </div>
                            <div className="flex-[4]" />
                        </div>
                    )}

                    {/* ── Footer ── */}
                    <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                        Showing {filteredRequests.length > 0 ? 1 : 0} to {filteredRequests.length} of {filteredRequests.length} entries
                    </div>
                </div>
            </DrmSection>
        </AttendanceShell>
    );
}
