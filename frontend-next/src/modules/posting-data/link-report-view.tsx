"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import { format } from "date-fns";
import { Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import {
  PostingDataShell,
  DrmSection,
  drmFieldClass,
  pdSelectTriggerClass,
  PdFormGrid,
  pdDialogShellClass,
} from "@/modules/posting-data/posting-data-ui";

const BASE = "/api/team-report/link-report";

interface ReportUser {
  id: string;
  name: string;
  fullName?: string | null;
  email?: string;
}

interface LinkRow {
  id: string;
  displayId: string;
  company: string;
  links: string;
  date: string | null;
  sourceModule: string;
  sourceRecordId: string;
  verifyStatus: string;
  verifyNote: string | null;
}

interface ReportSummary {
  total: number;
  totalLinks: number;
  totalDuplicates: number;
  actualLinks: number;
  reward: number;
  commissionVerified: boolean;
  commissionPending: boolean;
  verificationId: string | null;
}

interface ReportResponse {
  rows: LinkRow[];
  summary: ReportSummary;
  canVerify: boolean;
  isSelf: boolean;
}

interface FetchParams {
  userId: string;
  startDate: string;
  endDate: string;
}

export function LinkReportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);
  const [popupDismissedFor, setPopupDismissedFor] = useState<string | null>(null);

  const { data: usersData } = useQuery<{ users: ReportUser[] }>({
    queryKey: [`${BASE}/users`],
    queryFn: async () => {
      const res = await apiRequest("GET", `${BASE}/users`);
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });
  const users = usersData?.users ?? [];

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const { data: reportData, isLoading } = useQuery<ReportResponse>({
    queryKey: [BASE, fetchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("userId", fetchParams!.userId);
      params.set("startDate", fetchParams!.startDate);
      params.set("endDate", fetchParams!.endDate);
      const res = await apiRequest("GET", `${BASE}?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to load link report");
      }
      return res.json();
    },
    enabled: !!fetchParams,
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!fetchParams) return;
      const res = await apiRequest("POST", `${BASE}/verify-commission`, {
        userId: fetchParams.userId,
        startDate: fetchParams.startDate,
        endDate: fetchParams.endDate,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to verify commission");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Commission verified" });
      queryClient.invalidateQueries({ queryKey: [BASE, fetchParams] });
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err?.message, variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (verificationId: string) => {
      const res = await apiRequest("POST", `${BASE}/${verificationId}/confirm`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to confirm commission");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Commission confirmed" });
      queryClient.invalidateQueries({ queryKey: [BASE, fetchParams] });
    },
    onError: (err: any) => {
      toast({ title: "Confirmation failed", description: err?.message, variant: "destructive" });
    },
  });

  const verifyLinkMutation = useMutation({
    mutationFn: async (vars: { linkId: string; status: "Verified" | "Rejected" }) => {
      const res = await apiRequest("PATCH", `${BASE}/${vars.linkId}/verify`, { status: vars.status });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to update link status");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({ title: vars.status === "Verified" ? "Link verified" : "Link rejected" });
      queryClient.invalidateQueries({ queryKey: [BASE, fetchParams] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err?.message, variant: "destructive" });
    },
  });

  const handleView = () => {
    if (!selectedUser || !startDate || !endDate) {
      toast({ title: "Please select a user and date range", variant: "destructive" });
      return;
    }
    setFetchParams({ userId: selectedUser, startDate, endDate });
  };

  const rows = reportData?.rows ?? [];
  const summary = reportData?.summary;
  const canVerify = reportData?.canVerify ?? false;
  const commissionVerified = summary?.commissionVerified ?? false;
  const isSelf = reportData?.isSelf ?? false;
  const verificationId = summary?.verificationId ?? null;
  const showConfirmPrompt = isSelf && !!summary?.commissionPending && !!verificationId;
  const popupOpen = showConfirmPrompt && popupDismissedFor !== verificationId;

  const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd-MM-yyyy") : "-");

  // Duplicate-link detection: flag any row whose link value repeats elsewhere
  // in the currently loaded report data. Pure client-side detection over the
  // existing data set — does not alter how links are stored or fetched.
  const duplicateLinkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of rows) {
      const key = (item.links || "").trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [rows]);

  const isDuplicateLink = (link: string | undefined | null) => {
    const key = (link || "").trim().toLowerCase();
    return !!key && (duplicateLinkCounts.get(key) || 0) > 1;
  };

  const duplicateCount = rows.filter((item: any) => isDuplicateLink(item.links)).length;

  const linkColumns = useMemo((): DataTableColumn<LinkRow>[] => {
    return [
      {
        id: "n",
        header: "#",
        cell: (row) => <span className="tabular-nums text-zinc-500">{rows.findIndex((r) => r.id === row.id) + 1}</span>,
        className: "w-12",
      },
      { id: "id", header: "ID", cell: (row) => row.displayId || "—" },
      { id: "company", header: "Company", cell: (row) => row.company || "—" },
      {
        id: "links",
        header: "Links",
        cell: (row) =>
          row.links ? (
            <a href={row.links} target="_blank" rel="noreferrer" className="break-all text-emerald-700 hover:underline dark:text-emerald-400">
              {row.links}
            </a>
          ) : (
            "—"
          ),
      },
      { id: "date", header: "Date", cell: (row) => fmtDate(row.date) },
      {
        id: "dup",
        header: "Duplicate",
        cell: (row) =>
          isDuplicateLink(row.links) ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Duplicate
            </Badge>
          ) : (
            <Badge variant="neutral">Unique</Badge>
          ),
      },
      {
        id: "verify",
        header: "Actions",
        headerClassName: "text-right",
        className: "text-right whitespace-nowrap",
        cell: (row) =>
          row.verifyStatus === "Verified" ? (
            <Badge variant="success">Verified</Badge>
          ) : row.verifyStatus === "Rejected" ? (
            <Badge variant="warning">Rejected</Badge>
          ) : canVerify ? (
            <div className="inline-flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={verifyLinkMutation.isPending}
                onClick={() => verifyLinkMutation.mutate({ linkId: row.id, status: "Verified" })}
              >
                Verify
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={verifyLinkMutation.isPending}
                onClick={() => verifyLinkMutation.mutate({ linkId: row.id, status: "Rejected" })}
              >
                Reject
              </Button>
            </div>
          ) : (
            <Badge variant="neutral">Pending</Badge>
          ),
      },
    ];
  }, [rows, canVerify, verifyLinkMutation.isPending, duplicateLinkCounts]);

  return (
    <PostingDataShell title="Link report" description="Review posting links and commission verification.">
    <div className="space-y-4">

      <DrmSection title="Report filters" description="Pick a user and date range, then load links.">
          <PdFormGrid cols={4}>
            <Field id="lr-user" label="User" className="md:col-span-2">
              <Select
                value={selectedUser}
                onValueChange={(v) => {
                  setSelectedUser(v);
                  setUserSearch("");
                }}
              >
                <SelectTrigger className={pdSelectTriggerClass} data-testid="select-user">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2" onKeyDown={(e) => e.stopPropagation()}>
                    <Input
                      placeholder="Search user..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="h-8"
                      data-testid="input-user-search"
                    />
                  </div>
                  {filteredUsers.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No users found</div>
                  ) : (
                    filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field id="lr-start" label="Start date">
              <div className="relative">
                <Input
                  type="date"
                  className={drmFieldClass}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>
            </Field>
            <Field id="lr-end" label="End date">
              <div className="relative">
                <Input
                  type="date"
                  className={drmFieldClass}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>
            </Field>
            <div className="flex items-end">
              <Button type="button" onClick={handleView} variant="primary" size="sm" data-testid="button-view">
                View
              </Button>
            </div>
          </PdFormGrid>
      </DrmSection>

      <DrmSection
        title="Link entries"
        description={fetchParams ? (isLoading ? "Loading…" : `${rows.length} row(s)`) : "Run a search to load links."}
        actions={
          duplicateCount > 0 ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {duplicateCount} duplicate{duplicateCount > 1 ? "s" : ""}
            </Badge>
          ) : undefined
        }
      >
          {fetchParams && !isLoading && showConfirmPrompt && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <span>
                Your commission for this period has been calculated ({summary?.actualLinks} links, reward{" "}
                {summary?.reward}). Please confirm it.
              </span>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => verificationId && confirmMutation.mutate(verificationId)}
                disabled={confirmMutation.isPending}
                data-testid="button-confirm-commission-banner"
              >
                Confirm my commission
              </Button>
            </div>
          )}
          <DataTable
            columns={linkColumns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={isLoading && !!fetchParams}
            emptyMessage={fetchParams ? "No entries found." : "Select filters and click View."}
            className="min-w-[900px]"
          />
          {fetchParams && !isLoading && (
            <div
              className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800"
              data-testid="summary-row"
            >
              <div className="flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-300">
                <span>
                  Total: <strong data-testid="summary-total">{summary?.totalLinks ?? rows.length}</strong>
                </span>
                <span>
                  Duplicates: <strong data-testid="summary-duplicates">{summary?.totalDuplicates ?? 0}</strong>
                </span>
                <span>
                  Actual: <strong data-testid="summary-actual">{summary?.actualLinks ?? rows.length}</strong>
                </span>
                <span>
                  Reward: <strong data-testid="summary-reward">{summary?.reward ?? 0}</strong>
                </span>
              </div>
              {canVerify && (
                <Button
                  type="button"
                  onClick={() => verifyMutation.mutate()}
                  disabled={commissionVerified || verifyMutation.isPending || rows.length === 0}
                  variant="primary"
                  size="sm"
                  data-testid="button-verify-commission"
                >
                  {commissionVerified ? "Commission verified" : "Verify commission"}
                </Button>
              )}
            </div>
          )}
      </DrmSection>

      <Dialog
        open={popupOpen}
        onOpenChange={(open) => {
          if (!open) setPopupDismissedFor(verificationId);
        }}
      >
        <DialogContent className={`${pdDialogShellClass} sm:max-w-md`} data-testid="dialog-confirm-commission">
          <DialogHeader>
            <DialogTitle>Confirm Your Commission</DialogTitle>
            <DialogDescription>
              Your Product Posting link commission for {fetchParams?.startDate} to {fetchParams?.endDate} has been
              calculated: {summary?.actualLinks} links, reward {summary?.reward}. Please confirm it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPopupDismissedFor(verificationId)}>
              Later
            </Button>
            <Button
              onClick={() => verificationId && confirmMutation.mutate(verificationId)}
              disabled={confirmMutation.isPending}
              variant="primary" className=" text-white"
              data-testid="button-confirm-commission-popup"
            >
              Confirm My Commission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PostingDataShell>
  );
}
