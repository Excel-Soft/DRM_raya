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

const mockData = [
  {
    id: 1,
    name: "Gulab Akhtar Qadri",
    netSalary: "30000",
    paidLeave: "1",
    earnDays: "26 - 8=18",
    absentDays: "7",
    absentRs: "7000",
    lateMin: "0",
    cuttingMin: "0 - 80 = -80",
    cuttingMinRs: "0",
    perDayRs: "1000",
    totalCutting: "7000",
    totalSalary: "23000",
    monthYear: "5 / 2026",
    month: "current"
  },
  {
    id: 2,
    name: "Zainab Nazim",
    netSalary: "0",
    paidLeave: "1",
    earnDays: "26 - 8=18",
    absentDays: "7",
    absentRs: "0",
    lateMin: "0",
    cuttingMin: "0 - 80 = -80",
    cuttingMinRs: "0",
    perDayRs: "0",
    totalCutting: "0",
    totalSalary: "0",
    monthYear: "5 / 2026",
    month: "current"
  },
  {
    id: 3,
    name: "Atika Riaz",
    netSalary: "30000",
    paidLeave: "0",
    earnDays: "26 - 1=25",
    absentDays: "0",
    absentRs: "0",
    lateMin: "134",
    cuttingMin: "134 - 80 = 54",
    cuttingMinRs: "113",
    perDayRs: "1000",
    totalCutting: "0",
    totalSalary: "30000",
    monthYear: "5 / 2026",
    month: "current"
  },
  {
    id: 4,
    name: "Minahil",
    netSalary: "30000",
    paidLeave: "0",
    earnDays: "26 - 1=25",
    absentDays: "0",
    absentRs: "0",
    lateMin: "112",
    cuttingMin: "112 - 80 = 32",
    cuttingMinRs: "67",
    perDayRs: "1000",
    totalCutting: "0",
    totalSalary: "30000",
    monthYear: "5 / 2026",
    month: "current"
  },
  {
    id: 5,
    name: "Amina Bibi",
    netSalary: "0",
    paidLeave: "1",
    earnDays: "26 - 8=18",
    absentDays: "7",
    absentRs: "0",
    lateMin: "0",
    cuttingMin: "0 - 80 = -80",
    cuttingMinRs: "0",
    perDayRs: "0",
    totalCutting: "0",
    totalSalary: "0",
    monthYear: "5 / 2026",
    month: "current"
  },
  {
    id: 6,
    name: "Muqadas",
    netSalary: "0",
    paidLeave: "1",
    earnDays: "26 - 8=18",
    absentDays: "7",
    absentRs: "0",
    lateMin: "0",
    cuttingMin: "0 - 80 = -80",
    cuttingMinRs: "0",
    perDayRs: "0",
    totalCutting: "0",
    totalSalary: "0",
    monthYear: "5 / 2026",
    month: "current"
  },
  {
    id: 7,
    name: "Nimra Shahzadi",
    netSalary: "30000",
    paidLeave: "0",
    earnDays: "26 - 1=25",
    absentDays: "0",
    absentRs: "0",
    lateMin: "157",
    cuttingMin: "157 - 80 = 77",
    cuttingMinRs: "160",
    perDayRs: "1000",
    totalCutting: "0",
    totalSalary: "30000",
    monthYear: "5 / 2026",
    month: "current"
  },
  {
    id: 8,
    name: "Umay kalsoom",
    netSalary: "35000",
    paidLeave: "0",
    earnDays: "26 - 1=25",
    absentDays: "0",
    absentRs: "0",
    lateMin: "89",
    cuttingMin: "89 - 80 = 9",
    cuttingMinRs: "22",
    perDayRs: "1167",
    totalCutting: "0",
    totalSalary: "35000",
    monthYear: "5 / 2026",
    month: "current"
  },
  // Last Month Data
  {
    id: 9,
    name: "Gulab Akhtar Qadri",
    netSalary: "30000",
    paidLeave: "0",
    earnDays: "26 - 0=26",
    absentDays: "0",
    absentRs: "0",
    lateMin: "45",
    cuttingMin: "45 - 80 = -35",
    cuttingMinRs: "0",
    perDayRs: "1000",
    totalCutting: "0",
    totalSalary: "30000",
    monthYear: "4 / 2026",
    month: "last"
  },
  {
    id: 10,
    name: "Zainab Nazim",
    netSalary: "25000",
    paidLeave: "2",
    earnDays: "26 - 0=26",
    absentDays: "0",
    absentRs: "0",
    lateMin: "10",
    cuttingMin: "10 - 80 = -70",
    cuttingMinRs: "0",
    perDayRs: "833",
    totalCutting: "0",
    totalSalary: "25000",
    monthYear: "4 / 2026",
    month: "last"
  }
];

export default function EditAtt() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"last" | "current">("current");
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);

  const filteredData = mockData.filter(item => 
    item.month === activeTab && 
    (item.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-[17px] font-bold text-[#555] uppercase flex items-center gap-2">
            ATTENDANCE REPORT
          </h1>
        </div>

        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">
            
            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                    activeTab === "last" 
                      ? "bg-[#e8f5e9] text-[#00a65a]" 
                      : "bg-[#eef1f5] text-slate-600 hover:bg-[#e8f5e9] hover:text-[#00a65a]"
                  }`}
                  onClick={() => setActiveTab("last")}
                >
                  Last Month
                </button>
                <button
                  className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                    activeTab === "current" 
                      ? "bg-[#e8f5e9] text-[#00a65a]" 
                      : "bg-[#eef1f5] text-slate-600 hover:bg-[#e8f5e9] hover:text-[#00a65a]"
                  }`}
                  onClick={() => setActiveTab("current")}
                >
                  Current Month
                </button>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2">
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
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#fdf3db]">
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
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                        No data available in table
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item, idx) => (
                      <TableRow key={idx} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
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
                            className="text-[#555] hover:text-[#00a65a] transition-colors bg-transparent border-none cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-[1200px] w-[95vw] p-0 gap-0 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit Attendance/Salary</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            toast({
              title: "Success",
              description: "Attendance details have been saved successfully.",
            });
            setEditItem(null);
          }} className="p-6 bg-[#f8f9fa] space-y-6">
            
            <div className="space-y-4">
              <h3 className="text-[15px] font-bold text-[#555]">Employee Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 bg-white p-6 border border-slate-100 rounded-sm">
                
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Name</Label>
                  <Input readOnly defaultValue={editItem?.name || ""} className="h-9 bg-[#eef1f5] border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Net Salary</Label>
                  <Input defaultValue={editItem?.netSalary || ""} className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Paid Leave</Label>
                  <Input defaultValue={editItem?.paidLeave || ""} className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-bold text-[#555]">Earn Days</Label>
                  <Input defaultValue={editItem?.earnDays || ""} className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0" />
                </div>
              </div>
              <div className="pt-2">
                <Button type="submit" className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 font-semibold h-9 rounded-sm">
                  Save Changes
                </Button>
              </div>
            </div>

          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
