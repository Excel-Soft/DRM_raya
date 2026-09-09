import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { 
  Users, 
  Calendar, 
  Download, 
  Search,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";
import type { UserActivity } from "@shared/schema";

const DEPARTMENTS = ["Sales", "Marketing", "Operations", "Finance", "HR", "IT", "Support"];
const ACTION_TYPES = ["GM", "Invoice", "Refund", "Donation", "Expense", "VAS", "Cheque", "Customer", "Project", "Task"];

const getActionBadgeColor = (actionType: string) => {
  const colors: Record<string, string> = {
    GM: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    Invoice: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    Refund: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    Donation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    Expense: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    VAS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    Cheque: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
    Customer: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
    Project: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
    Task: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  };
  return colors[actionType] || "bg-gray-100 text-gray-800";
};

interface ReportResponse {
  data: UserActivity[];
  total: number;
  page: number;
  pageSize: number;
}

export default function UserReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterActionType, setFilterActionType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const queryParams = new URLSearchParams();
  queryParams.set("page", currentPage.toString());
  queryParams.set("pageSize", pageSize.toString());
  if (startDate) queryParams.set("from", startDate);
  if (endDate) queryParams.set("to", endDate);
  if (searchQuery) queryParams.set("search", searchQuery);
  if (filterDepartment) queryParams.set("department", filterDepartment);
  if (filterActionType) queryParams.set("actionType", filterActionType);

  const { data: reportData, isLoading } = useQuery<ReportResponse>({
    queryKey: ["/api/reports/user-activities", startDate, endDate, searchQuery, filterDepartment, filterActionType, currentPage],
    queryFn: () => fetch(`/api/reports/user-activities?${queryParams}`).then(r => r.json()),
  });

  const activities = reportData?.data || [];
  const total = reportData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("from", startDate);
    if (endDate) params.set("to", endDate);
    if (searchQuery) params.set("search", searchQuery);
    
    const url = `/api/reports/user-activities/export-csv?${params}`;
    window.open(url, "_blank");
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const formatCurrency = (amount: string | null, currency = "PKR") => {
    if (!amount) return "-";
    const num = parseFloat(amount) || 0;
    return `${currency} ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setFilterDepartment("");
    setFilterActionType("");
    setCurrentPage(1);
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">User Activity Report</h1>
            <p className="text-muted-foreground">Track user activities across the system</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-6">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={filterDepartment || "all"} onValueChange={(val) => setFilterDepartment(val === "all" ? "" : val)}>
                  <SelectTrigger data-testid="select-department">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select value={filterActionType || "all"} onValueChange={(val) => setFilterActionType(val === "all" ? "" : val)}>
                  <SelectTrigger data-testid="select-action-type">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="User name, company..."
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <Badge variant="outline">{total} records</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No activities found</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">No#</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Action Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.map((activity, index) => (
                        <TableRow 
                          key={activity.id} 
                          className={index % 2 === 0 ? "bg-muted/30" : ""}
                          data-testid={`row-activity-${activity.id}`}
                        >
                          <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                          <TableCell className="font-medium">{activity.userName}</TableCell>
                          <TableCell>{activity.department}</TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(activity.actionType)}>
                              {activity.actionType}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {activity.actionDescription || "-"}
                          </TableCell>
                          <TableCell>{activity.companyName || "-"}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(activity.amount, activity.currency || "PKR")}
                          </TableCell>
                          <TableCell>{formatDate(activity.activityDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
