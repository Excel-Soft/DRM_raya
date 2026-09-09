import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const dummyData = [
  { id: 1, name: "p & p (100-200)", number: 0, price: 1, bonus: "50%", package: "", reward: 50, kwa: 0, vas: 0, create: "27 Apr 2025 06:29 PM" },
  { id: 2, name: "P&P(1040-1559)", number: 0, price: 1040, bonus: "15", package: "", reward: 4000, kwa: 0, vas: 0, create: "15 Apr 2026 05:20 PM" },
  { id: 3, name: "P&P(1040-1559)", number: 0, price: 1040, bonus: "4000%", package: "", reward: 15, kwa: 0, vas: 0, create: "15 Apr 2026 05:19 PM" },
  { id: 4, name: "P&P(1040-1559)", number: 0, price: 0, bonus: "0", package: "", reward: 4000, kwa: 0, vas: 0, create: "15 Apr 2026 04:55 PM" },
  { id: 5, name: "P&P(1040-1559)", number: 0, price: 0, bonus: "4000", package: "", reward: 0, kwa: 0, vas: 0, create: "15 Apr 2026 04:51 PM" },
  { id: 6, name: "P&P", number: 0, price: 1040, bonus: "4000", package: "", reward: 4000, kwa: 0, vas: 0, create: "15 Apr 2026 04:49 PM" },
  { id: 7, name: "VAS (Rs 150,000/- or Above)", number: 0, price: 150000, bonus: "15%", package: "", reward: 7500, kwa: 0, vas: 0, create: "14 Mar 2026 11:41 AM" },
  { id: 8, name: "VAS (Rs. 70,000/- to Rs. 99,999/-)", number: 0, price: 70000, bonus: "10%", package: "", reward: 2500, kwa: 0, vas: 0, create: "14 Mar 2026 11:39 AM" },
  { id: 9, name: "VAS (Below Rs. 70,000/-)", number: 0, price: 1, bonus: "10%", package: "", reward: 0, kwa: 0, vas: 0, create: "14 Mar 2026 11:21 AM" },
  { id: 10, name: "VAS (Rs. 100,000 to Rs 150,000/-)", number: 0, price: 100000, bonus: "12%", package: "", reward: 5000, kwa: 0, vas: 0, create: "14 Mar 2026 11:19 AM" },
];

