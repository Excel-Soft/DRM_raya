import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Initial mock data as fallback
const mockData = [
  { id: 1, company: "trusmile surgical", amount: "10000", method: "364", date: "2021-07-13 17:08:25" },
  { id: 2, company: "trusmile surgical", amount: "10000", method: "364", date: "2021-07-13 17:08:25" },
];

export default function ReceptionReport() {
  const [monthWise, setMonthWise] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [user, setUser] = useState("");

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await fetch("/api/account/users-list", {
        headers: {
          "Authorization": `Bearer ${sessionStorage.getItem("token") || ""}`
        }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const selectedUserInfo = users.find((u) => u.id === user);

  // Dynamically generate data for the selected user to demonstrate functionality
  const tableData = user && user !== "all" && selectedUserInfo
    ? [
        { 
          id: 1, 
          company: `${selectedUserInfo.full_name}'s Client`, 
          amount: "15000", 
          method: "Bank Transfer", 
          date: new Date().toISOString().replace('T', ' ').substring(0, 19) 
        },
        { 
          id: 2, 
          company: "trusmile surgical", 
          amount: "10000", 
          method: "364", 
          date: "2021-07-13 17:08:25" 
        }
      ]
    : mockData;

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <h1 className="text-[17px] font-bold text-[#555] uppercase tracking-wide">
          RECEPTION REPORT
        </h1>

        {/* Filter Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Select User */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Label className="text-[13px] font-bold text-[#555]">Select User</Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox 
                      id="month-wise" 
                      checked={monthWise}
                      onCheckedChange={(c) => setMonthWise(!!c)}
                      className="h-3.5 w-3.5 border-slate-300"
                    />
                    <label htmlFor="month-wise" className="text-[13px] text-[#555] cursor-pointer">
                      Month Wise
                    </label>
                  </div>
                </div>
                <Select value={user} onValueChange={setUser}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} {u.role ? `(${u.role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Start Date</Label>
                <div className="relative">
                  <Input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" 
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">End Date</Label>
                <div className="relative">
                  <Input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" 
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-semibold rounded-sm">
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Table Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 py-4 px-6 bg-white">
            <CardTitle className="text-[15px] font-bold text-[#555]">
              View Reception Report
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b-0 bg-[#d9f2e6] hover:bg-[#d9f2e6]">
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-center w-[25%]">Company</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-center w-[25%]">Amount</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-center w-[25%]">Method</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-center w-[25%]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {!user ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Please select a user to view their reception report.
                      </TableCell>
                    </TableRow>
                  ) : tableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No reception records found for the selected user.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableData.map((item) => (
                      <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                        <TableCell className="py-3 px-4 text-[#555] text-center">{item.company}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555] text-center">{item.amount}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555] text-center">{item.method}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555] text-center">{item.date}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
