import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronDown, X } from "lucide-react";

type PmsDept = {
  id: string;
  name: string;
  ratio: string;
  managerIds: string[];
  managers: { id: string; name: string }[];
};

type UserOption = { id: string; name: string };

type AssignmentsPayload = {
  departments: PmsDept[];
  users: UserOption[];
};

function UserMultiSelect({
  users,
  selectedIds,
  onChange,
}: {
  users: UserOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal h-10"
          >
            <span className="truncate text-left">
              {selectedIds.length ? `${selectedIds.length} selected` : "Choose users..."}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto">
          {users.map((user) => (
            <DropdownMenuCheckboxItem
              key={user.id}
              checked={selectedIds.includes(user.id)}
              onCheckedChange={(checked) => {
                if (checked) onChange([...new Set([...selectedIds, user.id])]);
                else onChange(selectedIds.filter((x) => x !== user.id));
              }}
              onSelect={(e) => e.preventDefault()}
            >
              {user.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const name = users.find((u) => u.id === id)?.name ?? id;
            return (
              <Badge
                key={id}
                className="bg-[#0f8c5b] hover:bg-[#0c7349] text-white gap-1 pr-1"
              >
                {name}
                <button
                  type="button"
                  className="rounded-full hover:bg-black/10 p-0.5"
                  onClick={() => onChange(selectedIds.filter((x) => x !== id))}
                  aria-label={`Remove ${name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Legacy pms-project-assign grid + Distributed Project modal (embedded in PMS Project Setting). */
export function PmsProjectAssignSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<PmsDept | null>(null);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [ratio, setRatio] = useState("0:0");

  const { data, isLoading } = useQuery<AssignmentsPayload>({
    queryKey: ["/api/pms/department-assignments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/department-assignments");
      if (!res.ok) throw new Error("Failed to load departments");
      return res.json();
    },
  });

  const departments = data?.departments ?? [];
  const users = data?.users ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: { departmentId: string; userIds: string[]; ratio: string }) => {
      const res = await apiRequest("POST", "/api/pms/department-assignment", payload);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pms/department-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pms/department-stats"] });
      toast({ title: "Assignment saved successfully" });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openDept = (dept: PmsDept) => {
    setSelectedDept(dept);
    setUserIds([...dept.managerIds]);
    setRatio(dept.ratio?.trim() || "0:0");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedDept) return;
    saveMutation.mutate({
      departmentId: selectedDept.id,
      userIds,
      ratio: ratio.trim() || "0:0",
    });
  };

  const displayRatio = (dept: PmsDept) => {
    const r = (dept.ratio || "").trim();
    if (r) return r;
    return dept.managerIds.length ? "0:0" : "";
  };

  return (
    <section className="mb-8">
      <h2 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">
        Assign PMS Project
      </h2>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading departments...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {departments.map((dept) => (
            <Card
              key={dept.id}
              className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
              onClick={() => openDept(dept)}
            >
              <CardContent className="p-8 flex flex-col items-center text-center space-y-3 min-h-[160px]">
                <div className="w-14 h-14 rounded-full bg-[#0f8c5b] flex items-center justify-center shadow-sm">
                  <Plus className="w-7 h-7 text-white stroke-[2.5]" />
                </div>
                <h3 className="font-medium text-gray-800 text-sm dark:text-zinc-100 leading-snug">
                  {dept.name}
                </h3>
                {displayRatio(dept) ? (
                  <p className="text-sm text-gray-600 dark:text-zinc-400">{displayRatio(dept)}</p>
                ) : null}
                {dept.managers.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center">
                    {dept.managers.map((m) => (
                      <Badge
                        key={m.id}
                        className="text-xs bg-[#0f8c5b] text-white hover:bg-[#0c7349] font-normal"
                      >
                        {m.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-normal text-center w-full">
              Distributed Project
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={selectedDept?.name ?? ""} disabled className="bg-muted/60" />
            </div>
            <div className="space-y-2">
              <Label>Assign</Label>
              <UserMultiSelect users={users} selectedIds={userIds} onChange={setUserIds} />
            </div>
            <div className="space-y-2">
              <Label>Ratio</Label>
              <Input value={ratio} onChange={(e) => setRatio(e.target.value)} placeholder="0:0" />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-[#0f8c5b] hover:bg-[#0c7349]"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
