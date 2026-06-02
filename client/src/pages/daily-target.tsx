import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  "VAS Call", "Facebook Post", "E-mail", "Seminar"
];

export default function DailyTarget() {
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

  return (
    <div className="p-6">
      <div className="mb-4 font-bold text-lg uppercase text-gray-700 dark:text-zinc-400">
        DAY TARGET
      </div>

      <div className="mb-6">
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          if (!open) {
            setEditingId(null);
            setNewRole("none");
            setNewMethod("none");
            setNewTargetValue(0);
          }
          setIsModalOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-[#00a65a] hover:bg-[#008d4c]" onClick={() => {
              setEditingId(null);
              setNewRole("none");
              setNewMethod("none");
              setNewTargetValue(0);
            }}>Add Target</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-normal text-gray-700 border-b pb-4 dark:text-zinc-400">
                {editingId ? "Edit Task" : "ADD Task"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label className="block text-sm mb-2 text-gray-700 dark:text-zinc-400">Role:</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose ..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input placeholder="" className="h-8" />
                    </div>
                    <SelectItem value="none">Choose ...</SelectItem>
                    {rolesList.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm mb-2 text-gray-700 dark:text-zinc-400">Contact Method:</label>
                <Select value={newMethod} onValueChange={setNewMethod}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input placeholder="" className="h-8" />
                    </div>
                    <SelectItem value="none">Choose...</SelectItem>
                    {contactMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 mt-2">
                <label className="block text-sm mb-2 text-gray-700 dark:text-zinc-400">Target:</label>
                <div className="flex w-full">
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-r-none px-4 h-10 text-lg"
                    onClick={() => setNewTargetValue(Math.max(0, newTargetValue - 1))}
                  >
                    -
                  </Button>
                  <Input 
                    type="number"
                    value={newTargetValue} 
                    onChange={(e) => setNewTargetValue(Number(e.target.value))}
                    className="rounded-none text-center h-10 px-2 flex-1" 
                  />
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-l-none px-4 h-10 text-lg"
                    onClick={() => setNewTargetValue(newTargetValue + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Close</Button>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c]" onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border rounded-sm shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex justify-between items-end">
            <div>
              <h3 className="font-semibold text-gray-700 mb-4 dark:text-zinc-400">Target Details</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-zinc-300">
                <span>Show</span>
                <Select defaultValue="10">
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>entries</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-zinc-300">Search:</span>
              <Input className="h-8 w-48" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#dcfce7] dark:bg-zinc-900">
                <TableRow className="hover:bg-[#dcfce7] dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-black text-center w-16">#</TableHead>
                  <TableHead className="font-bold text-black text-center">Role</TableHead>
                  <TableHead className="font-bold text-black text-center">Method</TableHead>
                  <TableHead className="font-bold text-black text-center">Target</TableHead>
                  <TableHead className="font-bold text-black text-center">Create</TableHead>
                  <TableHead className="font-bold text-black text-center w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-gray-500 dark:text-zinc-400">Loading live data...</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {targets.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-center font-medium">{row.id}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600 dark:text-zinc-300">{row.role}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600 dark:text-zinc-300">{row.method}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600 dark:text-zinc-300">{row.target}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600 dark:text-zinc-300">{new Date(row.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '')}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center space-x-3">
                            <Edit 
                              className="w-4 h-4 text-blue-500 cursor-pointer hover:text-blue-700" 
                              onClick={() => handleEdit(row)}
                            />
                            <Trash2 
                              className={`w-4 h-4 text-red-500 cursor-pointer hover:text-red-700 ${deleteMutation.isPending ? 'opacity-50' : ''}`} 
                              onClick={() => !deleteMutation.isPending && handleDelete(row.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {targets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-gray-500 dark:text-zinc-400">No daily targets found.</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 dark:text-zinc-300">
            <div>Showing 1 to {targets.length} of {targets.length} entries</div>
            <div className="flex space-x-1">
              <Button variant="outline" className="h-8 px-3 text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400">Previous</Button>
              <Button variant="default" className="h-8 w-8 p-0 bg-[#00a65a] hover:bg-[#008d4c]">1</Button>
              <Button variant="outline" className="h-8 px-3">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
