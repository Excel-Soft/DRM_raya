import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ViewTarget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");

  const { data: allTargets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/user-targets"],
  });

  const { data: usersRes } = useQuery<any>({
    queryKey: ["/api/users"],
  });
  
  const usersList = usersRes?.data || usersRes?.users || usersRes || [];
  
  // Group users by role
  const groupedUsers = usersList.reduce((acc: any, user: any) => {
    const role = user.role || 'Unassigned';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});

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
    }
  });

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const displayedTargets = allTargets.filter(t => t.userId === selectedUser);


  return (
    <div className="p-6">
      <div className="mb-6 flex items-center font-bold text-lg uppercase">
        <span className="text-[#2b3553] dark:text-zinc-100">TARGET SYSTEM</span>
      </div>

      <div className="bg-white p-4 rounded-sm shadow-sm border mb-6 dark:bg-zinc-900">
        <label className="block text-sm mb-2 text-gray-700 dark:text-zinc-400">View Targets</label>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose..." />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <Input placeholder="" className="h-8" />
            </div>
            {Object.entries(groupedUsers).map(([role, usersInRole]: [string, any]) => (
              <SelectGroup key={role}>
                <SelectLabel className="font-bold text-[#00a65a] capitalize dark:text-zinc-400">
                  {role.replace(/_/g, ' ')}
                </SelectLabel>
                {usersInRole.map((user: any) => (
                  <SelectItem key={user.id} value={user.fullName || user.username}>
                    {user.fullName || user.username}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedUser && (
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
                    <TableHead className="font-bold text-black text-center">Target</TableHead>
                    <TableHead className="font-bold text-black text-center">Price</TableHead>
                    <TableHead className="font-bold text-black text-center">Bonns</TableHead>
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
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                        Loading live data...
                      </TableCell>
                    </TableRow>
                  ) : displayedTargets.length > 0 ? (
                    displayedTargets.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">{row.targetName}</TableCell>
                        <TableCell className="text-center text-sm">{row.category}</TableCell>
                        <TableCell className="text-center text-sm">{row.target}</TableCell>
                        <TableCell className="text-center text-sm">{row.price}</TableCell>
                        <TableCell className="text-center text-sm">{row.bonus}</TableCell>
                        <TableCell className="text-center text-sm">{row.vas}</TableCell>
                        <TableCell className="text-center text-sm">{row.kwa}</TableCell>
                        <TableCell className="text-center text-sm">{row.reward}</TableCell>
                        <TableCell className="text-center text-sm">{row.total}</TableCell>
                        <TableCell className="text-center text-sm">{row.startDate ? new Date(row.startDate).toLocaleDateString() : ""}</TableCell>
                        <TableCell className="text-center text-sm">{row.endDate ? new Date(row.endDate).toLocaleDateString() : ""}</TableCell>
                        <TableCell className="text-center text-xs">{row.signDate ? new Date(row.signDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '') : ""}</TableCell>
                        <TableCell className="text-center">
                          <Trash2 
                            className={`w-4 h-4 text-red-500 cursor-pointer mx-auto ${deleteMutation.isPending ? 'opacity-50' : ''}`}
                            onClick={() => !deleteMutation.isPending && handleDelete(row.id)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                        No targets assigned to {selectedUser}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
