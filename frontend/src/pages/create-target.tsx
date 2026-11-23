import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Packages whose service includes a KWA allotment — mirrors the legacy
// targetcreate.php condition (package in 'Basic Pro'/'Standard'/'Premium'/
// 'KWA'/'TSA'/'Verified Supplier'), mapped onto this app's actual package
// names since "Basic Pro" and "TSA" don't exist here (closest equivalents:
// Basic, and the Kwa-flavored packages).
const KWA_PACKAGES = new Set(["Basic", "Standard", "Premium", "Verified Supplier", "Kwa", "Kwa-Pro", "KWA-KAP"]);
// VAS is only relevant for Basic Plus — exact match with the legacy condition.
const VAS_PACKAGE = "Basic Plus";

function amountToConversion(amount: string): number {
  const n = Number(amount);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

export default function CreateTarget() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for form fields
  const [targetName, setTargetName] = useState("");
  const [category, setCategory] = useState("none");
  const [pkg, setPkg] = useState("");
  const [reward, setReward] = useState(0);
  const [bonus, setBonus] = useState("");
  const [price, setPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [penalty, setPenalty] = useState(100);
  const [amount, setAmount] = useState("");
  const [kwa, setKwa] = useState(0);
  const [vas, setVas] = useState(0);
  // Row being edited (null = creating a new target).
  const [editingId, setEditingId] = useState<string | null>(null);

  const showKwaField = KWA_PACKAGES.has(pkg);
  const showVasField = pkg === VAS_PACKAGE;

  // Table controls
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState("10");
  const [page, setPage] = useState(1);

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
      const res = await fetch(editingId ? `/api/target-system/targets/${editingId}` : "/api/target-system/targets", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newTarget)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || (editingId ? "Failed to update target" : "Failed to create target"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/targets"] });
      toast({ title: editingId ? "Target updated successfully" : "Target created successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: editingId ? "Error updating target" : "Error creating target", description: error.message, variant: "destructive" });
    }
  });

  function resetForm() {
      setEditingId(null);
      setTargetName("");
      setCategory("none");
      setPkg("");
      setReward(0);
      setBonus("");
      setPrice(0);
      setMaxPrice(0);
      setPenalty(100);
      setAmount("");
      setKwa(0);
      setVas(0);
      setShowForm(false);
  }

  const handleEdit = (row: any) => {
    setEditingId(String(row.id));
    setTargetName(row.targetName ?? "");
    setCategory(row.category || "none");
    setPkg(row.package || "");
    setReward(Number(row.reward) || 0);
    setBonus(row.bonus || "");
    setPrice(Number(row.price) || 0);
    setMaxPrice(Number(row.maxPrice) || 0);
    setPenalty(Number(row.penalty) || 0);
    setAmount(row.amount ?? String(row.conversion ?? ""));
    setKwa(Number(row.kwa) || 0);
    setVas(Number(row.vas) || 0);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreate = () => {
    if (!targetName) {
      toast({ title: "Target Name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      targetName,
      category: category === "none" ? undefined : category,
      package: pkg,
      reward,
      bonus,
      price,
      maxPrice,
      penalty,
      amount,
      kwa: showKwaField ? kwa : 0,
      vas: showVasField ? vas : 0,
      // Legacy targetcreate.php posted the "Amount" field as `vas`, stored in
      // webxl_terget.conversion — the bonus amount used by Set/View Target.
      conversion: amountToConversion(amount),
    });
  };

  const filteredTargets = useMemo(() => {
    const rows: any[] = Array.isArray(targets) ? targets : [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((row) =>
      [row.targetName, row.category, row.package, row.bonus]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [targets, search]);

  const limit = Number(pageSize) || 10;
  const totalPages = Math.max(1, Math.ceil(filteredTargets.length / limit));
  const currentPage = Math.min(page, totalPages);
  const pagedTargets = filteredTargets.slice((currentPage - 1) * limit, currentPage * limit);

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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Target Name:</label>
                <Input value={targetName} onChange={e => setTargetName(e.target.value)} placeholder="Target Name" className="h-9" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose...</SelectItem>
                    <SelectItem value="AB New Terget">AB New Terget</SelectItem>
                    <SelectItem value="Renewal Terget">Renewal Terget</SelectItem>
                    <SelectItem value="VAS">VAS</SelectItem>
                    <SelectItem value="Team">Team</SelectItem>
                    <SelectItem value="Dep DD">Dep DD</SelectItem>
                    <SelectItem value="Dep PP">Dep PP</SelectItem>
                    <SelectItem value="PP Link">PP Link</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="Renewal">Renewal</SelectItem>
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
                <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mt-4">
              {showKwaField && (
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">KWA:</label>
                  <Input type="number" value={kwa} onChange={e => setKwa(Number(e.target.value))} className="h-9" />
                </div>
              )}
              {showVasField && (
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">VAS:</label>
                  <Input type="number" value={vas} onChange={e => setVas(Number(e.target.value))} className="h-9" />
                </div>
              )}
              <div>
                <Button
                  className="w-full bg-[#00a65a] hover:bg-[#008d4c] h-9"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingId ? "Update" : "Create"}
                </Button>
                {editingId && (
                  <Button variant="outline" className="w-full h-9 mt-2" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
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
                <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setPage(1); }}>
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
                <Input
                  className="h-8 w-48"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#dcfce7] dark:bg-zinc-900">
                <TableRow className="hover:bg-[#dcfce7] dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-black dark:text-zinc-300 w-12 text-center">#</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Target Name</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Category</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Number</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Bonus</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Package</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Reward</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">KWA</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">VAS</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Create</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : pagedTargets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                      {search ? "No targets match your search." : "No targets found. Create one above!"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedTargets.map((row: any, index: number) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center font-medium">{(currentPage - 1) * limit + index + 1}</TableCell>
                      <TableCell className="text-center">{row.targetName}</TableCell>
                      <TableCell className="text-center">{row.category || "-"}</TableCell>
                      <TableCell className="text-center">{row.number}</TableCell>
                      <TableCell className="text-center">{Number(row.price) || 0}</TableCell>
                      {/* Legacy "Bonus" column: the bonus amount (conversion), with % when the bonus type is Percentage. */}
                      <TableCell className="text-center">
                        {row.conversion ?? 0}{row.bonus === "Percentage %" ? "%" : ""}
                      </TableCell>
                      <TableCell className="text-center">{row.package === "none" ? "" : row.package}</TableCell>
                      <TableCell className="text-center">{row.reward}</TableCell>
                      <TableCell className="text-center">{row.kwa}</TableCell>
                      <TableCell className="text-center">{row.vas}</TableCell>
                      <TableCell className="text-center">{format(new Date(row.createdAt), "dd MMM yyyy hh:mm a")}</TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => handleEdit(row)} className="text-[12px] text-[#00a65a] hover:underline">Edit</button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 dark:text-zinc-300">
            <div>
              Showing {filteredTargets.length === 0 ? 0 : (currentPage - 1) * limit + 1} to{" "}
              {(currentPage - 1) * limit + pagedTargets.length} of {filteredTargets.length} entries
            </div>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                className="h-8 px-3 text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === currentPage ? "default" : "outline"}
                  className={p === currentPage ? "h-8 w-8 p-0 bg-[#00a65a] hover:bg-[#008d4c]" : "h-8 w-8 p-0"}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-8 px-3"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
