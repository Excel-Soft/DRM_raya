import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

interface BvEntry {
  sr: number;
  company: string;
  package: string;
  price: number;
  extraDisc: number;
  comm: number;
  reward: number;
  vas: number;
  kwa: number;
  method: string;
  person: string;
  pay: number;
  bvSubmit: string;
  bv: string;
  rcNew: string;
  dropout: string;
  type: string;
  receiveDate: string;
}

export default function BvSystem() {
  const [selectedUser, setSelectedUser] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd"));

  const [queryParams, setQueryParams] = useState({
    userId: "All",
    type: "All",
    startDate: startDate,
    endDate: endDate
  });

  const { data: usersData } = useQuery({
    queryKey: ["/api/reports/bv-system/users"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/reports/bv-system/users");
        if (res.ok) {
           return await res.json();
        }
        return [];
      } catch (e) {
        console.error(e);
        return [];
      }
    },
  });

  const { data: reportData, isLoading, isRefetching } = useQuery<BvEntry[]>({
    queryKey: ["/api/reports/bv-system", queryParams],
    queryFn: async () => {
      try {
        const params = new URLSearchParams(queryParams);
        const res = await fetch(`/api/reports/bv-system?${params.toString()}`);
        if (res.ok) {
           return await res.json();
        }
        return [];
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    enabled: !!queryParams.startDate && !!queryParams.endDate,
  });

  const handleView = () => {
    setQueryParams({
      userId: selectedUser,
      type: selectedType,
      startDate,
      endDate
    });
  };

  const usersList = Array.isArray(usersData) ? usersData : [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">BV SYSTEM</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {usersList.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="1">New</SelectItem>
                  <SelectItem value="0">Renew</SelectItem>
                  <SelectItem value="2">Expire</SelectItem>
                  <SelectItem value="3">Rc/Up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <Button onClick={handleView} className="w-full bg-[#1b8045] hover:bg-[#156636]">
              {isLoading || isRefetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              View
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">BV View</h3>
          
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-emerald-100/50">
                <TableRow>
                  <TableHead className="font-bold">sr#</TableHead>
                  <TableHead className="font-bold">Company</TableHead>
                  <TableHead className="font-bold">Package</TableHead>
                  <TableHead className="font-bold">Price</TableHead>
                  <TableHead className="font-bold">ExtraDisc++</TableHead>
                  <TableHead className="font-bold">Comm</TableHead>
                  <TableHead className="font-bold">Reward</TableHead>
                  <TableHead className="font-bold">VAS</TableHead>
                  <TableHead className="font-bold">KWA</TableHead>
                  <TableHead className="font-bold">Method</TableHead>
                  <TableHead className="font-bold">Person</TableHead>
                  <TableHead className="font-bold">Pay</TableHead>
                  <TableHead className="font-bold" title="User BV Submit Date">BV Submit</TableHead>
                  <TableHead className="font-bold">BV</TableHead>
                  <TableHead className="font-bold">Rc/New</TableHead>
                  <TableHead className="font-bold">Dropout</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Receive Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={18} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !reportData || reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="h-24 text-center">
                      No data available in table
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.sr}</TableCell>
                      <TableCell>{row.company}</TableCell>
                      <TableCell>{row.package}</TableCell>
                      <TableCell>{row.price}</TableCell>
                      <TableCell>{row.extraDisc}</TableCell>
                      <TableCell>{row.comm}</TableCell>
                      <TableCell>{row.reward}</TableCell>
                      <TableCell>{row.vas}</TableCell>
                      <TableCell>{row.kwa}</TableCell>
                      <TableCell>{row.method}</TableCell>
                      <TableCell>{row.person}</TableCell>
                      <TableCell>{row.pay}</TableCell>
                      <TableCell>{row.bvSubmit ? format(new Date(row.bvSubmit), "yyyy-MM-dd HH:mm:ss") : ""}</TableCell>
                      <TableCell>{row.bv}</TableCell>
                      <TableCell>{row.rcNew}</TableCell>
                      <TableCell>{row.dropout}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.receiveDate ? format(new Date(row.receiveDate), "yyyy-MM-dd HH:mm:ss") : ""}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
