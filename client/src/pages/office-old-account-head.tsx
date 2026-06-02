import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, FileText } from "lucide-react";
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

export default function OfficeOldAccountHead() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSearch = () => {
    console.log("Searching old account records...");
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-zinc-950 min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Old Account Head
          </h1>
        </div>

        <Card className="border-none shadow-sm shadow-slate-200 dark:shadow-none dark:bg-zinc-900">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  End Date
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div>
                <Button 
                  onClick={handleSearch}
                  className="w-full md:w-auto bg-[#00a65a] hover:bg-[#008d4c] text-white transition-colors gap-2 font-medium px-8"
                >
                  <Search className="w-4 h-4" />
                  Search
                </Button>
              </div>
            </div>

            <div className="rounded-md border mt-6 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-zinc-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Date</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Account Head</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Description</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-32">
                      No records found.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
