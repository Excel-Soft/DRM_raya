"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import {
  DrmSection,
  TargetQuarterToggle,
  TargetSystemShell,
  tsSelectTriggerClass,
} from "@/modules/target-system/target-system-ui";

type UserTargetRow = {
  id: number;
  userId: string;
  targetName: string;
  category: string;
  target: number;
  price: number;
  conversion: number;
  vas: number;
  kwa: number;
  reward: number;
  total: number;
  startDate: string | null;
  endDate: string | null;
  signDate: string | null;
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

function fmtDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
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

export function ViewTargetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [showAllQuarters, setShowAllQuarters] = useState(false);

  const { data: allTargets = [], isLoading } = useQuery<UserTargetRow[]>({
    queryKey: ["/api/target-system/user-targets", { current: !showAllQuarters }],
    queryFn: async () => {
      const qs = showAllQuarters ? "" : "?current=true";
      const res = await apiRequest("GET", `/api/target-system/user-targets${qs}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: usersRes } = useQuery<any>({
    queryKey: ["/api/users"],
  });

  const usersList = usersRes?.data || usersRes?.users || usersRes || [];

  const groupedUsers = useMemo(() => {
    return usersList.reduce((acc: Record<string, any[]>, user: any) => {
      const role = user.role || "Unassigned";
      if (!acc[role]) acc[role] = [];
      acc[role].push(user);
      return acc;
    }, {});
  }, [usersList]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/target-system/user-targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: "Target removed successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete target.", variant: "destructive" });
    },
  });

  const displayedTargets = allTargets.filter((t) => t.userId === selectedUser);
  const selectedUserLabel =
    usersList.find((u: any) => u.id === selectedUser)?.fullName ||
    usersList.find((u: any) => u.id === selectedUser)?.username ||
    selectedUser;

  const columns = useMemo((): DataTableColumn<UserTargetRow>[] => {
    return [
      { id: "name", header: "Target name", cell: (row) => <span className="font-medium">{row.targetName}</span> },
      { id: "cat", header: "Category", cell: (row) => row.category, className: "text-center" },
      { id: "target", header: "Target", cell: (row) => row.target, className: "text-center tabular-nums" },
      { id: "price", header: "Price", cell: (row) => row.price, className: "text-center tabular-nums" },
      { id: "bonus", header: "Bonus", cell: (row) => row.conversion, className: "text-center tabular-nums" },
      { id: "vas", header: "VAS", cell: (row) => row.vas, className: "text-center tabular-nums" },
      { id: "kwa", header: "KWA", cell: (row) => row.kwa, className: "text-center tabular-nums" },
      { id: "reward", header: "Reward", cell: (row) => row.reward, className: "text-center tabular-nums" },
      { id: "total", header: "Total", cell: (row) => row.total, className: "text-center tabular-nums" },
      {
        id: "start",
        header: "Start",
        cell: (row) => <span className="whitespace-nowrap text-sm">{fmtDate(row.startDate)}</span>,
      },
      {
        id: "end",
        header: "End",
        cell: (row) => <span className="whitespace-nowrap text-sm">{fmtDate(row.endDate)}</span>,
      },
      {
        id: "sign",
        header: "Signed",
        cell: (row) => <span className="whitespace-nowrap text-xs text-zinc-500">{fmtDateTime(row.signDate)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        headerClassName: "text-right",
        className: "text-right",
        cell: (row) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Remove target"
            aria-label="Remove target"
            className="text-red-600 hover:text-red-700 dark:text-red-400"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ];
  }, [deleteMutation]);

  const userField = (
    <Field id="view-target-user" label="User" className="w-full sm:max-w-md">
      <Select value={selectedUser} onValueChange={setSelectedUser}>
        <SelectTrigger id="view-target-user" className={tsSelectTriggerClass}>
          <SelectValue placeholder="Choose user…" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedUsers).map(([role, usersInRole]) => (
            <SelectGroup key={role}>
              <SelectLabel className="capitalize text-emerald-700 dark:text-emerald-400">
                {role.replace(/_/g, " ")}
              </SelectLabel>
              {(usersInRole as any[]).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName || user.username}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <TargetSystemShell title="View targets" description="Assigned user targets by quarter.">
      <DrmSection title="Filters" actions={<TargetQuarterToggle showAll={showAllQuarters} onChange={setShowAllQuarters} />}>
        {userField}
      </DrmSection>

      {selectedUser ? (
        <DrmSection
          title="Target details"
          description={
            isLoading
              ? "Loading…"
              : `${displayedTargets.length} assignment${displayedTargets.length === 1 ? "" : "s"} for ${selectedUserLabel}`
          }
        >
          <DataTable
            columns={columns}
            rows={displayedTargets}
            rowKey={(row) => String(row.id)}
            loading={isLoading}
            emptyMessage={`No targets assigned to ${selectedUserLabel}.`}
            className="min-w-[960px]"
          />
        </DrmSection>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Select a user to view their targets.</p>
      )}
    </TargetSystemShell>
  );
}
