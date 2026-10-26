"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { apiRequest } from "@/lib/query/query-client";
import { PmsShell, DrmSection } from "@/modules/pms/pms-ui";

type ClosedProjectRow = {
  taskId: string;
  title: string | null;
  status: string | null;
  qaReviewedAt: string | null;
  qaLevel: string | null;
  qaRemarks: string | null;
  verificationReviewedAt: string | null;
  verificationLevel: string | null;
  verificationRemarks: string | null;
  companyName: string | null;
  projectName: string | null;
  executive: { id: string; name: string | null } | null;
  timeSpentMinutes: number;
};

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function CompleteClosedProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<ClosedProjectRow[]>({
    queryKey: ["/api/pms/complete-closed-projects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/complete-closed-projects");
      if (!res.ok) throw new Error("Failed to load closed projects.");
      return res.json();
    },
  });

  const rows = data ?? [];

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (row) =>
        (row.companyName || "").toLowerCase().includes(q) ||
        (row.projectName || "").toLowerCase().includes(q) ||
        (row.title || "").toLowerCase().includes(q) ||
        (row.executive?.name || "").toLowerCase().includes(q),
    );
  }, [searchQuery, rows]);

  const columns = useMemo((): DataTableColumn<ClosedProjectRow>[] => [
    { id: "company", header: "Company", cell: (r) => <span className="font-bold">{r.companyName || "—"}</span> },
    {
      id: "project",
      header: "Project / Task",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{r.projectName || "—"}</span>
          <span className="text-xs text-zinc-400">{r.title}</span>
        </div>
      ),
    },
    { id: "executive", header: "Executive", cell: (r) => r.executive?.name || "—" },
    {
      id: "qa",
      header: "QA",
      cell: (r) => (
        <div className="flex flex-col gap-0.5 text-xs">
          {r.qaLevel ? (
            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              {r.qaLevel}
            </span>
          ) : null}
          <span className="text-zinc-400">{formatDateTime(r.qaReviewedAt)}</span>
        </div>
      ),
    },
    {
      id: "verification",
      header: "Verification",
      cell: (r) => (
        <div className="flex flex-col gap-0.5 text-xs">
          {r.verificationLevel ? (
            <span className="inline-flex w-fit rounded-full bg-sky-50 px-2 py-0.5 font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              {r.verificationLevel}
            </span>
          ) : null}
          <span className="text-zinc-400">{formatDateTime(r.verificationReviewedAt)}</span>
        </div>
      ),
    },
    { id: "time", header: "Time Spent", cell: (r) => formatDuration(r.timeSpentMinutes) },
    {
      id: "status",
      header: "Closed On",
      cell: () => (
        <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
          Closed
        </span>
      ),
    },
  ], []);

  return (
    <PmsShell
      title="Complete and Closed Project"
      description="Projects whose task has finished the whole review pipeline — approved by the manager, reviewed by QA, and reviewed by Verification. These no longer show on Task Complete since there's nothing left to action."
    >
      <DrmSection
        title={`${filteredRows.length} closed project${filteredRows.length === 1 ? "" : "s"}`}
        actions={
          <Input
            type="search"
            placeholder="Search company, project, executive…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-60"
            aria-label="Search closed projects"
          />
        }
      >
        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(row) => row.taskId}
          loading={isLoading}
          error={isError ? (error instanceof Error ? error.message : "Failed to load closed projects.") : null}
          onRetry={() => refetch()}
          emptyMessage="No closed projects yet."
          className="min-w-[1100px]"
        />
      </DrmSection>
    </PmsShell>
  );
}
