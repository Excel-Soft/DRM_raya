import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Trash2 } from "lucide-react";

const mockData = [
  { id: "7906", attId: "0", name: "Home Guard(h)", grossSalary: "30000", totalSalary: "30000" },
  { id: "7907", attId: "0", name: "Shahid Cook(H)", grossSalary: "55000", totalSalary: "55000" },
  { id: "7909", attId: "116", name: "Zubair (H)", grossSalary: "49000", totalSalary: "49000" },
];

export default function SalaryReport() {
  const [activeTab, setActiveTab] = useState("Male");
  const [search, setSearch] = useState("");
  const [showViewReport, setShowViewReport] = useState(false);
  const [showViewMonthWise, setShowViewMonthWise] = useState(false);

  const tabs = [
    "Male", "Female", "Both Male & Female", "Only Salary", 
    "Only Salary Lahore", "Donations", "Penalty", "Monthly Head"
  ];

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-4">
          <h1 className="text-[17px] font-bold text-[#555] uppercase flex items-center gap-2">
            SALARY REPORT <span className="text-[#00a65a]">/</span>
            <button 
              onClick={() => setShowViewReport(!showViewReport)}
              className="bg-transparent border-none p-0 cursor-pointer text-[#00a65a] hover:text-[#008d4c]"
            >
              VIEW REPORT
            </button> 
            <span className="text-[#00a65a]">/</span>
            <button 
              onClick={() => setShowViewMonthWise(!showViewMonthWise)}
              className="bg-transparent border-none p-0 cursor-pointer text-[#00a65a] hover:text-[#008d4c]"
            >
              VIEW MONTH WISE
            </button>
          </h1>
          <div>
            <Button 
              onClick={() => window.print()}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-semibold rounded-sm h-9"
            >
              Print Slip
            </Button>
          </div>
        </div>

        {/* Filter Card 1 (View Report) */}
        {showViewReport && (
          <Card className="border-none shadow-sm bg-white rounded-sm">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-[#555] font-semibold">Select</Label>
                    <div className="flex items-center gap-1.5">
                      <Checkbox id="commission" className="h-3.5 w-3.5" />
                      <label htmlFor="commission" className="text-xs text-[#555] cursor-pointer">
                        Add Commission
                      </label>
                    </div>
                  </div>
                  <Select>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-xs text-[#555] rounded-sm focus:ring-0">
                      <SelectValue placeholder="Choose .." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opt1">Option 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-[#555] font-semibold">start:</Label>
                  <Select>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-xs text-[#555] rounded-sm focus:ring-0">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opt1">Option 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-[#555] font-semibold">End:</Label>
                  <Select>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-xs text-[#555] rounded-sm focus:ring-0">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opt1">Option 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 rounded-sm">
                View
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filter Card 2 (View Month Wise) */}
        {showViewMonthWise && (
          <Card className="border-none shadow-sm bg-white rounded-sm">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-[#555] font-semibold">Start</Label>
                  <Input type="date" className="h-9 bg-white border-slate-200 text-xs text-[#555] rounded-sm focus-visible:ring-0" />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-[#555] font-semibold">End:</Label>
                  <Input type="date" className="h-9 bg-white border-slate-200 text-xs text-[#555] rounded-sm focus-visible:ring-0" />
                </div>
              </div>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 rounded-sm">
                View
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6 space-y-6">
            
            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-[13px] font-semibold transition-colors rounded-sm ${
                    activeTab === tab
                      ? "bg-[#00a65a] text-white"
                      : "bg-transparent text-[#555] hover:bg-slate-50"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Table Toolbars */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center rounded-sm overflow-hidden border border-slate-500">
                {["Copy", "Excel", "PDF", "Column visibility"].map((btn, i) => (
                  <button key={i} className="bg-[#798096] hover:bg-[#6c7285] text-white px-4 py-2 text-xs font-semibold border-r border-[#6c7285] last:border-0 transition-colors">
                    {btn}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Label className="text-xs text-[#555] font-semibold">Search:</Label>
                <Input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[200px] h-8 bg-white border-slate-300 rounded-sm text-xs focus-visible:ring-0 focus-visible:border-slate-400"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#e0f3e8]">
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">#</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Att ID</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Name</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Gross Salary</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">VAS</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">3 % Bonus</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">AB Bonus</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Project Bonus</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">PPP Bonus</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">PP<br/>Bonus</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">OT<br/>RS</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Reward</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Leaves Rupees</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Cp<br/>Leave</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Cup Leave</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Total Cutting</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Total Salary</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-center text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {mockData.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.id.includes(search)).map((item, idx) => (
                    <TableRow key={idx} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                      <TableCell className="py-3 px-2 text-[#555] font-semibold">{item.id}</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">{item.attId}</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">{item.name}</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">{item.grossSalary}</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">0</TableCell>
                      <TableCell className="py-3 px-2 text-[#555]">{item.totalSalary}</TableCell>
                      <TableCell className="py-3 px-2 text-center">
                        <button className="text-red-500 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
