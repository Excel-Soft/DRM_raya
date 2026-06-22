import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AllowedIp = {
  id: string;
  ip_cidr: string;
  description: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  ip_cidr: string;
  description: string;
  is_active: boolean;
};

const emptyForm: FormState = { ip_cidr: "", description: "", is_active: true };

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

export default function AllowedIpList() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AllowedIp | null>(null);

  const listQuery = useQuery<AllowedIp[]>({
    queryKey: ["/api/settings/allowed-ips"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/allowed-ips");
      return res.json();
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/settings/allowed-ips"] });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string | null; data: FormState }) => {
      const { id, data } = payload;
      const res = id
        ? await apiRequest("PATCH", `/api/settings/allowed-ips/${id}`, data)
        : await apiRequest("POST", "/api/settings/allowed-ips", data);
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to save allowed IP."));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setIsDialogOpen(false);
      toast({ title: "Saved", description: "Allowed IP saved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: AllowedIp) => {
      const res = await apiRequest("PATCH", `/api/settings/allowed-ips/${item.id}`, {
        is_active: !item.is_active,
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to update status."));
      }
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/settings/allowed-ips/${id}`);
      if (!res.ok && res.status !== 204) {
        throw new Error(await readError(res, "Failed to delete allowed IP."));
      }
      return true;
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Deleted", description: "Allowed IP removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: AllowedIp) => {
    setEditingId(item.id);
    setFormData({
      ip_cidr: item.ip_cidr,
      description: item.description ?? "",
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.ip_cidr.trim()) {
      toast({ title: "Validation Error", description: "Allowed IP is required.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      id: editingId,
      data: {
        ip_cidr: formData.ip_cidr.trim(),
        description: formData.description.trim(),
        is_active: formData.is_active,
      },
    });
  };

  const items = listQuery.data ?? [];

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen p-6">
      <div className="max-w-[1600px] mx-auto bg-white rounded-md shadow-sm border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h1 className="text-lg font-normal text-[#333]">DRM Allowed IPs</h1>
          <Button
            onClick={handleOpenAdd}
            className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-4 rounded-[4px] font-medium"
            data-testid="button-add-allowed-ip"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table className="w-full text-[13px] whitespace-nowrap">
            <TableHeader>
              <TableRow className="border-b-0 bg-[#f8f9fa] hover:bg-[#f8f9fa]">
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Allowed IP / CIDR</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Description</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Active</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Created At</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-500">Loading...</TableCell>
                </TableRow>
              ) : listQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-[#d9534f]">
                    Could not load allowed IPs. Please try again.
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                    No allowed IPs configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors" data-testid={`row-allowed-ip-${item.id}`}>
                    <TableCell className="py-3 px-4">
                      <span className="bg-[#00a65a] text-white px-2 py-0.5 rounded-[4px] text-xs font-medium">
                        {item.ip_cidr}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-[#555] max-w-[400px] truncate" title={item.description ?? ""}>
                      {item.description || "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={() => toggleMutation.mutate(item)}
                          disabled={toggleMutation.isPending}
                          data-testid={`switch-active-${item.id}`}
                        />
                        <span className={item.is_active ? "text-[#00a65a]" : "text-slate-400"}>
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-[#555]">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(item)}
                          className="h-7 w-7 bg-[#3c8dbc] hover:bg-[#367fa9] text-white rounded-[4px]"
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(item)}
                          className="h-7 w-7 bg-[#f56954] hover:bg-[#d73925] text-white rounded-[4px]"
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-md border-0">
          <DialogHeader className="p-4 border-b border-slate-100 bg-[#f8f9fa]">
            <DialogTitle className="text-lg font-medium text-[#333] flex justify-between items-center">
              {editingId ? "Edit DRM IP" : "Add DRM IP"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-1">
              <Label className="text-[13px] font-bold text-[#555]">
                Allowed IP / CIDR <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g., 203.0.113.5 or 192.168.1.0/24"
                value={formData.ip_cidr}
                onChange={(e) => setFormData({ ...formData, ip_cidr: e.target.value })}
                className="h-10 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
                data-testid="input-ip-cidr"
              />
              <p className="text-[11px] text-slate-400 pt-1">
                Enter an IP address or CIDR block allowed for DRM access
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-[13px] font-bold text-[#555]">Description</Label>
              <Input
                placeholder="e.g., Gulberg Office, Habib home"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-10 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
                data-testid="input-description"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                data-testid="switch-form-active"
              />
              <Label className="text-[13px] font-bold text-[#555]">
                {formData.is_active ? "Active" : "Inactive"}
              </Label>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-slate-100 bg-[#f8f9fa] flex gap-2 justify-end sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="bg-[#777] hover:bg-[#666] text-white border-0 h-9 px-6 rounded-[4px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6 rounded-[4px] flex items-center gap-2"
              data-testid="button-save-ip"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Saving..." : "Save IP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete allowed IP?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-semibold">{deleteTarget?.ip_cidr}</span>
              {deleteTarget?.description ? ` (${deleteTarget.description})` : ""} from the DRM
              allow-list. Access from this IP/CIDR will no longer be permitted. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-[#d9534f] hover:bg-[#c9302c] text-white"
              data-testid="button-confirm-delete-ip"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
