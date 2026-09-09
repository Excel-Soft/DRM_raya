import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Eraser, 
  RefreshCw, 
  Search, 
  List
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";

interface PendingBvRow {
  srNo: number;
  memberId: string;
  companyId: string;
  companyName: string;
  persons: string;
  type: string;
  userBvDate: string;
  bvDate: string;
  abPayDate: string;
  startDate: string;
}

// This report does not yet have a backend data source. Until one is wired in it
// renders an honest empty state rather than fabricated rows.
const REPORT_DATA: PendingBvRow[] = [];

export default function ReportsBvPendingRc() {
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      const data = await res.json();
      return data.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    allUsers.forEach((user) => {
      const role = user.role || 'Unassigned Role';
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(user);
    });
    return Object.entries(grouped)
      .map(([role, users]) => ({ role, users }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [allUsers]);

  const [user, setUser] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchText, setSearchText] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    user: "all",
    startDate: "",
    endDate: "",
    searchText: ""
  });

  const clearFilters = () => {
    setUser("all");
    setStartDate("");
    setEndDate("");
    setSearchText("");
    setAppliedFilters({
      user: "all",
      startDate: "",
      endDate: "",
      searchText: ""
    });
  };

  const handleSearch = () => {
    setAppliedFilters({
      user,
      startDate,
      endDate,
      searchText
    });
  };

  const handleLoadAll = () => {
    clearFilters();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const displayedData = useMemo(() => {
    return REPORT_DATA.filter((row) => {
      if (appliedFilters.searchText) {
        const q = appliedFilters.searchText.toLowerCase();
        if (
          !row.companyName.toLowerCase().includes(q) &&
          !row.companyId.toLowerCase().includes(q) &&
          !row.memberId.toLowerCase().includes(q) &&
          !row.persons.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      
      if (appliedFilters.startDate) {
        const rowDate = row.startDate || row.bvDate || row.userBvDate;
        if (rowDate && new Date(rowDate) < new Date(appliedFilters.startDate)) {
          return false;
        }
      }
      
      if (appliedFilters.endDate) {
        const rowDate = row.startDate || row.bvDate || row.userBvDate;
        if (rowDate && new Date(rowDate) > new Date(appliedFilters.endDate)) {
          return false;
        }
      }
      
      if (appliedFilters.user !== "all") {
        const selectedUserObj = allUsers.find(u => u.id === appliedFilters.user);
        if (selectedUserObj) {
          const nameToMatch = selectedUserObj.fullName || selectedUserObj.name || selectedUserObj.username || "";
          if (!row.persons.toLowerCase().includes(nameToMatch.toLowerCase())) {
            return false;
          }
        } else {
          // If for some reason user not found, hide it
          return false;
        }
      }
      
      return true;
    });
  }, [appliedFilters, allUsers]);

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900 min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-[17px] font-bold text-[#5e5e5e] dark:text-zinc-300 uppercase tracking-wide">
            PENDING BV REPORT
          </h1>
          <div className="flex gap-2">
            <Button onClick={clearFilters} className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-8 text-xs font-semibold px-3 opacity-90 hover:opacity-100 rounded">
              <Eraser className="h-3 w-3 mr-1.5" />
              Clear Filters
            </Button>
            <Button onClick={handleRefresh} className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-8 text-xs font-semibold px-3 opacity-90 hover:opacity-100 rounded">
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-md border-t-[3px] border-t-[#d2d6de] shadow-sm mb-6">
          <div className="border-b border-slate-100 dark:border-zinc-800 p-3 px-4">
            <div className="flex items-center gap-2 text-[#444] dark:text-zinc-300 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-funnel-fill text-[#5e5e5e] dark:text-zinc-300" viewBox="0 0 16 16">
                <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z"/>
              </svg>
              <h2 className="text-[15px] font-medium">Search & Filter Options</h2>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Select User</label>
                <Select value={user} onValueChange={setUser}>
                  <SelectTrigger className="w-full bg-white dark:bg-zinc-900 h-[34px] border-[#d2d6de] text-slate-500 text-[13px]">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="choose" disabled className="text-slate-400">Choose...</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                    {groupedUsers.map((group) => (
                      <SelectGroup key={group.role}>
                        <SelectLabel className="font-bold text-slate-700 py-1.5 px-2 text-[13px] bg-slate-50">{group.role}</SelectLabel>
                        {group.users.map((u) => (
                          <SelectItem key={u.id} value={u.id} className="pl-6 text-[13px] text-slate-600">
                            {u.fullName || u.name || u.username}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Start Date</label>
                <div className="relative">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white dark:bg-zinc-900 h-[34px] border-[#d2d6de] text-slate-500 text-[13px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">End Date</label>
                <div className="relative">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white dark:bg-zinc-900 h-[34px] border-[#d2d6de] text-slate-500 text-[13px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Search Text</label>
                <Input placeholder="Company ID/Name/Member ID.." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full bg-white dark:bg-zinc-900 h-[34px] border-[#d2d6de] text-[13px] placeholder:text-slate-400" />
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Button onClick={handleSearch} className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-[34px] text-[13px] font-semibold px-4 rounded-sm shadow-sm">
                <Search className="h-3.5 w-3.5 mr-2 font-bold" />
                Search with Filters
              </Button>
              <Button onClick={handleLoadAll} variant="outline" className="bg-white dark:bg-zinc-900 border-[#d2d6de] text-[#444] dark:text-zinc-300 hover:bg-slate-50 h-[34px] text-[13px] font-semibold px-4 rounded-sm shadow-sm">
                <List className="h-3.5 w-3.5 mr-2" />
                Load All Records
              </Button>
            </div>
            
            <div className="text-[12px] text-[#737373] dark:text-zinc-400 mt-4 flex items-start gap-1.5 leading-snug font-medium">
              <div className="mt-[2px] shrink-0 bg-[#737373] text-white rounded-full h-[13px] w-[13px] flex items-center justify-center font-bold text-[9px]">i</div>
              Select user and set date ranges to filter records. Search works on Company ID, Company Name, Member ID, and User Name.
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-md border-t-[3px] border-t-[#d2d6de] shadow-sm">
          <div className="border-b border-slate-100 dark:border-zinc-800 p-3 px-4">
            <div className="flex items-center gap-2 text-[#444] dark:text-zinc-300 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-graph-up text-[#5e5e5e] dark:text-zinc-300" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M0 0h1v15h15v1H0V0Zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07Z"/>
              </svg>
              <h2 className="text-[15px] font-medium">Post View - Pending BV Records</h2>
            </div>
          </div>
          
          <div className="bg-[#e9ecef] dark:bg-zinc-900 p-2.5 px-4 flex justify-between text-[13px] font-semibold text-[#555] dark:text-zinc-300 border-b border-[#dee2e6] dark:border-zinc-800">
            <div>Total Records: {REPORT_DATA.length}</div>
            <div>Filtered Results: {displayedData.length}</div>
            <div>Active Filter: {Object.values(appliedFilters).some(v => v !== "" && v !== "all") ? "Yes" : "None"}</div>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-[13px] border border-[#dee2e6] dark:border-zinc-800">
              <thead className="bg-[#f8f9fa] dark:bg-zinc-900 border-b border-[#dee2e6] dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">Sr. No</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">Member ID</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">Company ID</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">Company Name</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">Persons</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">Type</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">User BV Date</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">BV Date</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap border-r border-[#dee2e6] dark:border-zinc-800">AB Pay Date</th>
                  <th className="py-2.5 px-3 text-left font-bold text-[#555] dark:text-zinc-300 whitespace-nowrap">Start Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dee2e6] dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {displayedData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">No pending BV records to display. This report is not yet connected to a live data source.</td>
                  </tr>
                ) : (
                  displayedData.map((row, index) => (
                    <tr key={row.srNo} className="hover:bg-[#f5f5f5] dark:hover:bg-zinc-800 transition-colors">
                      <td className="py-2 px-3 text-[#555] dark:text-zinc-300 border-r border-[#dee2e6] dark:border-zinc-800">{index + 1}</td>
                      <td className="py-2 px-3 font-bold text-[#555] dark:text-zinc-300 border-r border-[#dee2e6] dark:border-zinc-800">{row.memberId}</td>
                      <td className="py-2 px-3 text-[#555] dark:text-zinc-300 border-r border-[#dee2e6] dark:border-zinc-800">{row.companyId}</td>
                      <td className="py-2 px-3 text-[#555] dark:text-zinc-300 uppercase text-xs border-r border-[#dee2e6] dark:border-zinc-800">{row.companyName}</td>
                      <td className="py-2 px-3 border-r border-[#dee2e6] dark:border-zinc-800">
                        <span className="bg-[#3c8dbc] text-white px-2 py-[2px] rounded text-[11px] font-bold whitespace-nowrap shadow-sm">
                          {row.persons}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-[#dee2e6] dark:border-zinc-800">
                        <span className="bg-[#00a65a] text-white px-2 py-[2px] rounded text-[11px] font-bold shadow-sm">
                          {row.type}
                        </span>
                      </td>
                      <td className="py-1 px-1.5 border-r border-[#dee2e6] dark:border-zinc-800">
                        <Input type="date" defaultValue={row.userBvDate} className="h-8 min-w-[130px] text-xs font-semibold rounded-sm border-[#d2d6de]" />
                      </td>
                      <td className="py-1 px-1.5 border-r border-[#dee2e6] dark:border-zinc-800">
                        <Input type="date" defaultValue={row.bvDate} className="h-8 min-w-[130px] text-xs font-semibold rounded-sm border-[#d2d6de]" />
                      </td>
                      <td className="py-1 px-1.5 border-r border-[#dee2e6] dark:border-zinc-800">
                        <Input type="date" defaultValue={row.abPayDate} className="h-8 min-w-[130px] text-xs font-semibold rounded-sm border-[#d2d6de]" />
                      </td>
                      <td className="py-1 px-1.5">
                        <Input type="date" defaultValue={row.startDate} className="h-8 min-w-[130px] text-xs font-semibold rounded-sm border-[#d2d6de]" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
