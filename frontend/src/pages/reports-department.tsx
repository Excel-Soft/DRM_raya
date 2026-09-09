import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";

const departments = [
  "Sales Department",
  "Admin",
  "Service Department",
  "Reception Department",
  "Project Department",
  "SEO/SMM Department",
  "Product Posting",
  "D&D Department",
  "Internship & Trainee",
  "Accounts Department",
  "IT Department",
  "Other",
  "Web Excels",
  "R&D",
  "WELC",
  "Deactive",
  "Lead Department",
  "QA Department",
  "Complaint Department",
  "Marketing Department",
  "Media Department",
  "Head of Department",
  "Software Department",
  "Trade Assurance",
  "Super HOD",
  "Verification Department"
];

const cities = [
  "All",
  "Sialkot",
  "Lahore",
  "Karachi",
  "Lahore-Raya",
  "Lahore-GulBerg",
  "Sialkot-Welc",
  "Sialkot-Webexcels",
  "Gujranwala branch"
];

const statuses = [
  "Project Create",
  "Data Verify",
  "Manager Complete",
  "Qa Completed",
  "Verification Completed",
  "Verification Pending"
];

type DeptRow = {
  id: string;
  company_name: string | null;
  package_type: string | null;
  status: string | null;
  entry_type: string | null;
  amount_usd: string | null;
  amount_pkr: string | null;
  payment_status: string | null;
  created_at: string | null;
  approved_at: string | null;
  department: string | null;
};

type DeptResponse = {
  rows: DeptRow[];
  total: number;
  page: number;
  pageSize: number;
};

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export default function DepartmentReport() {
  const { toast } = useToast();
  const [deptSearch, setDeptSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<{ dept: string; status: string; start: string; end: string } | null>(null);

  const filteredDepts = departments.filter(d => d.toLowerCase().includes(deptSearch.toLowerCase()));
  const filteredCities = cities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));
  const filteredStatuses = statuses.filter(s => s.toLowerCase().includes(statusSearch.toLowerCase()));

  const query = useQuery<DeptResponse>({
    queryKey: ["/api/reports/department", applied?.dept, applied?.status, applied?.start, applied?.end],
    enabled: !!applied,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (applied?.dept) params.set("department", applied.dept);
      if (applied?.status) params.set("status", applied.status);
      if (applied?.start) params.set("startDate", applied.start);
      if (applied?.end) params.set("endDate", applied.end);
      return apiRequestJson("GET", `/api/reports/department?${params.toString()}`);
    },
  });

  const handleView = () => {
    if (!selectedDept || !selectedCity || !selectedStatus || !startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please select all the fields (Department, City, Status, Start Date, End Date) before clicking View.",
        variant: "destructive"
      });
      return;
    }
    if (startDate > endDate) {
      toast({
        title: "Validation Error",
        description: "Start date must be on or before end date.",
        variant: "destructive"
      });
      return;
    }
    setApplied({ dept: selectedDept, status: selectedStatus, start: startDate, end: endDate });
  };

  const rows = query.data?.rows ?? [];

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-[17px] font-bold text-[#555] uppercase tracking-wide">
          DEPARTMENT PROJECT
        </h1>

        {/* Filter Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">

              {/* Department */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Department</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose ..." />
                  </SelectTrigger>
                  <SelectContent className="p-0">
                    <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                      <Input
                        placeholder="Search department..."
                        value={deptSearch}
                        onChange={(e) => setDeptSearch(e.target.value)}
                        className="h-8 text-xs focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredDepts.map((d, idx) => (
                        <SelectItem key={idx} value={d} className="text-[13px] focus:bg-[#00a65a] focus:text-white cursor-pointer py-2">
                          {d}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* City */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Select City</Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent className="p-0">
                    <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                      <Input
                        placeholder="Search city..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="h-8 text-xs focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredCities.map((c, idx) => (
                        <SelectItem key={idx} value={c} className="text-[13px] focus:bg-[#00a65a] focus:text-white cursor-pointer py-2">
                          {c}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Select Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent className="p-0">
                    <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                      <Input
                        placeholder="Search status..."
                        value={statusSearch}
                        onChange={(e) => setStatusSearch(e.target.value)}
                        className="h-8 text-xs focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredStatuses.map((s, idx) => (
                        <SelectItem key={idx} value={s} className="text-[13px] focus:bg-[#00a65a] focus:text-white cursor-pointer py-2">
                          {s}
                        </SelectItem>
                      ))}
                    </div>
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
              <Button onClick={handleView} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-semibold rounded-sm">
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Table Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm overflow-hidden mt-6">
          <div className="border-b border-slate-100 py-4 px-6 bg-white">
            <h2 className="text-[15px] font-bold text-[#555]">List</h2>
          </div>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b-0 bg-[#d9f2e6] hover:bg-[#d9f2e6]">
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">#</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Company</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Package</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Status</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Type</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Amount</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Method</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Create/verify</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {!applied ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Please select all filters and click 'View' to display the data.
                      </TableCell>
                    </TableRow>
                  ) : query.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : query.isError ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[#d9534f] py-8">
                        Could not load the department report. Please try again.
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No records found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item, idx) => (
                      <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                        <TableCell className="py-4 px-4 text-[#555]">{idx + 1}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555]">{item.company_name || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555]">{item.package_type || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555]">{item.status || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555]">{item.entry_type || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555]">{item.amount_pkr ?? item.amount_usd ?? "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555]">{item.payment_status || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555]">{fmtDate(item.approved_at || item.created_at)}</TableCell>
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
