import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock data for initial layout
const mockData = [
  {
    id: "54560",
    name: "Test Profile For Developer",
    netSalary: "1212",
    paidLeave: "2",
    earnDays: "26 - 25=1",
    absentDays: "23",
    absentRs: "929",
    lateMin: "0",
    cuttingMin: "0 - 62 = -62",
    cuttingMinRs: "0",
    perDayRs: "40",
    totalCutting: "929",
    totalSalary: "283",
    monthYear: "4 / 2026",
    gender: "male"
  }
];

export default function SalaryCreate() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"create" | "all">("create");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);

  const filteredData = mockData.filter(item => 
    item.gender === gender && 
    (item.name.toLowerCase().includes(search.toLowerCase()) || item.id.includes(search))
  );

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-[17px] font-bold uppercase flex items-center gap-2">
            <button 
              onClick={() => setActiveTab("create")} 
              className={`bg-transparent border-none p-0 cursor-pointer ${activeTab === "create" ? "text-[#555]" : "text-[#00a65a] hover:text-[#008d4c]"}`}
            >
              SALARY CREATE
            </button>
            <span className="text-[#555]">/</span>
            <button 
              onClick={() => setActiveTab("all")} 
              className={`bg-transparent border-none p-0 cursor-pointer ${activeTab === "all" ? "text-[#00a65a]" : "text-[#555] hover:text-[#00a65a]"}`}
            >
              ALL SALARY
            </button>
          </h1>
        </div>

        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">
            
            {/* Gender Toggle */}
            <div className="flex bg-white rounded-md overflow-hidden border border-slate-200">
              <button
                className={`flex-1 py-2 text-[14px] font-bold transition-colors ${
                  gender === "male" 
                    ? "bg-[#00a65a] text-white" 
                    : "text-slate-500 hover:bg-slate-50"
                }`}
                onClick={() => setGender("male")}
              >
                Male
              </button>
              <button
                className={`flex-1 py-2 text-[14px] font-bold transition-colors ${
                  gender === "female" 
                    ? "bg-[#00a65a] text-white" 
                    : "text-slate-500 hover:bg-slate-50"
                }`}
                onClick={() => setGender("female")}
              >
                Female
              </button>
            </div>

            {activeTab === "all" && (
              <div className="pt-2">
                <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm">
                  Create All Salary
                </Button>
              </div>
            )}

            {/* Search */}
            <div className="flex justify-end">
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs font-semibold text-slate-500">Search:</span>
                <Input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[200px] h-8 bg-white border-slate-300 rounded-sm text-xs focus-visible:ring-0 focus-visible:border-slate-400"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 mt-4">
              {activeTab === "create" ? (
                <Table className="w-full text-[13px] whitespace-nowrap">
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#fdf3db]">
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">User ID</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Name</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Net Salary</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Paid Leave</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Earn Days</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Absents Days</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Absents RS</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Total Late Min</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Cutting Min</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Cutting Min RS</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Per Day RS</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Total Cutting</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Total Salary</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Month / Year</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-center text-xs">Salary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                          No data available in table
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((item, idx) => (
                        <TableRow key={idx} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                          <TableCell className="py-3 px-3 text-[#555]">{item.id}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555] font-semibold">{item.name}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.netSalary}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.paidLeave}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.earnDays}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.absentDays}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.absentRs}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.lateMin}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.cuttingMin}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.cuttingMinRs}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.perDayRs}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.totalCutting}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.totalSalary}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.monthYear}</TableCell>
                          <TableCell className="py-3 px-3 text-center">
                            <button 
                              onClick={() => setEditItem(item)}
                              className="text-[#00a65a] hover:text-[#008d4c] transition-colors bg-transparent border-none cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table className="w-full text-[13px] whitespace-nowrap">
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#fdf3db]">
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs w-[40px]">#</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Name</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Salary</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Paid<br/>Leave</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Earn<br/>Days</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Absents</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Absents<br/>RS</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Late<br/>Min</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Cutting<br/>Min</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Min<br/>RS</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Per<br/>Day</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Penalty</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Loan</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">P.Leaves<br/>Rupees</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">VAS</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">5%<br/>Bonus</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">AB<br/>Bonus</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Project<br/>Bonus</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">PPP<br/>Bonus</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">PP<br/>Bonus</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">OT<br/>RS</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Total<br/>Cutting</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Total<br/>Salary</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Month /<br/>Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={24} className="text-center text-muted-foreground py-8">
                          No data available in table
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((item, idx) => (
                        <TableRow key={idx} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                          <TableCell className="py-3 px-3 text-[#555]">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" className="rounded-sm border-slate-300" />
                              {idx + 1}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-3 text-[#555] font-semibold">{item.name}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.netSalary}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.paidLeave}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.earnDays}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.absentDays}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">929.2</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.lateMin}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.cuttingMin}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.cuttingMinRs}</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">40.4</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]"></TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0-0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]"></TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">0</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">929.2</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">282.8</TableCell>
                          <TableCell className="py-3 px-3 text-[#555]">{item.monthYear}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="text-sm text-[#777] mt-4 font-medium">
              Showing {filteredData.length > 0 ? 1 : 0} to {filteredData.length} of {filteredData.length} entries
            </div>

          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-[1200px] w-[95vw] p-0 gap-0 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit Salary</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            // TODO: Submit API call
            toast({
              title: "Success",
              description: "Salary details have been saved successfully.",
            });
            setEditItem(null);
          }} className="p-6 bg-[#f8f9fa] space-y-6">
            
            {/* Team VAS Section */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-bold text-[#555]">Team VAS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 bg-white p-4 border border-slate-100 rounded-sm">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Name</Label>
                  <Input className="h-9 bg-[#f8f9fa] border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Amount</Label>
                  <Input className="h-9 bg-[#f8f9fa] border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Total</Label>
                  <Input defaultValue="0" className="h-9 bg-[#f8f9fa] border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
              </div>
            </div>

            {/* Employee Salary Section */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-bold text-[#555]">Employee Salary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 bg-white p-6 border border-slate-100 rounded-sm">
                
                {/* Row 1 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Name</Label>
                  <Input readOnly defaultValue={editItem?.name || ""} className="h-9 bg-[#eef1f5] border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Gross Salary</Label>
                  <Input defaultValue={editItem?.netSalary || ""} className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Present Days</Label>
                  <Input defaultValue="1" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Unpaid Leave</Label>
                  <Input defaultValue="23" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>

                {/* Row 2 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Cutting Min</Label>
                  <Input defaultValue="-62" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Pending Leave</Label>
                  <Input className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Pending Leave Rupees</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">VAS</Label>
                  <Input className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>

                {/* Row 3 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">VAS Bonus</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">5 % Bonus</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Alibaba Bonus</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Project Bonus</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>

                {/* Row 4 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">PPP Bonus</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Product Posting Bonus(0)</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Over Time Min</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Over Time Rs</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>

                {/* Row 5 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Reward</Label>
                  <Input className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Instalment/Loan()</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Basic Salary Cutting</Label>
                  <Input readOnly className="h-9 bg-[#eef1f5] border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Total Cutting</Label>
                  <Input className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>

                {/* Row 6 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Unpaid Holiday</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Paid Holiday</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Penalty</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Half Leave</Label>
                  <Input defaultValue="0" className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>

                {/* Row 7 */}
                <div className="flex flex-col gap-1.5 lg:col-start-4">
                  <Label className="text-[12px] font-bold text-[#555]">Total Salary</Label>
                  <Input className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>

              </div>
              
              <div className="pt-2">
                <Button type="submit" className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 font-semibold h-9 rounded-sm">
                  Submit
                </Button>
              </div>
            </div>

          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
