"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import { Trash2, Pencil, Plus } from "lucide-react";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

const rolesList = [
  "Sales Manager", "admin", "Sales Executive", "Sales Assistant Manager", 
  "Service Manager", "Service Assistant Manager", "Service Executive", 
  "Reception", "Project manager", "Account Manager", "SEO/SMM Manager", 
  "Product Posting Manager", "Posting Assistant Manager", "Posting Executive", 
  "SEO/SMM Executive", "D&D Manager", "D&D Assistant Manager", "D&D Executive", 
  "Internship Executive"
];

const contactMethods = [
  "Mobile", "OnSite Visit", "Whatsapp", "Group Whatsapp (Broadcast)",
  "VAS Call", "Facebook Post", "E-mail", "Seminar", "Copy Product", "New Product"
];

export function DailyTargetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: targets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/daily-targets"],
  });
  
  // Modal State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newRole, setNewRole] = useState("none");
  const [newMethod, setNewMethod] = useState("none");
  const [newTargetValue, setNewTargetValue] = useState(0);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/target-system/daily-targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/daily-targets"] });
      toast({ title: "Target removed!" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete target.", variant: "destructive" });
    }
  });

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const saveMutation = useMutation({
    mutationFn: async (newTask: any) => {
      const res = await apiRequest("POST", "/api/target-system/daily-targets", newTask);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/daily-targets"] });
      setIsModalOpen(false);
      toast({ title: "New target added successfully!" });
      
      // Reset state
      setNewRole("none");
      setNewMethod("none");
      setNewTargetValue(0);
    },
    onError: (error) => {
      toast({ title: "Failed to create target.", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedTask: any) => {
      const res = await apiRequest("PUT", `/api/target-system/daily-targets/${editingId}`, updatedTask);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/daily-targets"] });
      setIsModalOpen(false);
      toast({ title: "Target updated successfully!" });
      setEditingId(null);
      setNewRole("none");
      setNewMethod("none");
      setNewTargetValue(0);
    },
    onError: (error) => {
      toast({ title: "Failed to update target.", variant: "destructive" });
    }
  });

  const handleEdit = (row: any) => {
    setEditingId(row.id);
    setNewRole(row.role);
    setNewMethod(row.method);
    setNewTargetValue(row.target);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (newRole === "none") {
      toast({ title: "Please select a role.", variant: "destructive" });
      return;
    }
    if (newMethod === "none") {
      toast({ title: "Please select a contact method.", variant: "destructive" });
      return;
    }

    const isDuplicate = targets.some((t: any) => t.role === newRole && t.method === newMethod && t.id !== editingId);
    if (isDuplicate) {
      toast({ title: "A target already exists for this Role and Contact Method.", variant: "destructive" });
      return;
    }
    
    if (editingId) {
      updateMutation.mutate({
        role: newRole,
        method: newMethod,
        target: newTargetValue,
      });
    } else {
      saveMutation.mutate({
        role: newRole,
        method: newMethod,
        target: newTargetValue,
      });
    }
  };

  const columns = useMemo((): DataTableColumn<any>[] => {
    return [
      { id: "id", header: "#", cell: (row) => row.id, className: "tabular-nums text-zinc-500 w-12" },
      { id: "role", header: "Role", cell: (row) => <span className="font-medium">{row.role}</span> },
      { id: "method", header: "Method", cell: (row) => row.method },
      { id: "target", header: "Target", cell: (row) => <span className="tabular-nums">{row.target}</span> },
      {
        id: "created",
        header: "Created",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500">
            {new Date(row.createdAt)
              .toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
              .replace(/,/g, "")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        headerClassName: "text-right",
        className: "text-right whitespace-nowrap",
        cell: (row) => (
          <div className="inline-flex gap-1">
            <Button type="button" variant="ghost" size="sm" title="Edit" onClick={() => handleEdit(row)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Delete"
              className="text-red-600 dark:text-red-400"
              disabled={deleteMutation.isPending}
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];
  }, [deleteMutation.isPending]);

  const openAdd = () => {
    setEditingId(null);
    setNewRole("none");
    setNewMethod("none");
    setNewTargetValue(0);
    setIsModalOpen(true);
  };

  return (
    <TargetSystemShell title="Daily target" description="Role and contact-method daily targets.">
      <DrmSection
        title="Daily targets"
        description={isLoading ? "Loading…" : `${targets.length} rule${targets.length === 1 ? "" : "s"}`}
        actions={
          <Button type="button" variant="primary" size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add target
          </Button>
        }
      >
        <DataTable
          columns={columns}
          rows={targets}
          rowKey={(row) => String(row.id)}
          loading={isLoading}
          emptyMessage="No daily targets found."
          className="min-w-[640px]"
        />
      </DrmSection>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null);
            setNewRole("none");
            setNewMethod("none");
            setNewTargetValue(0);
          }
          setIsModalOpen(open);
        }}
      >
        <DialogContent className={`${tsDialogShellClass} sm:max-w-md`}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle>{editingId ? "Edit daily target" : "Add daily target"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <TsFormGrid cols={3}>
              <Field id="daily-role" label="Role">
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose…</SelectItem>
                    {rolesList.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="daily-method" label="Contact method">
                <Select value={newMethod} onValueChange={setNewMethod}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose…</SelectItem>
                    {contactMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="daily-target-val" label="Target count">
                <div className="flex w-full">
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-r-none px-3"
                    onClick={() => setNewTargetValue(Math.max(0, newTargetValue - 1))}
                  >
                    −
                  </Button>
                  <Input
                    type="number"
                    value={newTargetValue}
                    onChange={(e) => setNewTargetValue(Number(e.target.value))}
                    className={`${drmFieldClass} rounded-none text-center`}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-l-none px-3"
                    onClick={() => setNewTargetValue(newTargetValue + 1)}
                  >
                    +
                  </Button>
                </div>
              </Field>
            </TsFormGrid>
          </div>
          <DialogFooter className="gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TargetSystemShell>
  );
}
