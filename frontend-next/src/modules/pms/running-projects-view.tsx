"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export/export-utils";
import { PmsShell, DrmSection } from "@/modules/pms/pms-ui";

type RunningProjectLink = {
  url: string;
  label: string | null;
};

type RunningProject = {
  id: string;
  company: string;
  project: string;
  status: string;
  time: string;
  assign: string;
  date: string;
  links: RunningProjectLink[];
};

function linksAsText(links: RunningProjectLink[] | undefined): string {
  return (links || []).map((l) => l.label || l.url).join(", ");
}

const exportColumns: ExportColumn<RunningProject>[] = [
  { key: "company", header: "Company" },
  { key: "project", header: "Project" },
  { key: "status", header: "Status" },
  { key: "time", header: "Time" },
  { key: "assign", header: "Assign" },
  { key: "date", header: "Assign Date" },
  { key: "links", header: "Link", format: (links: RunningProjectLink[]) => linksAsText(links) },
];

export function RunningProjectsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects = [], isLoading, isError, refetch } = useQuery<RunningProject[]>({
    // onlyActiveWork narrows this specifically-named "Running Projects" page
    // to projects with at least one task actually InProgress right now
    // (sales executives only, server-side) — status=Active alone just means
    // "not archived", not "has active work happening". Matches legacy
    // frontend/src/pages/pms-running-projects.tsx exactly.
    queryKey: ["/api/pms/department-status", { status: "Active", onlyActiveWork: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/department-status?status=Active&onlyActiveWork=true");
      if (!res.ok) throw new Error("Failed to fetch running projects");
      return res.json();
    },
  });

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (row) =>
        (row.company || "").toLowerCase().includes(q) ||
        (row.project || "").toLowerCase().includes(q) ||
        (row.assign || "").toLowerCase().includes(q) ||
        (row.status || "").toLowerCase().includes(q) ||
        (row.date || "").toLowerCase().includes(q) ||
        (row.time || "").toLowerCase().includes(q),
    );
  }, [searchQuery, projects]);

  const handleCopy = () => {
    if (filteredData.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = exportColumns.map((c) => c.header);
    const rows = filteredData.map((row) => [
      row.company,
      row.project,
      row.status,
      row.time,
      row.assign,
      row.date,
      linksAsText(row.links),
    ]);
    const text = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    void navigator.clipboard.writeText(text);
    toast({ title: "Data copied to clipboard" });
  };

  const columns = useMemo((): DataTableColumn<RunningProject>[] => {
    return [
      { id: "company", header: "Company", cell: (row) => <span className="font-medium">{row.company}</span> },
      { id: "project", header: "Project", cell: (row) => row.project },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {row.status}
          </span>
        ),
      },
      { id: "time", header: "Time", cell: (row) => row.time },
      { id: "assign", header: "Assign", cell: (row) => row.assign },
      {
        id: "date",
        header: "Assign Date",
        cell: (row) => <span className="whitespace-nowrap">{row.date}</span>,
      },
      {
        id: "link",
        header: "Link",
        cell: (row) =>
          row.links && row.links.length > 0 ? (
            <div className="flex flex-col gap-1">
              {row.links.map((l, idx) => (
                <a
                  key={idx}
                  href={l.url.startsWith("http") ? l.url : `https://${l.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {l.label || l.url}
                </a>
              ))}
            </div>
          ) : (
            <span className="text-zinc-400">—</span>
          ),
      },
    ];
  }, []);

  return (
    <PmsShell title="Running Projects" description="Projects with active work happening right now.">
      <DrmSection
        title="Projects"
        description={isLoading ? undefined : `${filteredData.length} project${filteredData.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
              Copy
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => exportToExcel(filteredData, exportColumns, "Running_Projects")}
            >
              Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => exportToCSV(filteredData, exportColumns, "Running_Projects")}
            >
              CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => exportToPDF(filteredData, exportColumns, "Running_Projects", { title: "Running Projects" })}
            >
              PDF
            </Button>
            <Input
              type="search"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[200px]"
              aria-label="Search running projects"
            />
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={filteredData}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={isError ? "Could not load running projects." : null}
          onRetry={() => refetch()}
          emptyMessage="No running projects found."
          className="min-w-[900px]"
        />
      </DrmSection>
    </PmsShell>
  );
}