export default function CreateTarget() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for form fields
  const [targetName, setTargetName] = useState("");
  const [pkg, setPkg] = useState("");
  const [reward, setReward] = useState(0);
  const [bonus, setBonus] = useState("");
  const [price, setPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [penalty, setPenalty] = useState(100);
  const [amount, setAmount] = useState("");

  const { data: targets, isLoading } = useQuery({
    queryKey: ["/api/target-system/targets"],
    queryFn: async () => {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/target-system/targets", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch targets");
      }
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newTarget: any) => {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/target-system/targets", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newTarget)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create target");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/targets"] });
      toast({ title: "Target created successfully" });
      setTargetName("");
      setPkg("");
      setReward(0);
      setBonus("");
      setPrice(0);
      setMaxPrice(0);
      setPenalty(100);
      setAmount("");
      setShowForm(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error creating target", description: error.message, variant: "destructive" });
    }
  });

  const handleCreate = () => {
    if (!targetName) {
      toast({ title: "Target Name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      targetName,
      package: pkg,
      reward,
      bonus,
      price,
      maxPrice,
      penalty,
      amount
    });
  };


  return (
    <div className="p-6">
      <div className="mb-6 flex items-center font-bold text-lg uppercase">
        <span className="text-gray-700 mr-1 dark:text-zinc-400">TARGET SYSTEM /</span>
        <span 
          className="text-[#00a65a] cursor-pointer hover:underline dark:text-zinc-400"
          onClick={() => setShowForm(!showForm)}
        >
          CREATE TARGET
        </span>
      </div>

      {showForm && (
        <Card className="mb-6 border rounded-sm shadow-sm">
          <CardContent className="p-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Target Name:</label>
                <Input value={targetName} onChange={e => setTargetName(e.target.value)} placeholder="Target Name" className="h-9" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Package</label>
                <Select value={pkg} onValueChange={setPkg}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose...</SelectItem>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Basic Plus">Basic Plus</SelectItem>
                    <SelectItem value="GGS Digital">GGS Digital</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Verified Supplier">Verified Supplier</SelectItem>
                    <SelectItem value="Kwa">Kwa</SelectItem>
                    <SelectItem value="Cat">Cat</SelectItem>
                    <SelectItem value="Ai">Ai</SelectItem>
                    <SelectItem value="Psa">Psa</SelectItem>
                    <SelectItem value="SA">SA</SelectItem>
                    <SelectItem value="Rc-Up">Rc-Up</SelectItem>
                    <SelectItem value="KAP">KAP</SelectItem>
                    <SelectItem value="GGS Pro">GGS Pro</SelectItem>
                    <SelectItem value="KWA-KAP">KWA-KAP</SelectItem>
                    <SelectItem value="China Trip">China Trip</SelectItem>
                    <SelectItem value="Kwa-Pro">Kwa-Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Reward:</label>
                <div className="flex">
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-r-none px-3 h-9"
                    onClick={() => setReward(r => Math.max(0, r - 1))}
                  >
                    -
                  </Button>
                  <Input 
                    type="number" 
                    value={reward} 
                    onChange={e => setReward(Number(e.target.value))} 
                    className="rounded-none text-center h-9" 
                  />
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-l-none px-3 h-9"
                    onClick={() => setReward(r => r + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Bonus</label>
                <Select value={bonus} onValueChange={setBonus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose...</SelectItem>
                    <SelectItem value="Amount">Amount</SelectItem>
                    <SelectItem value="Percentage %">Percentage %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Price:</label>
                <div className="flex">
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-r-none px-3 h-9"
                    onClick={() => setPrice(p => Math.max(0, p - 1))}
                  >
                    -
                  </Button>
                  <Input 
                    type="number" 
                    value={price} 
                    onChange={e => setPrice(Number(e.target.value))} 
                    className="rounded-none text-center h-9" 
                  />
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-l-none px-3 h-9"
                    onClick={() => setPrice(p => p + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Max Price:</label>
                <div className="flex">
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-r-none px-3 h-9"
                    onClick={() => setMaxPrice(p => Math.max(0, p - 1))}
                  >
                    -
                  </Button>
                  <Input 
                    type="number" 
                    value={maxPrice} 
                    onChange={e => setMaxPrice(Number(e.target.value))} 
                    className="rounded-none text-center h-9" 
                  />
                  <Button 
                    variant="default" 
                    className="bg-[#00a65a] hover:bg-[#008d4c] rounded-l-none px-3 h-9"
                    onClick={() => setMaxPrice(p => p + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Penalty:</label>
                <Input type="number" value={penalty} onChange={e => setPenalty(Number(e.target.value))} className="h-9" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Amount:</label>
                <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount name" className="h-9" />
              </div>
              <div>
                <Button 
                  className="w-full bg-[#00a65a] hover:bg-[#008d4c] h-9"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
                  <TableHead className="font-bold text-black dark:text-zinc-300 w-12 text-center">#</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Target Name</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Number</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Bonus</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Package</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Reward</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">KWA</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">VAS</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Create</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : targets?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                      No targets found. Create one above!
                    </TableCell>
                  </TableRow>
                ) : (
                  targets?.map((row: any, index: number) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell className="text-center">{row.targetName}</TableCell>
                      <TableCell className="text-center">{row.number}</TableCell>
                      <TableCell className="text-center">
                        {row.amount}
                      </TableCell>
                      <TableCell className="text-center">{row.bonus}</TableCell>
                      <TableCell className="text-center">{row.package === "none" ? "" : row.package}</TableCell>
                      <TableCell className="text-center">
                        {row.bonus === "Percentage %" ? `${row.reward}%` : row.reward}
                      </TableCell>
                      <TableCell className="text-center">{row.kwa}</TableCell>
                      <TableCell className="text-center">{row.vas}</TableCell>
                      <TableCell className="text-center">{format(new Date(row.createdAt), "dd MMM yyyy hh:mm a")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 dark:text-zinc-300">
            <div>Showing {targets?.length || 0} entries</div>
            <div className="flex space-x-1">
              <Button variant="outline" className="h-8 px-3 text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400">Previous</Button>
              <Button variant="default" className="h-8 w-8 p-0 bg-[#00a65a] hover:bg-[#008d4c]">1</Button>
              <Button variant="outline" className="h-8 w-8 p-0">2</Button>
              <Button variant="outline" className="h-8 w-8 p-0">3</Button>
              <Button variant="outline" className="h-8 w-8 p-0">4</Button>
              <Button variant="outline" className="h-8 w-8 p-0">5</Button>
              <Button variant="outline" className="h-8 w-8 p-0">6</Button>
              <Button variant="outline" className="h-8 px-3">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
