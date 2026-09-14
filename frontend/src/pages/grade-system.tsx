import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

type UserOption = {
  id: string;
  name: string;
};

type GradeReportItem = {
  no: number;
  id: string;
  company: string;
  grade: string;
  person: string;
  salePerson: string;
  comm: string;
  follow: string;
};

const GRADE_OPTIONS = ["All", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"];

export default function GradeSystem() {
  const defaultStartDate = new Date();
  defaultStartDate.setDate(1);
  const defaultEndDate = new Date();

  const [userId, setUserId] = useState("All");
  const [grade, setGrade] = useState("All");
  const [startDate, setStartDate] = useState(format(defaultStartDate, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(defaultEndDate, "yyyy-MM-dd"));

  const [queryParams, setQueryParams] = useState({ userId: "All", grade: "All", startDate, endDate });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/reports/grade-system/users"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/reports/grade-system/users");
        if (res.ok) {
           return await res.json();
        }
        return [];
      } catch (e) {
        console.error(e);
        return [];
      }
    }
  });

  const { data: reportData, isLoading: isLoadingReport, isError } = useQuery({
    queryKey: ["/api/reports/grade-system", queryParams],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          userId: queryParams.userId,
          grade: queryParams.grade,
          startDate: queryParams.startDate,
          endDate: queryParams.endDate
        });
        const res = await apiRequest("GET", `/api/reports/grade-system?${params.toString()}`);
        if (res.ok) {
            return await res.json() as GradeReportItem[];
        }
        return [];
      } catch (e) {
        console.error(e);
        return [];
      }
    }
  });

  const handleView = (e: React.FormEvent) => {
    e.preventDefault();
    setQueryParams({ userId, grade, startDate, endDate });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-xl font-bold uppercase text-gray-800 dark:text-gray-100 tracking-wider">
          Grade System
        </h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleView} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
            
            <div className="space-y-2">
              <Label htmlFor="userId">Select User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="userId">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {isLoadingUsers ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    usersData?.map((u: UserOption) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gradeFilter">Select Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger id="gradeFilter">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 pb-0.5">
              <Button type="submit" className="w-full bg-[#1e9960] hover:bg-[#15794a] text-white">
                View
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-[13px] font-bold uppercase text-gray-700 tracking-wider">
            View Grade List
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            {isLoadingReport ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : isError ? (
              <div className="text-center p-8 text-red-500">Failed to load data.</div>
            ) : reportData?.length === 0 ? (
              <div className="text-center p-8 text-gray-500">No records found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1e9960]/20 hover:bg-[#1e9960]/20">
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">#</TableHead>
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">Id</TableHead>
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">Company</TableHead>
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">Grade</TableHead>
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">Person</TableHead>
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">Sale Person</TableHead>
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">Comm</TableHead>
                    <TableHead className="font-bold text-gray-800 dark:text-gray-100">Follow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.map((item: GradeReportItem) => (
                    <TableRow key={`${item.id}-${item.no}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell className="font-medium">{item.no}</TableCell>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.company}</TableCell>
                      <TableCell>{item.grade}</TableCell>
                      <TableCell>{item.person}</TableCell>
                      <TableCell>{item.salePerson}</TableCell>
                      <TableCell className="max-w-xs truncate" title={item.comm}>{item.comm}</TableCell>
                      <TableCell>{item.follow ? format(new Date(item.follow), "yyyy-MM-dd HH:mm:ss") : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
