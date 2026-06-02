import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const usersList = [
  "Zohaib Nisar Ahmad",
  "Faiza Khalid",
  "Hina Arij",
  "Waqas Ahmed",
  "Amir Nafees",
  "M. Arslan Janjua",
  "19-10-2023" // from screenshot data
];

export default function KwaHistory() {
  const { toast } = useToast();
  
  const { data: kwaData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-records"],
  });

  // Filter States
  const [selectedUser, setSelectedUser] = useState("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFiltered, setIsFiltered] = useState(false);

  // Derive displayed data
  const displayedData = (() => {
    if (!isFiltered) return kwaData;
    
    let filtered = [...kwaData];
    if (selectedUser !== "none") {
      filtered = filtered.filter(item => item.employee === selectedUser);
    }
    // Simulate date filtering if needed in frontend
    return filtered;
  })();

  const handleView = () => {
    setIsFiltered(true);
    if (displayedData.length === 0) {
      toast({ title: "No records found for these filters", variant: "destructive" });
    }
  };

  const handleViewAllData = () => {
    setSelectedUser("none");
    setStartDate("");
    setEndDate("");
    setIsFiltered(false);
    toast({ title: "Filters reset. Showing all data." });
  };

  return (
    <div className="p-6">
      <div className="mb-6 font-bold text-lg uppercase text-gray-700 dark:text-zinc-400">
        KWA HISTORY
      </div>

      <Card className="mb-6 border rounded-sm shadow-sm bg-white dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div>
              <label className="block text-sm mb-2 text-gray-700 font-medium dark:text-zinc-400">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-10 border-gray-300 dark:border-zinc-800">
                  <SelectValue placeholder="Choose ..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose ...</SelectItem>
                  {usersList.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm mb-2 text-gray-700 font-medium dark:text-zinc-400">Start Date</label>
              <div className="relative">
                <Input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 border-gray-300 dark:border-zinc-800" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700 font-medium dark:text-zinc-400">End Date</label>
              <div className="relative">
                <Input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 border-gray-300 dark:border-zinc-800" 
                />
              </div>
            </div>

            <div>
              <Button 
                className="bg-[#00a65a] hover:bg-[#008d4c] px-8 h-10 w-full md:w-auto"
                onClick={handleView}
              >
                View
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <Button 
              variant="secondary" 
              className="bg-[#78829d] hover:bg-[#5e667b] text-white"
              onClick={handleViewAllData}
            >
              View All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border rounded-sm shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex justify-between items-center bg-white dark:bg-zinc-900">
            <div className="flex flex-col space-y-2">
              <span className="text-sm text-gray-600 dark:text-zinc-300">Show</span>
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-zinc-300">
                <Select defaultValue="10">
                  <SelectTrigger className="w-[70px] h-8 border-gray-300 dark:border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>entries</span>
              </div>
            </div>
            <div className="flex flex-col space-y-2 text-right">
              <span className="text-sm text-gray-600 dark:text-zinc-300">Search:</span>
              <Input className="h-8 w-48 border-gray-300 dark:border-zinc-800" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#f3f4f6] dark:bg-zinc-900">
                <TableRow className="hover:bg-[#f3f4f6] dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-gray-700 w-16 dark:text-zinc-400">#</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Company</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Person</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Pay</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Remaining</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Detail</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gray-500 dark:text-zinc-400">Loading live data...</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {displayedData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.id}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.company}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.employee}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.kwa}$</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.remaining}$</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.detail}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{new Date(row.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '')}</TableCell>
                      </TableRow>
                    ))}
                    {displayedData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-gray-500 dark:text-zinc-400">No records found matching your filters.</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 bg-white dark:bg-zinc-900 dark:text-zinc-300">
            <div>Showing 1 to {displayedData.length} of {displayedData.length} entries</div>
            <div className="flex space-x-1">
              <Button variant="outline" className="h-8 px-3 text-gray-500 border-gray-300 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
              <Button variant="default" className="h-8 w-8 p-0 bg-[#00a65a] hover:bg-[#008d4c]">1</Button>
              <Button variant="outline" className="h-8 px-3 border-gray-300 text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
