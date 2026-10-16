import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AddKwa() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: kwaData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-records"],
  });

  // Real customers for the Company Name autocomplete — same
  // /api/account/customers-list endpoint and search-dropdown convention used
  // by the Temp GM form.
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/account/customers-list"],
  });

  // Real users for the Person dropdown — same role-grouping convention used
  // elsewhere (KWA History, Target System, BV Report Select User pickers).
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const body = await res.json().catch(() => null);
      return body?.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    users.forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(u);
    });
    return Object.entries(grouped)
      .map(([role, users]) => ({ role, users }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  // Form State
  const [company, setCompany] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [kwaValue, setKwaValue] = useState("");
  const [type, setType] = useState("none");
  const [person, setPerson] = useState("none");
  const [detail, setDetail] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!company.trim()) return customers.slice(0, 20);
    const q = company.toLowerCase();
    return customers
      .filter((c) =>
        c.company_name?.toLowerCase().includes(q) ||
        c.drm_id?.toLowerCase().includes(q) ||
        c.person_name?.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [company, customers]);

  // Use Kwa Modal State
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [useAmount, setUseAmount] = useState("");
  const [useAction, setUseAction] = useState<"Used" | "Refund">("Used");
  const [useDetail, setUseDetail] = useState("");
  const [usedByInput, setUsedByInput] = useState("");

  const handleOpenUseModal = (row: any) => {
    setSelectedRow(row);
    setUseAmount("");
    setUseAction("Used");
    setUseDetail("");
    // Defaults to whoever sold it — the same person usually records usage,
    // but this is editable since legacy tracks Sell By / Used By separately.
    setUsedByInput(row.employee || "");
    setIsUseModalOpen(true);
  };

  const useKwaMutation = useMutation({
    mutationFn: async (vars: { id: number; amount: number; action: string; detail?: string; usedBy?: string }) => {
      const res = await apiRequest("PATCH", `/api/target-system/kwa-records/${vars.id}/use`, {
        amount: vars.amount,
        action: vars.action,
        detail: vars.detail,
        usedBy: vars.usedBy,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update KWA record.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/kwa-records"] });
      toast({ title: "Kwa Used Successfully!" });
      setIsUseModalOpen(false);
      setSelectedRow(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update KWA record.", variant: "destructive" });
    }
  });

  const handleUseKwaSubmit = () => {
    const amount = Number(useAmount);
    if (!selectedRow || !amount || amount <= 0) {
      toast({ title: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    useKwaMutation.mutate({
      id: selectedRow.id,
      amount,
      action: useAction,
      detail: useDetail || undefined,
      usedBy: usedByInput.trim() || undefined,
    });
  };

  const saveKwaMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const res = await apiRequest("POST", "/api/target-system/kwa-records", newRecord);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to create KWA record.");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/kwa-records"] });
      toast({ title: "KWA record added successfully!" });

      // Reset form
      setCompany("");
      setKwaValue("");
      setType("none");
      setPerson("none");
      setDetail("");
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create KWA record.", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!company || !kwaValue || type === "none" || person === "none") {
      toast({ title: "Please fill out all required fields (Company, Kwa, Type, Person).", variant: "destructive" });
      return;
    }

    saveKwaMutation.mutate({
      company,
      employee: person,
      kwa: kwaValue,
      detail,
      type,
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center font-bold text-lg uppercase">
        <span className="text-gray-700 mr-2 dark:text-zinc-400">KWA RECORD /</span>
        <span 
          className="text-[#00a65a] cursor-pointer hover:underline dark:text-zinc-400"
          onClick={() => setIsFormOpen(!isFormOpen)}
        >
          ADD KWA
        </span>
      </div>

      {isFormOpen && (
        <Card className="mb-6 border rounded-sm shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Company Name</label>
                <div className="relative">
                  <Input
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      setShowCompanyDropdown(true);
                    }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                    placeholder="Search Company Through Id/Name"
                    className="h-9 pr-7"
                  />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
                {showCompanyDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto dark:bg-zinc-900 dark:border-zinc-800">
                    {filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onMouseDown={() => {
                          setCompany(c.company_name);
                          setShowCompanyDropdown(false);
                        }}
                        className="px-2 py-1.5 text-sm cursor-pointer hover:bg-green-50 border-b border-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                      >
                        <span className="font-medium text-gray-800 dark:text-zinc-100">{c.company_name}</span>
                        {c.drm_id && <span className="text-gray-400 ml-1">({c.drm_id})</span>}
                        {c.person_name && <span className="text-gray-500 ml-1 dark:text-zinc-400">• {c.person_name}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Kwa($):</label>
                <Input 
                  placeholder="Kwa($)" 
                  type="number"
                  value={kwaValue}
                  onChange={(e) => setKwaValue(e.target.value)}
                  className="h-9" 
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Type:</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose ..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose ...</SelectItem>
                    <SelectItem value="Kwa">Kwa</SelectItem>
                    <SelectItem value="Cat">Cat</SelectItem>
                    <SelectItem value="Ai">Ai</SelectItem>
                    <SelectItem value="Psa">Psa</SelectItem>
                    <SelectItem value="SA">SA</SelectItem>
                    <SelectItem value="Resubmission of BV">Resubmission of BV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Person:</label>
                <Select value={person} onValueChange={setPerson}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose...</SelectItem>
                    {groupedUsers.map(({ role, users }) => (
                      <SelectGroup key={role}>
                        <SelectLabel>{role}</SelectLabel>
                        {users.filter((u) => u.fullName || u.username).map((u) => (
                          <SelectItem key={u.id} value={u.fullName || u.username}>
                            {u.fullName || u.username}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Detail</label>
              <Input
                placeholder="add detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className="w-full"
              />
            </div>

            <Button className="bg-[#00a65a] hover:bg-[#008d4c] px-6" onClick={handleSubmit}>
              Submit
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border rounded-sm shadow-sm">
        <CardContent className="p-0">
          <Dialog open={isUseModalOpen} onOpenChange={setIsUseModalOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-normal text-gray-700 border-b pb-4 dark:text-zinc-400">Use Kwa</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Company:</label>
                  <Input value={selectedRow?.company || ""} disabled className="bg-gray-100 text-gray-600 h-10 dark:text-zinc-300 dark:bg-zinc-900" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Person:</label>
                  <Input value={selectedRow?.employee || ""} disabled className="bg-gray-100 text-gray-600 h-10 dark:text-zinc-300 dark:bg-zinc-900" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Remaining:</label>
                  <Input value={selectedRow ? `${selectedRow.remaining}$` : ""} disabled className="bg-gray-100 text-gray-600 h-10 dark:text-zinc-300 dark:bg-zinc-900" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Used By:</label>
                  <Input
                    placeholder="Who is using this?"
                    value={usedByInput}
                    onChange={(e) => setUsedByInput(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Kwa($):</label>
                  <Input
                    placeholder="Kwa($)"
                    type="number"
                    className="h-10"
                    value={useAmount}
                    onChange={(e) => setUseAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Kwa Type:</label>
                  <Select value={useAction} onValueChange={(v) => setUseAction(v as "Used" | "Refund")}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Used" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Used">Used</SelectItem>
                      <SelectItem value="Refund">Refund</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Detail:</label>
                  <Textarea className="min-h-[100px] resize-y" value={useDetail} onChange={(e) => setUseDetail(e.target.value)} />
                </div>
              </div>
              <DialogFooter className="border-t pt-4">
                <Button variant="secondary" onClick={() => setIsUseModalOpen(false)}>Close</Button>
                <Button className="bg-[#00a65a] hover:bg-[#008d4c]" onClick={handleUseKwaSubmit} disabled={useKwaMutation.isPending}>
                  {useKwaMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex flex-col space-y-2">
              <span className="text-sm text-gray-600 dark:text-zinc-300">Show</span>
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-zinc-300">
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
            <div className="flex flex-col space-y-2 text-right">
              <span className="text-sm text-gray-600 dark:text-zinc-300">Search:</span>
              <Input className="h-8 w-48" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 border-b border-t dark:bg-zinc-900">
                <TableRow>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">No#</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Com Id</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Company</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Employee</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Kwa</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Detail</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Remaining</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Type</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Date</TableHead>
                  <TableHead className="font-bold text-gray-700 text-center dark:text-zinc-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-gray-500 dark:text-zinc-400">Loading live data...</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {kwaData.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{index + 1}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.id}</TableCell>
                        <TableCell className="text-sm text-gray-700 uppercase dark:text-zinc-400">{row.company}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.employee}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.kwa}$</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.detail}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.remaining}$</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.type}</TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap dark:text-zinc-400">{new Date(row.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '')}</TableCell>
                        <TableCell className="text-center">
                          <PlusCircle 
                            className="w-5 h-5 text-[#00a65a] cursor-pointer hover:text-[#008d4c] mx-auto dark:text-zinc-400" 
                            onClick={() => handleOpenUseModal(row)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {kwaData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-gray-500 dark:text-zinc-400">No KWA records found.</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 dark:text-zinc-300">
            <div>Showing 1 to {Math.min(10, kwaData.length)} of {kwaData.length} entries</div>
            <div className="flex space-x-1">
              <Button variant="outline" className="h-8 px-3 text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400">Previous</Button>
              <Button variant="default" className="h-8 w-8 p-0 bg-[#00a65a] hover:bg-[#008d4c]">1</Button>
              <Button variant="outline" className="h-8 w-8 p-0">2</Button>
              <Button variant="outline" className="h-8 w-8 p-0">3</Button>
              <Button variant="outline" className="h-8 w-8 p-0">4</Button>
              <Button variant="outline" className="h-8 w-8 p-0">5</Button>
              <span className="px-2 flex items-end">...</span>
              <Button variant="outline" className="h-8 w-8 p-0">27</Button>
              <Button variant="outline" className="h-8 px-3">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
