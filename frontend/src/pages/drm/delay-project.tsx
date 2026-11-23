import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { LayoutGrid, ArrowLeft, Pencil } from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DELAY_SECTIONS: { id: string; label: string }[] = [
    { id: "ab-doc", label: "Ab-Doc" },
    { id: "vas-doc", label: "Vas-Doc" },
    { id: "hod", label: "Hod" },
    { id: "dep-not-assign", label: "Dep Not Assign" },
    { id: "not-start", label: "Not Start" },
    { id: "qa-dep", label: "Qa-Dep" },
    { id: "vf-dep", label: "Vf-Dep" },
    { id: "all", label: "All" },
];

export default function DelayProjectPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [section, setSection] = useState("ab-doc");
    const [departmentId, setDepartmentId] = useState("all");
    const [userFilter, setUserFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const { toast } = useToast();

    const handleBack = () => {
        window.history.back();
    };

    const { data: departments } = useQuery<{ id: string; name: string }[]>({
        queryKey: ["/api/drm/delay-projects/departments"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/delay-projects/departments");
            return res.json();
        },
    });

    const { data: persons } = useQuery<{ id: string; name: string }[]>({
        queryKey: ["/api/drm/delay-projects/persons", departmentId],
        queryFn: async () => {
            const q =
                departmentId !== "all"
                    ? `?departmentId=${encodeURIComponent(departmentId)}`
                    : "";
            const res = await apiRequest("GET", `/api/drm/delay-projects/persons${q}`);
            return res.json();
        },
    });

    const { data: sectionCounts } = useQuery<Record<string, number>>({
        queryKey: ["/api/drm/delay-projects/counts"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/delay-projects?counts=1");
            const json = await res.json();
            return json.counts as Record<string, number>;
        },
    });

    const buildQuery = () => {
        const params = new URLSearchParams();
        params.set("section", section);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (departmentId !== "all") params.set("departmentId", departmentId);
        if (userFilter !== "all") params.set("userId", userFilter);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        return params.toString();
    };

    const { data: response, isLoading, refetch, isFetching } = useQuery<any>({
        queryKey: ["/api/hod/projects/delayed", section, departmentId, userFilter, startDate, endDate, searchQuery, page],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/projects/delayed?${buildQuery()}`);
            return res.json();
        },
    });

    const delayedProjects = response?.data || [];
    const totalRecords = response?.total ?? delayedProjects.length;

    // Edit dialog state — reschedules the deadline (and/or leaves a note) on the
    // real project row via the existing, authorized PUT /api/pms/projects/:id
    // metadata-edit endpoint. Pushing the deadline forward is also what makes a
    // project naturally drop off this list, since the backing query filters on
    // `end_date < NOW()`.
    const [editingRow, setEditingRow] = useState<any>(null);
    const [editDeadline, setEditDeadline] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);

    const openEdit = (row: any) => {
        setEditingRow(row);
        setEditDeadline(row.deadline ? new Date(row.deadline).toISOString().slice(0, 10) : "");
        setEditNotes("");
        setIsEditOpen(true);
    };

    const updateProjectMutation = useMutation({
        mutationFn: async (payload: { endDate?: string; notes?: string }) => {
            const res = await apiRequest("PUT", `/api/pms/projects/${editingRow.id}`, payload);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Project updated", description: "Delayed project has been updated." });
            queryClient.invalidateQueries({ queryKey: ['/api/hod/projects/delayed'] });
            setIsEditOpen(false);
        },
        onError: (err: any) => {
            toast({ title: "Update failed", description: err?.message ?? "Error", variant: "destructive" });
        },
    });

    const handleSaveEdit = () => {
        if (!editingRow) return;
        const payload: { endDate?: string; notes?: string } = {};
        if (editDeadline) payload.endDate = editDeadline;
        if (editNotes.trim()) payload.notes = editNotes.trim();
        if (Object.keys(payload).length === 0) {
            toast({ title: "Nothing to save", description: "Change the deadline or add a note first.", variant: "destructive" });
            return;
        }
        updateProjectMutation.mutate(payload);
    };

    const filteredData = delayedProjects;

    const applyFilters = () => {
        setPage(1);
        refetch();
    };

    const generateTooltip = (label: string, row: any) => {
        const colKeyMap: Record<string, string> = {
            'HOD': 'hod',
            'VAS Docs': 'vasDocs',
            'Dep App': 'depApp',
            'QA Dep Pending': 'qaDepP',
            'Vfy Dep Pending': 'vfyDepP'
        };
        const value = row[colKeyMap[label] || label.toLowerCase()] || "N/A";
        const isNA = value === "N/A";
        const createDate = row.createDate ? new Date(row.createDate).toLocaleDateString() : "00/00/0000";
        const deadLineDate = row.deadline ? new Date(row.deadline).toLocaleDateString() : "00/00/0000";
        const actionDate = isNA ? "N/A" : (value === "0" ? "DONE" : "PENDING");

        return `Create : ${createDate} | Status : ${actionDate} | Dead Line : ${deadLineDate} | DELAY DAYS : ${row.days || 0}`;
    };

    const renderBadge = (row: any, colKey: string, label: string) => {
        const value = row[colKey] || "N/A";
        let colors = {
            bg: "bg-[#f4f6f8] dark:bg-zinc-800",
            text: "text-[#9ba3af] dark:text-zinc-400",
            border: "border border-[#eaedf1] dark:border-zinc-700",
            tooltipBg: "bg-white dark:bg-zinc-900",
            tooltipText: "text-[#333] dark:text-zinc-300 shadow-lg",
            tooltipBorder: "border border-gray-200 dark:border-slate-700"
        };
        
        if (value === "0") {
            colors = {
                bg: "bg-[#0f8c5b]",
                text: "text-white",
                border: "shadow-sm shadow-[#0f8c5b]/20",
                tooltipBg: "bg-[#0f8c5b]",
                tooltipText: "text-white shadow-lg shadow-[#0f8c5b]/30",
                tooltipBorder: "border border-[#0f8c5b]"
            };
        } else if (value !== "N/A") {
            colors = {
                bg: "bg-[#dd3b4a]",
                text: "text-white",
                border: "shadow-sm shadow-[#dd3b4a]/20",
                tooltipBg: "bg-[#dd3b4a]",
                tooltipText: "text-white shadow-lg shadow-[#dd3b4a]/30",
                tooltipBorder: "border border-[#dd3b4a]"
            };
        }

        const tooltipText = generateTooltip(label, row);

        return (
            <div className="relative group/badge flex justify-center m-auto w-fit">
                <div className={`w-7 h-7 rounded-full ${colors.bg} ${colors.border} ${colors.text} font-semibold text-[11px] flex items-center justify-center relative z-10 cursor-help transition-all`}>
                    {value}
                </div>
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded shadow-lg ${colors.tooltipBg} ${colors.tooltipText} ${colors.tooltipBorder} text-[11.5px] font-bold whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-50 flex items-center gap-2`}>
                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${colors.tooltipBg} ${colors.tooltipBorder} border-t-0 border-l-0`}></div>
                    {tooltipText.split('|').map((part, index, array) => (
                        <React.Fragment key={index}>
                            <span>{part.trim()}</span>
                            {index < array.length - 1 && (
                                <span className={value === "N/A" ? "text-gray-400 font-normal px-0.5" : "text-white/80 font-normal px-0.5"}>|</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 min-h-screen bg-[#f4f6f9] font-sans dark:bg-zinc-950">
            <div className="mb-6 flex items-center gap-3">
                <button 
                    onClick={handleBack}
                    className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-600 bg-white shadow-sm border border-gray-100 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                    title="Back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <h1 className="text-[17px] font-bold text-[#495057] uppercase tracking-wide dark:text-zinc-400">DELAY PROJECTS</h1>
                    <div className="bg-[#41a877] text-white p-[3px] rounded-sm">
                        <LayoutGrid size={14} />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded border border-gray-100 shadow-sm p-4 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mb-4">
                    <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">Department</label>
                        <select
                            value={departmentId}
                            onChange={(e) => {
                                setDepartmentId(e.target.value);
                                setUserFilter("all");
                            }}
                            className="w-full h-10 text-sm border border-gray-200 rounded px-2 dark:bg-zinc-900 dark:border-zinc-800"
                        >
                            <option value="all">All</option>
                            {(departments ?? []).map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">Select Person</label>
                        <select
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            className="w-full h-10 text-sm border border-gray-200 rounded px-2 dark:bg-zinc-900 dark:border-zinc-800"
                        >
                            <option value="all">All</option>
                            {(persons ?? []).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">Start Date</label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 text-sm" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">End Date</label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 text-sm" />
                    </div>
                    <div className="md:col-span-2 xl:col-span-2 flex items-end">
                        <Button
                            type="button"
                            onClick={applyFilters}
                            className="w-full h-10 bg-[#0f8c5b] hover:bg-[#0d7a4f] text-white"
                            disabled={isFetching}
                        >
                            {isFetching ? "Loading..." : "View"}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-100 pb-3 dark:border-zinc-800">
                    {DELAY_SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSection(s.id); setPage(1); }}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                                section === s.id
                                    ? "bg-[#0f8c5b] text-white border-[#0f8c5b]"
                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0f8c5b] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                            }`}
                        >
                            {s.label}
                            {sectionCounts?.[s.id] != null ? ` (${sectionCounts[s.id]})` : ""}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <Input
                        type="text"
                        placeholder="Search by Company, Project, Project ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                        className="w-full text-[13px] border-gray-200 focus-visible:ring-0 focus-visible:border-gray-300 h-10 dark:border-zinc-800"
                    />
                </div>

                <div className="overflow-x-auto custom-scrollbar pb-16">
                    <table className="w-full border-collapse text-left whitespace-nowrap min-w-[1200px]">
                        <thead>
                            <tr className="bg-[#f8f9fa] border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">S.No</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Pro Id</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Create</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Project</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Company</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Person</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Dep</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">HOD</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">VAS Docs</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Dep App</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Dep Not Assign</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Task Not Start</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Dep Not End</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">QA Dep Pending</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Vfy Dep Pending</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Project Dead Line</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Days</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={18} className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        Loading delayed projects...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={18} className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        No matching records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors">
                                        <td className="px-3 py-4">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded border-gray-300 text-[#41a877] focus:ring-[#41a877] dark:border-zinc-800 dark:text-zinc-400" />
                                                <span className="text-[13px] text-gray-600 dark:text-zinc-300">{idx + 1}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">T:/P:{(row.id || "N/A").split('-')[0]}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.createDate ? new Date(row.createDate).toLocaleDateString() : "00/00/0000"}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.project || "No Project"}</td>
                                        <td className="px-3 py-4 text-[13px] font-semibold text-[#0f8c5b] uppercase dark:text-zinc-400">{row.company || "N/A"}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.person || "Unknown"}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.dep || "N/A"}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'hod', 'HOD')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'vasDocs', 'VAS Docs')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'depApp', 'Dep App')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'depNotAssign', 'Dep Not Assign')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'taskNotStart', 'Task Not Start')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'depNotEnd', 'Dep Not End')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'qaDepP', 'QA Dep Pending')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'vfyDepP', 'Vfy Dep Pending')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'projectDeadLine', 'Project Dead Line')}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 text-center font-bold text-[#dd3b4a] dark:text-zinc-300">{row.days || 0}</td>
                                        <td className="px-3 py-4 text-center">
                                            {!row.legacySource && (
                                                <button
                                                    onClick={() => openEdit(row)}
                                                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#0f8c5b] transition-colors dark:hover:bg-zinc-800"
                                                    title="Reschedule deadline / add note"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <span className="text-[13px] text-[#828a96]">
                        Showing {(page - 1) * pageSize + (filteredData.length ? 1 : 0)} to{" "}
                        {(page - 1) * pageSize + filteredData.length} of {totalRecords} entries
                        {response?.source === "legacy" ? " (legacy archive)" : ""}
                    </span>

                    <div className="flex gap-1 items-center">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="text-[13px] text-gray-600 hover:bg-gray-50 px-2 py-1 rounded disabled:opacity-40 dark:hover:bg-zinc-800"
                        >
                            ‹
                        </button>
                        <span className="text-[13px] text-white bg-[#0f8c5b] rounded-full min-w-7 h-7 px-2 flex items-center justify-center font-bold">
                            {page}
                        </span>
                        <button
                            type="button"
                            disabled={page * pageSize >= totalRecords}
                            onClick={() => setPage((p) => p + 1)}
                            className="text-[13px] text-gray-600 hover:bg-gray-50 px-2 py-1 rounded disabled:opacity-40 dark:hover:bg-zinc-800"
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit dialog — real, persisting action against the existing
                PUT /api/pms/projects/:id endpoint (server/pms-routes.ts). Only
                deadline and notes are editable here: that endpoint deliberately
                fails closed on workflow-sensitive fields like status/isDeleted,
                which are owned by WorkflowTransitionService, not a generic edit. */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Reschedule Delayed Project</DialogTitle>
                        <DialogDescription>
                            {editingRow?.project || "Project"} — {editingRow?.company || "N/A"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">New Deadline</label>
                            <Input
                                type="date"
                                value={editDeadline}
                                onChange={(e) => setEditDeadline(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Note</label>
                            <Textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Reason for delay / remediation plan..."
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={updateProjectMutation.isPending}>
                            {updateProjectMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
