import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Send } from "lucide-react";
import { apiRequestJson } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PmsProjectAssignSection } from "@/pages/drm/pms-project-assign-section";

const ADMIN_ROLES = ["admin", "super_admin", "administrator", "adm"];
// Old DRM showed the "Assign Task" action only to these roles (role ids 34, 35, 36, 39, 40, 63).
const ASSIGN_ROLES = [
    "seo_smm_manager", "product_posting_manager", "posting_manager", "posting_assistant_manager",
    "dd_manager", "dnd_manager", "dd_assistant_manager", "software_manager",
];
const PAGE_SIZE = 50;

type ActivityRow = {
    id: string; legacyProId: string; company: string; person: string; project: string;
    status: string; docUpload: string | null; depApproved: string | null; projectId: string | null;
};

const fmtDateTime = (v: string | null) =>
    v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "-";
const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

/** Department managers: old DRM pms-setting.php "List of Project Activity". */
function ProjectActivityList({ role }: { role: string }) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const { data, isLoading, isError } = useQuery<{ items: ActivityRow[] }>({
        queryKey: ["/api/pms/setting/activity", role],
        queryFn: () => apiRequestJson("GET", "/api/pms/setting/activity"),
    });
    const canAssign = ASSIGN_ROLES.includes(role);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const items = data?.items ?? [];
        if (!q) return items;
        return items.filter((r) =>
            [r.id, r.company, r.person, r.project, r.status].some((v) => String(v ?? "").toLowerCase().includes(q)));
    }, [data, search]);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    return (
        <div>
            <h1 className="mb-4 text-[16px] font-bold uppercase tracking-tight text-slate-600 dark:text-zinc-300">List of Project Activity</h1>
            <div className="rounded-md border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">{filtered.length} projects</span>
                    <Input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search..."
                        className="h-8 w-56 text-xs"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                        <thead className="bg-slate-50 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                            <tr>
                                <th className="px-3 py-2">No#</th>
                                <th className="px-3 py-2">Company</th>
                                <th className="px-3 py-2">Person</th>
                                <th className="px-3 py-2">Project</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Doc Upload</th>
                                <th className="px-3 py-2">Dep Approved</th>
                                {canAssign && <th className="px-3 py-2">Action</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Loading...</td></tr>}
                            {isError && <tr><td colSpan={8} className="px-3 py-6 text-center text-red-500">Failed to load projects.</td></tr>}
                            {!isLoading && !isError && rows.length === 0 && (
                                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No records found.</td></tr>
                            )}
                            {rows.map((r) => (
                                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                                    <td className="px-3 py-2 font-bold">{r.id}</td>
                                    <td className="px-3 py-2 font-semibold">{r.company}</td>
                                    <td className="px-3 py-2">{r.person}</td>
                                    <td className="px-3 py-2">{r.project}</td>
                                    <td className="px-3 py-2">
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${r.status === "Start Work" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700"}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(r.docUpload)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.depApproved)}</td>
                                    {canAssign && (
                                        <td className="px-3 py-2">
                                            {r.projectId ? (
                                                <Link href={`/pms/tasks?projectId=${r.projectId}`} title="Assign Task" className="text-red-500 hover:text-red-600">
                                                    <Send className="h-4 w-4" />
                                                </Link>
                                            ) : "-"}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {pages > 1 && (
                    <div className="mt-3 flex items-center justify-end gap-2 text-xs">
                        <Button size="sm" variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>Prev</Button>
                        <span>Page {current} of {pages}</span>
                        <Button size="sm" variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PmsSettingPage() {
    const role = String(sessionStorage.getItem("userRole") || "").trim().toLowerCase().replace(/\s+/g, "_");
    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            {ADMIN_ROLES.includes(role) ? <PmsProjectAssignSection /> : <ProjectActivityList role={role} />}
        </div>
    );
}
