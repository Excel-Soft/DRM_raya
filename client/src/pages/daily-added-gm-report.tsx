import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";

// Mock data matching the screenshot
const mockData = [
  { id: 4092, userName: "Zill E Huma", companyName: "FOUR STYLE SPORTSWEAR", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-11 16:57:22", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4091, userName: "Ramish Khurram", companyName: "WORKINGDAYS INTERNATIONAL", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-11 16:33:38", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4090, userName: "Zohaib Nisar Ahmad", companyName: "VYNETIC INTERNATIONAL", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-11 15:58:06", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4089, userName: "M.salman", companyName: "MOMENTUM ATHLETICS WEAR", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-11 15:48:12", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4088, userName: "M.salman", companyName: "SAAD BROTHERS", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-11 10:24:46", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4087, userName: "Hareem Tariq", companyName: "GENTRIX APPARELS", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-09 15:51:52", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4086, userName: "M.salman", companyName: "BIEN PRECISA INTERNATIONAL", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-09 15:26:53", renewal: "Renew GM", dateBtn: "enable", status: "Unknown" },
  { id: 4085, userName: "Zill E Huma", companyName: "NIZA GEAR", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-08 17:34:21", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4083, userName: "Fareha", companyName: "BONE LINK IMPLANTS", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-08 17:17:19", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4082, userName: "Rohina Munir", companyName: "NORDBERG TECHNICAL WEARS", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-08 11:24:25", renewal: "New", dateBtn: "enable", status: "Unknown" },
  { id: 4081, userName: "Rohina Munir", companyName: "AZRAQI INTERNATIONAL", userBvDate: "-", bvDate: "Missing", startDate: "-0001-11-30", endDate: "-", lastStartDate: "-", lastExpireDate: "-", createDate: "2026-05-07 16:30:39", renewal: "Renew GM", dateBtn: "enable", status: "Unknown" },
];

export default function DailyAddedGmReport() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredData, setFilteredData] = useState(mockData);

  const handleSearch = () => {
    if (!startDate && !endDate) {
      setFilteredData(mockData);
      return;
    }

    const filtered = mockData.filter((item) => {
      // item.createDate is format "YYYY-MM-DD HH:mm:ss"
      const itemDateStr = item.createDate.split(" ")[0]; // "YYYY-MM-DD"
      
      let matchesStart = true;
      let matchesEnd = true;

      if (startDate) {
        matchesStart = itemDateStr >= startDate;
      }
      if (endDate) {
        matchesEnd = itemDateStr <= endDate;
      }

      return matchesStart && matchesEnd;
    });

    setFilteredData(filtered);
    
    toast({
      title: "Search Completed",
      description: `Found ${filtered.length} records for the selected date range.`,
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        
        {/* Main Card */}
        <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-100">
            <h1 className="text-[17px] font-medium text-[#333]">Daily GM Record</h1>
          </div>

          <div className="p-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row items-end gap-4 mb-6">
              <div className="flex flex-col gap-1 w-full md:w-64">
                <Label className="text-[13px] text-[#555] font-normal">Start Date:</Label>
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
                />
              </div>
              <div className="flex flex-col gap-1 w-full md:w-64">
                <Label className="text-[13px] text-[#555] font-normal">End Date:</Label>
                <Input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
                />
              </div>
              <Button 
                onClick={handleSearch}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6 rounded-[4px] font-medium"
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-[4px]">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-[#2c3b41] hover:bg-[#2c3b41] border-b-0">
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">ID</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">User Name</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Company Name</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">User BV Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">BV Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Start Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">End Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto leading-tight">Last Start<br/>Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto leading-tight">Last Expire<br/>Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Create Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Renewal</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Date BTN</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-slate-500">
                        No records found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item, idx) => (
                      <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                        <TableCell className="py-3 px-4 text-[#555]">{item.id}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.userName}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.companyName}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.userBvDate}</TableCell>
                        <TableCell className="py-3 px-4">
                          {item.bvDate === "Missing" ? (
                            <span className="bg-[#d9534f] text-white px-2 py-0.5 rounded-[3px] text-[11px] font-bold">
                              Missing
                            </span>
                          ) : (
                            <span className="text-[#555]">{item.bvDate}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.startDate}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.endDate}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.lastStartDate}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.lastExpireDate}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555] whitespace-pre-wrap leading-tight">{item.createDate.replace(' ', '\n')}</TableCell>
                        <TableCell className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-[3px] text-[11px] font-bold text-white ${item.renewal === 'New' ? 'bg-[#0073b7]' : 'bg-[#00a65a]'}`}>
                            {item.renewal}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="bg-[#00c0ef] text-white px-2 py-0.5 rounded-[3px] text-[11px] font-bold">
                            {item.dateBtn}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="bg-[#777] text-white px-2 py-0.5 rounded-[3px] text-[11px] font-bold">
                            {item.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
