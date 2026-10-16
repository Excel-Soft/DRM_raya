import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d
    .toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    .replace(/,/g, "");
}

export default function KwaHistory() {
  const { toast } = useToast();

  // Same role-grouping convention as the other Select User pickers in this
  // app — the KWA tables match people by free-text name, so the value sent
  // is the person's name, not their id.
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

  const [selectedUser, setSelectedUser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [queryParams, setQueryParams] = useState<{ employee: string; startDate: string; endDate: string } | null>(null);

  const { data: historyData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-history", queryParams],
    queryFn: async () => {
      if (!queryParams) return [];
      const params = new URLSearchParams();
      params.set("employee", queryParams.employee);
      params.set("startDate", queryParams.startDate);
      params.set("endDate", queryParams.endDate);
      const res = await apiRequest("GET", `/api/target-system/kwa-history?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!queryParams,
  });

  const handleView = () => {
    if (!selectedUser || !startDate || !endDate) {
      toast({ title: "Select a user and both dates first.", variant: "destructive" });
      return;
    }
    setQueryParams({ employee: selectedUser, startDate, endDate });
  };

  // "View All Data" modal — legacy's unfiltered richer view (webxl_kwa_history
  // joined with the company/person/kwa record), with the same client-side
  // search + date-range filtering kwahistory.php's own JS applies.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalFrom, setModalFrom] = useState("");
  const [modalTo, setModalTo] = useState("");

  const { data: allHistory = [], isLoading: isModalLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-history", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/target-system/kwa-history");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isModalOpen,
  });

  const filteredModalData = useMemo(() => {
    return allHistory.filter((row) => {
      if (modalSearch) {
        const q = modalSearch.toLowerCase();
        const matches = [row.company, row.employee, row.kwaType, row.actionType, row.detail].some((v) =>
          (v || "").toString().toLowerCase().includes(q),
        );
        if (!matches) return false;
      }
      if (modalFrom || modalTo) {
        const rowDate = row.payDate ? new Date(row.payDate) : null;
        if (!rowDate) return false;
        if (modalFrom && rowDate < new Date(modalFrom)) return false;
        if (modalTo && rowDate > new Date(`${modalTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [allHistory, modalSearch, modalFrom, modalTo]);

  return (
    <div className="p-6">
      <div className="mb-6 font-bold text-lg uppercase text-gray-700 dark:text-zinc-400">KWA HISTORY</div>

      <Card className="mb-6 border rounded-sm shadow-sm bg-white dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div>
              <label className="block text-sm mb-2 text-gray-700 font-medium dark:text-zinc-400">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-10 border-gray-300 dark:border-zinc-800">
                  <SelectValue placeholder="Choose ..." />
                </SelectTrigger>
                <SelectContent>
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

            <div>
              <label className="block text-sm mb-2 text-gray-700 font-medium dark:text-zinc-400">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-gray-300 dark:border-zinc-800" />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700 font-medium dark:text-zinc-400">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-gray-300 dark:border-zinc-800" />
            </div>

            <div className="flex gap-2">
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] px-8 h-10" onClick={handleView}>
                View
              </Button>
              <Button
                variant="secondary"
                className="bg-[#78829d] hover:bg-[#5e667b] text-white h-10"
                onClick={() => setIsModalOpen(true)}
              >
                View All Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border rounded-sm shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#f3f4f6] dark:bg-zinc-900">
                <TableRow className="hover:bg-[#f3f4f6] dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-gray-700 w-16 dark:text-zinc-400">#</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Company</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Person</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Pay</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Remaining</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Detail</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!queryParams ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gray-500 dark:text-zinc-400">
                      Select a user and date range, then click View.
                    </TableCell>
                  </TableRow>
                ) : isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gray-500 dark:text-zinc-400">
                      Loading live data...
                    </TableCell>
                  </TableRow>
                ) : historyData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gray-500 dark:text-zinc-400">
                      No records found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  historyData.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{index + 1}</TableCell>
                      <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.company}</TableCell>
                      <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.employee}</TableCell>
                      <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.amount}$</TableCell>
                      <TableCell className="text-sm text-gray-700 dark:text-zinc-400">
                        {row.remaining != null ? `${row.remaining}$` : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.detail || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{formatDateTime(row.payDate)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 bg-white dark:bg-zinc-900 dark:text-zinc-300">
            <div>Showing 1 to {historyData.length} of {historyData.length} entries</div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>All Records</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Search</label>
              <Input value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} placeholder="Search in all columns..." />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">From</label>
              <Input type="date" value={modalFrom} onChange={(e) => setModalFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">To</label>
              <Input type="date" value={modalTo} onChange={(e) => setModalTo(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[60vh]">
            <Table>
              <TableHeader className="bg-[#f3f4f6] dark:bg-zinc-900">
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>KWA Type</TableHead>
                  <TableHead>KWA Remaining</TableHead>
                  <TableHead>Pay Date</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Action Type</TableHead>
                  <TableHead>Create At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isModalLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-gray-500 dark:text-zinc-400">
                      Loading data...
                    </TableCell>
                  </TableRow>
                ) : filteredModalData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-gray-500 dark:text-zinc-400">
                      No matching records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModalData.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{row.company}</TableCell>
                      <TableCell>{row.employee}</TableCell>
                      <TableCell>{row.kwaType || "-"}</TableCell>
                      <TableCell>{row.remaining != null ? `${row.remaining}$` : "-"}</TableCell>
                      <TableCell>{formatDateTime(row.payDate)}</TableCell>
                      <TableCell>{row.detail || "-"}</TableCell>
                      <TableCell>{row.amount}$</TableCell>
                      <TableCell>{row.actionType}</TableCell>
                      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
