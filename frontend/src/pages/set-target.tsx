import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

import { useEffect } from "react";

export default function SetTarget() {
  const [activeTab, setActiveTab] = useState<"user" | "role" | "same">("user");
  const [showUserForm, setShowUserForm] = useState(true);
  const [showRoleForm, setShowRoleForm] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: userTargets = [], isLoading: isLoadingUserTargets } = useQuery<any[]>({
    queryKey: ["/api/target-system/user-targets"],
  });

  const { data: targetsData = [] } = useQuery<any[]>({
    queryKey: ["/api/target-system/targets"],
  });

  const { data: usersResp } = useQuery<any>({
    queryKey: ["/api/users"],
  });
  const usersData = usersResp?.users || [];

  const [roleType, setRoleType] = useState("none");
  const [roleTargets, setRoleTargets] = useState<any[]>([]);
  
  const [selectedUser, setSelectedUser] = useState("none");
  const [userFormTargets, setUserFormTargets] = useState<any[]>([]);

  useEffect(() => {
    if (targetsData.length > 0) {
      const initTargets = targetsData.map(d => ({
        ...d,
        name: d.targetName,
        number: 0,
        category: "none",
        startDate: "",
        endDate: "",
        selected: false
      }));
      setRoleTargets(initTargets);
      setUserFormTargets(initTargets);
    }
  }, [targetsData]);

  const handleUserFormTargetChange = (index: number, field: string, value: any) => {
    const newTargets = [...userFormTargets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setUserFormTargets(newTargets);
  };

  const handleRoleTargetChange = (index: number, field: string, value: any) => {
    const newTargets = [...roleTargets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setRoleTargets(newTargets);
  };

  const assignRoleMutation = useMutation({
    mutationFn: async (data: { role: string, targets: any[] }) => {
      const res = await apiRequest("POST", "/api/target-system/assign-role", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: data.message || "Targets successfully assigned to role!" });
      setActiveTab("user");
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to assign targets.", variant: "destructive" });
    }
  });

  const assignUserMutation = useMutation({
    mutationFn: async (data: { targets: any[] }) => {
      const res = await apiRequest("POST", "/api/target-system/user-targets/bulk", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: data.message || "Targets successfully assigned to user!" });
      // Keep them on 'user' tab, maybe reset selected
      setSelectedUser("none");
      setUserFormTargets(targetsData.map(d => ({
        ...d,
        name: d.targetName,
        number: 0,
        category: "none",
        startDate: "",
        endDate: "",
        selected: false
      })));
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to assign targets.", variant: "destructive" });
    }
  });

  const handleSetUserTarget = () => {
    const selectedTargets = userFormTargets.filter(t => t.selected);
    if (selectedUser === "none") {
      toast({ title: "Please select a User", variant: "destructive" });
      return;
    }
    if (selectedTargets.length === 0) {
      toast({ title: "Please select at least one target", variant: "destructive" });
      return;
    }
    
    const missingDates = selectedTargets.some(t => !t.startDate || !t.endDate);
    if (missingDates) {
      toast({ title: "Please provide Start and End Dates for all selected targets.", variant: "destructive" });
      return;
    }

    const payloadTargets = selectedTargets.map(t => ({
      ...t,
      userId: selectedUser,
      target: t.number,
      targetName: t.name
    }));

    assignUserMutation.mutate({ targets: payloadTargets });
  };

  const handleSetRoleTarget = () => {
    const selectedTargets = roleTargets.filter(t => t.selected);
    if (roleType === "none") {
      toast({ title: "Please select a Role Type", variant: "destructive" });
      return;
    }
    if (selectedTargets.length === 0) {
      toast({ title: "Please select at least one target", variant: "destructive" });
      return;
    }
    
    // Check if dates are selected for all selected targets
    const missingDates = selectedTargets.some(t => !t.startDate || !t.endDate);
    if (missingDates) {
      toast({ title: "Please provide Start and End Dates for all selected targets.", variant: "destructive" });
      return;
    }

    assignRoleMutation.mutate({ role: roleType, targets: selectedTargets });
  };


  const deleteUserTargetMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/target-system/user-targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: "Target deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete target.", variant: "destructive" });
    }
  });

  const handleDeleteUserTarget = (id: number) => {
    deleteUserTargetMutation.mutate(id);
  };

  const handleEditUserTarget = (id: number) => {
    toast({ title: "Edit mode triggered for target #" + id });
  };

  // Assign Same Target logic
  const [sameTargetStartDate, setSameTargetStartDate] = useState("2026-04-01");
  const [sameTargetEndDate, setSameTargetEndDate] = useState("2026-06-30");

  const assignSameTargetMutation = useMutation({
    mutationFn: async (data: { targetIds: number[], startDate: string, endDate: string }) => {
      const res = await apiRequest("PUT", "/api/target-system/user-targets/bulk-dates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: "Targets successfully updated with the new timeframe!" });
    },
    onError: () => {
      toast({ title: "Failed to update targets.", variant: "destructive" });
    }
  });

  const handleAssignSameTarget = () => {
    if (!sameTargetStartDate || !sameTargetEndDate) {
      toast({ title: "Please select both Start Date and End Date.", variant: "destructive" });
      return;
    }

    if (userTargets.length === 0) {
      toast({ title: "No targets to update.", variant: "destructive" });
      return;
    }

    const targetIds = userTargets.map(t => t.id);
    assignSameTargetMutation.mutate({ targetIds, startDate: sameTargetStartDate, endDate: sameTargetEndDate });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center font-bold text-lg uppercase flex-wrap">
        <span className="text-gray-700 mr-2 dark:text-zinc-400">TARGET SYSTEM /</span>
        <span 
          className={`cursor-pointer hover:underline mr-2 ${activeTab === 'user' ? 'text-gray-700' : 'text-[#00a65a]'}`}
          onClick={() => {
            if (activeTab === 'user') setShowUserForm(!showUserForm);
            else { setActiveTab('user'); setShowUserForm(true); }
          }}
        >
          TARGET FOR USER
        </span>
        <span className="text-gray-700 mr-2 dark:text-zinc-400">/</span>
        <span 
          className={`cursor-pointer hover:underline mr-2 ${activeTab === 'role' ? 'text-gray-700' : 'text-[#00a65a]'}`}
          onClick={() => {
            if (activeTab === 'role') setShowRoleForm(!showRoleForm);
            else { setActiveTab('role'); setShowRoleForm(true); }
          }}
        >
          TARGET FOR ROLE
        </span>
        <span className="text-gray-700 mr-2 dark:text-zinc-400">/</span>
        <span 
          className={`cursor-pointer hover:underline ${activeTab === 'same' ? 'text-gray-700' : 'text-[#00a65a]'}`}
          onClick={() => setActiveTab('same')}
        >
          ASSIGN SAME TARGET
        </span>
      </div>

      {(activeTab === "user" || activeTab === "same") && (
        <>
          {activeTab === "same" && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Start Date</label>
                  <Input type="date" value={sameTargetStartDate} onChange={e => setSameTargetStartDate(e.target.value)} className="h-9" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">End Date</label>
                  <Input type="date" value={sameTargetEndDate} onChange={e => setSameTargetEndDate(e.target.value)} className="h-9" />
                </div>
              </div>
              <Button 
                className="bg-[#00a65a] hover:bg-[#008d4c] px-8" 
                onClick={handleAssignSameTarget}
                disabled={assignSameTargetMutation.isPending || isLoadingUserTargets}
              >
                {assignSameTargetMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Set
              </Button>
            </div>
          )}

          {activeTab === "user" && showUserForm && (
            <div className="mb-6">
              <div className="mb-4 max-w-md">
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">User</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose .." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose ..</SelectItem>
                    {usersData.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.username} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="bg-[#00a65a] hover:bg-[#008d4c] px-8 mb-6" 
                onClick={handleSetUserTarget}
                disabled={assignUserMutation.isPending}
              >
                {assignUserMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Set
              </Button>
              
              <Card className="border rounded-sm shadow-sm mb-6">
                <CardContent className="p-0">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-700 dark:text-zinc-400">Assign Target Details</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-[#dcfce7] dark:bg-zinc-900">
                        <TableRow className="hover:bg-[#dcfce7] dark:hover:bg-zinc-800">
                          <TableHead className="font-bold text-black">Target Name</TableHead>
                          <TableHead className="font-bold text-black text-center">Category</TableHead>
                          <TableHead className="font-bold text-black text-center w-32">Number</TableHead>
                          <TableHead className="font-bold text-black text-center">Price</TableHead>
                          <TableHead className="font-bold text-black text-center">Bonus</TableHead>
                          <TableHead className="font-bold text-black text-center w-40">Start Date</TableHead>
                          <TableHead className="font-bold text-black text-center w-40">End Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userFormTargets.map((row, index) => (
                          <TableRow key={`uform-${row.id}`}>
                            <TableCell className="font-medium flex items-center space-x-2">
                              <Checkbox 
                                id={`ucheck-${row.id}`} 
                                checked={row.selected}
                                onCheckedChange={(checked) => handleUserFormTargetChange(index, "selected", checked === true)}
                              />
                              <label htmlFor={`ucheck-${row.id}`} className="text-sm font-normal cursor-pointer text-gray-600 dark:text-zinc-300">{row.name}</label>
                            </TableCell>
                            <TableCell className="text-center">
                              <Select value={row.category} onValueChange={(val) => handleUserFormTargetChange(index, "category", val)}>
                                <SelectTrigger className="h-8 w-28 mx-auto text-xs">
                                  <SelectValue placeholder="choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">choose...</SelectItem>
                                  <SelectItem value="AB New Terget">AB New Terget</SelectItem>
                                  <SelectItem value="Renewal Terget">Renewal Terget</SelectItem>
                                  <SelectItem value="VAS">VAS</SelectItem>
                                  <SelectItem value="Team">Team</SelectItem>
                                  <SelectItem value="Dep DD">Dep DD</SelectItem>
                                  <SelectItem value="Dep PP">Dep PP</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex mx-auto w-24">
                                <Button 
                                  variant="default" 
                                  className="bg-[#00a65a] hover:bg-[#008d4c] rounded-r-none px-2 h-8 text-xs"
                                  onClick={() => handleUserFormTargetChange(index, "number", Math.max(0, row.number - 1))}
                                >
                                  -
                                </Button>
                                <Input 
                                  type="number"
                                  value={row.number} 
                                  onChange={(e) => handleUserFormTargetChange(index, "number", Number(e.target.value))}
                                  className="rounded-none text-center h-8 text-xs px-1" 
                                />
                                <Button 
                                  variant="default" 
                                  className="bg-[#00a65a] hover:bg-[#008d4c] rounded-l-none px-2 h-8 text-xs"
                                  onClick={() => handleUserFormTargetChange(index, "number", row.number + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{row.price}</TableCell>
                            <TableCell className="text-center text-sm">{row.bonus}</TableCell>
                            <TableCell className="text-center">
                              <Input type="date" value={row.startDate} onChange={(e) => handleUserFormTargetChange(index, "startDate", e.target.value)} className="h-8 text-xs w-full" />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input type="date" value={row.endDate} onChange={(e) => handleUserFormTargetChange(index, "endDate", e.target.value)} className="h-8 text-xs w-full" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border rounded-sm shadow-sm">
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-700 mb-4 dark:text-zinc-400">Target Details</h3>
                <div className="flex justify-between items-center">
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
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-zinc-300">Search:</span>
                    <Input className="h-8 w-48" />
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#dcfce7] dark:bg-zinc-900">
                    <TableRow className="hover:bg-[#dcfce7] dark:hover:bg-zinc-800">
                      <TableHead className="font-bold text-black w-12 text-center">#</TableHead>
                      <TableHead className="font-bold text-black">Target Name</TableHead>
                      <TableHead className="font-bold text-black text-center">Category</TableHead>
                      <TableHead className="font-bold text-black text-center">Target</TableHead>
                      <TableHead className="font-bold text-black text-center">Price</TableHead>
                      <TableHead className="font-bold text-black text-center">Bonus</TableHead>
                      <TableHead className="font-bold text-black text-center">Vas</TableHead>
                      <TableHead className="font-bold text-black text-center">Kwa</TableHead>
                      <TableHead className="font-bold text-black text-center">Reward</TableHead>
                      <TableHead className="font-bold text-black text-center">Total</TableHead>
                      <TableHead className="font-bold text-black text-center">Start Date</TableHead>
                      <TableHead className="font-bold text-black text-center">End Date</TableHead>
                      <TableHead className="font-bold text-black text-center">Sign Date</TableHead>
                      <TableHead className="font-bold text-black text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingUserTargets ? (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                          Loading live data...
                        </TableCell>
                      </TableRow>
                    ) : userTargets.length > 0 ? (
                      userTargets.map((row, index) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell className="text-sm">{row.targetName}</TableCell>
                          <TableCell className="text-center">{row.category}</TableCell>
                          <TableCell className="text-center text-[#00a65a] underline decoration-dashed cursor-pointer dark:text-zinc-400">{row.target}</TableCell>
                          <TableCell className="text-center">{Number(row.price)}</TableCell>
                          <TableCell className="text-center">{row.bonus}</TableCell>
                          <TableCell className="text-center">{row.vas}</TableCell>
                          <TableCell className="text-center">{row.kwa}</TableCell>
                          <TableCell className="text-center">{row.reward}</TableCell>
                          <TableCell className="text-center">{row.total}</TableCell>
                          <TableCell className="text-center">{row.startDate ? new Date(row.startDate).toLocaleDateString('en-GB') : ""}</TableCell>
                          <TableCell className="text-center">{row.endDate ? new Date(row.endDate).toLocaleDateString('en-GB') : ""}</TableCell>
                          <TableCell className="text-center text-xs">{row.signDate ? new Date(row.signDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '') : ""}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center space-x-2">
                              <Pencil className="w-4 h-4 text-[#00a65a] cursor-pointer hover:text-[#008d4c] dark:text-zinc-400" onClick={() => handleEditUserTarget(row.id)} />
                              <Trash2 
                                className={`w-4 h-4 text-red-500 cursor-pointer hover:text-red-700 ${deleteUserTargetMutation.isPending ? 'opacity-50' : ''}`} 
                                onClick={() => !deleteUserTargetMutation.isPending && handleDeleteUserTarget(row.id)} 
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center py-6 text-gray-500 dark:text-zinc-400">
                          No targets available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 dark:text-zinc-300">
                <div>Showing 1 to 6 of 6 entries</div>
                <div className="flex space-x-1">
                  <Button variant="outline" className="h-8 px-3 text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400">Previous</Button>
                  <Button variant="default" className="h-8 w-8 p-0 bg-[#00a65a] hover:bg-[#008d4c]">1</Button>
                  <Button variant="outline" className="h-8 px-3">Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "role" && showRoleForm && (
        <div className="mb-6">
          <div className="mb-4 max-w-md">
            <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Role type</label>
            <Select value={roleType} onValueChange={setRoleType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose .." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose ..</SelectItem>
                <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                <SelectItem value="Sales Assistant Manager">Sales Assistant Manager</SelectItem>
                <SelectItem value="Service Manager">Service Manager</SelectItem>
                <SelectItem value="Service Assistant Manager">Service Assistant Manager</SelectItem>
                <SelectItem value="Service Executive">Service Executive</SelectItem>
                <SelectItem value="Reception">Reception</SelectItem>
                <SelectItem value="Project manager">Project manager</SelectItem>
                <SelectItem value="Account Manager">Account Manager</SelectItem>
                <SelectItem value="SEO/SMM Manager">SEO/SMM Manager</SelectItem>
                <SelectItem value="Product Posting Manager">Product Posting Manager</SelectItem>
                <SelectItem value="Posting Assistant Manager">Posting Assistant Manager</SelectItem>
                <SelectItem value="Posting Executive">Posting Executive</SelectItem>
                <SelectItem value="SEO/SMM Executive">SEO/SMM Executive</SelectItem>
                <SelectItem value="D&D Manager">D&D Manager</SelectItem>
                <SelectItem value="D&D Assistant Manager">D&D Assistant Manager</SelectItem>
                <SelectItem value="D&D Executive">D&D Executive</SelectItem>
                <SelectItem value="Internship Executive">Internship Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            className="bg-[#00a65a] hover:bg-[#008d4c] px-8 mb-6" 
            onClick={handleSetRoleTarget}
            disabled={assignRoleMutation.isPending}
          >
            {assignRoleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Set
          </Button>
          
          <Card className="border rounded-sm shadow-sm">
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-700 dark:text-zinc-400">Target Details</h3>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#dcfce7] dark:bg-zinc-900">
                    <TableRow className="hover:bg-[#dcfce7] dark:hover:bg-zinc-800">
                      <TableHead className="font-bold text-black">Target Name</TableHead>
                      <TableHead className="font-bold text-black text-center">Category</TableHead>
                      <TableHead className="font-bold text-black text-center w-32">Number</TableHead>
                      <TableHead className="font-bold text-black text-center">Price</TableHead>
                      <TableHead className="font-bold text-black text-center">Bonus</TableHead>
                      <TableHead className="font-bold text-black text-center w-40">Start Date</TableHead>
                      <TableHead className="font-bold text-black text-center w-40">End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleTargets.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium flex items-center space-x-2">
                          <Checkbox 
                            id={`check-${row.id}`} 
                            checked={row.selected}
                            onCheckedChange={(checked) => handleRoleTargetChange(index, "selected", checked === true)}
                          />
                          <label htmlFor={`check-${row.id}`} className="text-sm font-normal cursor-pointer text-gray-600 dark:text-zinc-300">{row.name}</label>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select value={row.category} onValueChange={(val) => handleRoleTargetChange(index, "category", val)}>
                            <SelectTrigger className="h-8 w-28 mx-auto text-xs">
                              <SelectValue placeholder="choose..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">choose...</SelectItem>
                              <SelectItem value="AB New Terget">AB New Terget</SelectItem>
                              <SelectItem value="Renewal Terget">Renewal Terget</SelectItem>
                              <SelectItem value="VAS">VAS</SelectItem>
                              <SelectItem value="Team">Team</SelectItem>
                              <SelectItem value="Dep DD">Dep DD</SelectItem>
                              <SelectItem value="Dep PP">Dep PP</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex mx-auto w-24">
                            <Button 
                              variant="default" 
                              className="bg-[#00a65a] hover:bg-[#008d4c] rounded-r-none px-2 h-8 text-xs"
                              onClick={() => handleRoleTargetChange(index, "number", Math.max(0, row.number - 1))}
                            >
                              -
                            </Button>
                            <Input 
                              type="number"
                              value={row.number} 
                              onChange={(e) => handleRoleTargetChange(index, "number", Number(e.target.value))}
                              className="rounded-none text-center h-8 text-xs px-1" 
                            />
                            <Button 
                              variant="default" 
                              className="bg-[#00a65a] hover:bg-[#008d4c] rounded-l-none px-2 h-8 text-xs"
                              onClick={() => handleRoleTargetChange(index, "number", row.number + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{row.price}</TableCell>
                        <TableCell className="text-center text-sm">{row.bonus}</TableCell>
                        <TableCell className="text-center">
                          <Input type="date" value={row.startDate} onChange={(e) => handleRoleTargetChange(index, "startDate", e.target.value)} className="h-8 text-xs w-full" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="date" value={row.endDate} onChange={(e) => handleRoleTargetChange(index, "endDate", e.target.value)} className="h-8 text-xs w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
