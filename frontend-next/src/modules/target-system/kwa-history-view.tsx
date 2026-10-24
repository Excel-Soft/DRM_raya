"use client";

import { useMemo, useState } from "react";
import { Eye, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/legacy/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query/query-client";
import {
  DrmFormActions,
  DrmSection,
  TargetSystemShell,
  TsFormGrid,
  drmFieldClass,
  tsDialogShellClass,
  tsSelectTriggerClass,
} from "@/modules/target-system/target-system-ui";

type KwaHistoryRow = {
  id: string;
  company: string;
  employee: string;
  amount: number;
  remaining: number | null;
  detail: string | null;
  payDate: string | null;
  kwaType?: string;
  actionType?: string;
  createdAt?: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/,/g, "");
}

export function KwaHistoryPage() {
  const { toast } = useToast();

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const body = await res.json().catch(() => null);
      return body?.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    users.forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(u);
    });
    return Object.entries(grouped)
      .map(([role, list]) => ({ role, users: list }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  const [selectedUser, setSelectedUser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [queryParams, setQueryParams] = useState<{ employee: string; startDate: string; endDate: string } | null>(
    null,
  );

  const listQuery = useQuery<KwaHistoryRow[]>({
    queryKey: ["/api/target-system/kwa-history", queryParams],
    queryFn: async () => {
      if (!queryParams) return [];
      const params = new URLSearchParams();
      params.set("employee", queryParams.employee);
      params.set("startDate", queryParams.startDate);
      params.set("endDate", queryParams.endDate);
      const res = await apiRequest("GET", `/api/target-system/kwa-history?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!queryParams,
  });

  const handleView = () => {
    if (!selectedUser || !startDate || !endDate) {
      toast({ title: "Select a user and both dates first.", variant: "destructive" });
      return;
    }
    setQueryParams({ employee: selectedUser, startDate, endDate });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalFrom, setModalFrom] = useState("");
  const [modalTo, setModalTo] = useState("");

  const modalQuery = useQuery<KwaHistoryRow[]>({
    queryKey: ["/api/target-system/kwa-history", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/target-system/kwa-history");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isModalOpen,
  });

  const filteredModalData = useMemo(() => {
    const allHistory = modalQuery.data ?? [];
    return allHistory.filter((row) => {
      if (modalSearch) {
        const q = modalSearch.toLowerCase();
        const matches = [row.company, row.employee, row.kwaType, row.actionType, row.detail].some((v) =>
          (v || "").toString().toLowerCase().includes(q),
        );
        if (!matches) return false;
      }
      if (modalFrom || modalTo) {
        const rowDate = row.payDate ? new Date(row.payDate) : null;
        if (!rowDate) return false;
        if (modalFrom && rowDate < new Date(modalFrom)) return false;
        if (modalTo && rowDate > new Date(`${modalTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [modalQuery.data, modalSearch, modalFrom, modalTo]);

  const historyColumns = useMemo((): DataTableColumn<KwaHistoryRow>[] => {
    return [
      {
        id: "idx",
        header: "#",
        className: "w-10 tabular-nums text-zinc-500",
        cell: (row) => {
          const rows = listQuery.data ?? [];
          const idx = rows.findIndex((r) => r.id === row.id);
          return idx >= 0 ? idx + 1 : "—";
        },
      },
      { id: "company", header: "Company", cell: (row) => row.company },
      { id: "person", header: "Person", cell: (row) => row.employee },
      {
        id: "pay",
        header: "Pay",
        cell: (row) => <span className="tabular-nums">{row.amount}$</span>,
      },
      {
        id: "remaining",
        header: "Remaining",
        cell: (row) => (
          <span className="tabular-nums">{row.remaining != null ? `${row.remaining}$` : "—"}</span>
        ),
      },
      { id: "detail", header: "Detail", cell: (row) => row.detail || "—" },
      {
        id: "date",
        header: "Date",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500">{formatDateTime(row.payDate)}</span>
        ),
      },
    ];
  }, [listQuery.data]);

  const modalColumns = useMemo((): DataTableColumn<KwaHistoryRow>[] => {
    return [
      {
        id: "idx",
        header: "#",
        cell: (row) => {
          const idx = filteredModalData.findIndex((r) => r.id === row.id);
          return idx >= 0 ? idx + 1 : "—";
        },
      },
      { id: "company", header: "Company", cell: (row) => row.company },
      { id: "person", header: "Person", cell: (row) => row.employee },
      { id: "type", header: "KWA type", cell: (row) => row.kwaType || "—" },
      {
        id: "remaining",
        header: "Remaining",
        cell: (row) => (row.remaining != null ? `${row.remaining}$` : "—"),
      },
      { id: "payDate", header: "Pay date", cell: (row) => formatDateTime(row.payDate) },
      { id: "detail", header: "Details", cell: (row) => row.detail || "—" },
      { id: "amount", header: "Amount", cell: (row) => `${row.amount}$` },
      { id: "action", header: "Action", cell: (row) => row.actionType || "—" },
      { id: "created", header: "Created", cell: (row) => formatDateTime(row.createdAt) },
    ];
  }, [filteredModalData]);

  return (
    <TargetSystemShell title="KWA history" description="Search and review applied KWA history.">
      <DrmSection title="Search" description="Filter by employee and date range.">
        <TsFormGrid cols={4}>
          <Field id="kwa-hist-user" label="User">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className={tsSelectTriggerClass}>
                <SelectValue placeholder="Choose user…" />
              </SelectTrigger>
              <SelectContent>
                {groupedUsers.map(({ role, users: roleUsers }) => (
                  <SelectGroup key={role}>
                    <SelectLabel>{role}</SelectLabel>
                    {roleUsers
                      .filter((u) => u.fullName || u.username)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.fullName || u.username}>
                          {u.fullName || u.username}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="kwa-hist-start" label="Start date">
            <Input
              id="kwa-hist-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={drmFieldClass}
            />
          </Field>
          <Field id="kwa-hist-end" label="End date">
            <Input
              id="kwa-hist-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={drmFieldClass}
            />
          </Field>
        </TsFormGrid>
        <DrmFormActions>
          <Button type="button" variant="primary" size="sm" onClick={handleView}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
            <List className="mr-2 h-4 w-4" />
            View all data
          </Button>
        </DrmFormActions>
      </DrmSection>

      <DrmSection
        title="Results"
        description={
          !queryParams
            ? "Run a search to load history."
            : listQuery.isLoading
              ? "Loading…"
              : `${listQuery.data?.length ?? 0} record(s)`
        }
      >
        {!queryParams ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a user and date range, then click View.
          </p>
        ) : (
          <DataTable
            columns={historyColumns}
            rows={listQuery.data ?? []}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            error={listQuery.isError ? "Could not load KWA history." : null}
            onRetry={() => listQuery.refetch()}
            emptyMessage="No records found for this filter."
            className="min-w-[720px]"
          />
        )}
      </DrmSection>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className={`${tsDialogShellClass} sm:max-w-5xl`}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle>All KWA records</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <TsFormGrid cols={4}>
              <Field id="modal-search" label="Search" className="md:col-span-2">
                <Input
                  id="modal-search"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search all columns…"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="modal-from" label="From">
                <Input
                  id="modal-from"
                  type="date"
                  value={modalFrom}
                  onChange={(e) => setModalFrom(e.target.value)}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="modal-to" label="To">
                <Input
                  id="modal-to"
                  type="date"
                  value={modalTo}
                  onChange={(e) => setModalTo(e.target.value)}
                  className={drmFieldClass}
                />
              </Field>
            </TsFormGrid>
            <DataTable
              columns={modalColumns}
              rows={filteredModalData}
              rowKey={(row) => row.id}
              loading={modalQuery.isLoading}
              emptyMessage="No matching records."
              className="min-w-[900px] max-h-[50vh]"
            />
          </div>
        </DialogContent>
      </Dialog>
    </TargetSystemShell>
  );
}
