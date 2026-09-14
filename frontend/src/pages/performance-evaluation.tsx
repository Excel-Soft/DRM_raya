import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export default function PerformanceEvaluation() {
  const [userId, setUserId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(format(subMonths(new Date(), 0), "yyyy-MM-01"));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  // Need a state to trigger fetch on View click
  const [queryParams, setQueryParams] = useState({ userId: "all", startDate, endDate });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/users");
        if (res.ok) {
           return await res.json();
        }
      } catch (e) {
        console.error(e);
      }
      return [];
    },
  });

  const { data: performanceData, isLoading, refetch } = useQuery({
    queryKey: ["/api/sales/performance-evaluation", queryParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/performance-evaluation?userId=${queryParams.userId}&startDate=${queryParams.startDate}&endDate=${queryParams.endDate}`);
      return await res.json();
    },
    enabled: !!queryParams.startDate && !!queryParams.endDate,
  });

  const handleView = () => {
    setQueryParams({ userId, startDate, endDate });
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">PERFORMANCE SYSTEM</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team</SelectItem>
                  {usersData?.map((user: any) => (
                    <SelectItem key={user.userId || user.id} value={user.userId || user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
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
            <div>
              <Button onClick={handleView} className="w-full bg-emerald-600 hover:bg-emerald-700">View</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance View</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !performanceData ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No data.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                {performanceData.mode === "all" ? (
                  <>
                    <TableHeader className="bg-emerald-50">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Total Time</TableHead>
                        <TableHead>Task Time</TableHead>
                        <TableHead>Spent Time</TableHead>
                        <TableHead>Free Time</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performanceData.data?.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell><b>Total(8 Hour/Day:{row.totalDays})</b></TableCell>
                          <TableCell><b>8 Hours * {row.totalDays} Days = {row.workingHours} Hours</b></TableCell>
                          <TableCell><b>{row.taskTimeMins}m</b></TableCell>
                          <TableCell><b>{row.spentMins}m</b></TableCell>
                          <TableCell><b>{row.freeTimeMins}m</b></TableCell>
                          <TableCell><b>{performanceData.startDate} To {performanceData.endDate}</b></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                ) : (
                  <>
                    <TableHeader className="bg-emerald-50">
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Date</TableHead>
                        {performanceData.headers?.map((h: any, i: number) => (
                          <TableHead key={i}>{h.method}({h.target})</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performanceData.rows?.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          {performanceData.headers?.map((h: any, j: number) => {
                             const methodKey = (h.method || "").toLowerCase();
                             const cellData = row.metrics[methodKey];
                             if (!cellData) {
                               return <TableCell key={j}></TableCell>;
                             }
                             
                             return (
                               <TableCell key={j}>
                                 {cellData.count} &nbsp;&nbsp; 
                                 {h.timeMultiplier ? `(T-${cellData.count * h.timeMultiplier})` : ""}
                               </TableCell>
                             );
                          })}
                        </TableRow>
                      ))}
                      
                      {/* Footer Row */}
                      {performanceData.totals && (
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell></TableCell>
                          <TableCell>Working Hour(8 * {performanceData.totals.totalDays})={performanceData.totals.workingHours}</TableCell>
                          <TableCell colSpan={performanceData.headers?.length ? Math.max(1, Math.floor(performanceData.headers.length / 3)) : 1}>
                             8 Hour (480 Min)
                          </TableCell>
                          <TableCell colSpan={performanceData.headers?.length ? Math.max(1, Math.floor(performanceData.headers.length / 3)) : 1}>
                             Spent Time ({performanceData.totals.spentMins}m / {Math.floor(performanceData.totals.spentMins / 60)}h)
                          </TableCell>
                          <TableCell colSpan={performanceData.headers?.length ? Math.max(1, Math.ceil(performanceData.headers.length / 3)) : 1}>
                             Total Time ({Math.floor(performanceData.totals.spentMins / 60)}:{performanceData.totals.spentMins % 60})
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
