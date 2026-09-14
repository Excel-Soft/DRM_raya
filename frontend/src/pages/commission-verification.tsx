import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PlusCircle } from "lucide-react";

export default function CommissionVerification() {
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("approved");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const roleId = user?.activeRoleId || user?.roleId || "";

  // Depending on the user role, some tabs or actions might be limited
  const isAccountManager = roleId === "account_manager" || roleId === 32;
  const isHod = roleId === "hod" || roleId === "super_hod" || roleId === 48;
  const isAdmin = roleId === "admin" || roleId === 14;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["/api/drm/vas-comm-final", activeTab],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/drm/vas-comm-final?tab=${activeTab}`);
      const json = await res.json();
      return json.data || [];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; userId: number; comStatus: string }) => {
      const res = await apiRequest("POST", "/api/drm/vas-comm-final/update", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Commission status updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/drm/vas-comm-final"] });
      setIsModalOpen(false);
      setSelectedRecord(null);
      setActionStatus("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    }
  });

  const openModal = (record: any) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleUpdate = () => {
    if (!actionStatus) {
      toast({ title: "Error", description: "Please select a status", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: selectedRecord.id,
      userId: selectedRecord.userId,
      comStatus: actionStatus
    });
  };

  const renderTable = (data: any[], tab: string) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border rounded-md">
          <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
            <tr>
              <th className="p-2 border-r">No#</th>
              <th className="p-2 border-r">Date</th>
              <th className="p-2 border-r">Person</th>
              <th className="p-2 border-r">Status</th>
              <th className="p-2 border-r">Commission Type</th>
              <th className="p-2 border-r">Amount</th>
              {tab === "not_approved" && (
                <>
                  <th className="p-2 border-r">HOD</th>
                  <th className="p-2 border-r">Manager</th>
                  <th className="p-2 border-r">User Status</th>
                </>
              )}
              <th className="p-2 border-r">%</th>
              <th className="p-2 border-r">Commission</th>
              <th className="p-2 border-r">Reward</th>
              <th className="p-2 border-r">Team Reward</th>
              <th className="p-2 border-r">Pay</th>
              <th className="p-2 border-r">Total</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={15} className="p-4 text-center text-muted-foreground">No records found.</td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={row.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-2 border-r">{idx + 1}</td>
                  <td className="p-2 border-r">{row.commMonth}-{row.commYear}</td>
                  <td className="p-2 border-r font-medium">{row.personName}</td>
                  <td className="p-2 border-r">
                    <Badge variant="outline">{row.userStatus || "Pending"}</Badge>
                  </td>
                  <td className="p-2 border-r">{row.commType}</td>
                  <td className="p-2 border-r">{Number(row.comm || 0) + Number(row.reward || 0) + Number(row.teamReward || 0)}</td>
                  
                  {tab === "not_approved" && (
                    <>
                      <td className="p-2 border-r">{row.hodStatus}</td>
                      <td className="p-2 border-r">{row.managerApprove}</td>
                      <td className="p-2 border-r">{row.userStatus}</td>
                    </>
                  )}

                  <td className="p-2 border-r">{row.per}%</td>
                  <td className="p-2 border-r">{row.comm}</td>
                  <td className="p-2 border-r">{row.reward}</td>
                  <td className="p-2 border-r">{row.teamReward}</td>
                  <td className="p-2 border-r font-semibold text-green-700">{row.finalPayAmount}</td>
                  <td className="p-2 border-r font-bold">{row.totalAmount}</td>
                  <td className="p-2 text-center">
                    {row.accountPayStatus === "Pending" || tab === "not_approved" ? (
                      <button 
                        onClick={() => openModal(row)}
                        title="Update Status"
                        className="text-green-600 hover:text-green-800 transition-colors p-1"
                      >
                        <PlusCircle size={20} />
                      </button>
                    ) : (
                      <Badge variant="secondary">Paid</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t">
            <tr>
              <th colSpan={tab === "not_approved" ? 13 : 10} className="p-2 text-right font-bold">Total</th>
              <th colSpan={2} className="p-2 font-bold text-lg text-green-700">
                {data.reduce((sum, r) => sum + Number(r.finalPayAmount || 0), 0).toFixed(2)}
              </th>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Commission Verification</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4 max-w-md">
              <TabsTrigger value="approved">Commission Approved</TabsTrigger>
              <TabsTrigger value="not_approved">Commission Not Approved</TabsTrigger>
            </TabsList>
            
            <TabsContent value="approved">
              {isLoading ? (
                <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
              ) : (
                renderTable(records, "approved")
              )}
            </TabsContent>
            
            <TabsContent value="not_approved">
              {isLoading ? (
                <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
              ) : (
                renderTable(records, "not_approved")
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Commission Status</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <span className="font-semibold text-right">Person:</span>
              <span className="col-span-3 text-slate-700">{selectedRecord?.personName}</span>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <span className="font-semibold text-right">Status:</span>
              <div className="col-span-3">
                <Select value={actionStatus} onValueChange={setActionStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose Status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(isAccountManager || isAdmin) ? (
                      <>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Delete">Delete</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Delete">Delete</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
            <Button onClick={handleUpdate} disabled={!actionStatus || updateMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
