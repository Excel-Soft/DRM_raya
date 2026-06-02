import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function ItBackup() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: backups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/it/backups"],
  });

  const backupsList = Array.isArray(backups) ? backups : []; const filteredBackups = backupsList.filter(b => 
    (b.domainName || b.domain || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen dark:bg-zinc-950">
      <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase dark:text-zinc-100">Domain Backup</h1>

      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-900 dark:bg-zinc-900">
        <CardContent className="p-6 dark:bg-zinc-900">
          <div className="mb-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 h-10 px-6 transition-all shadow-md hover:shadow-lg">
                  <Plus className="h-4 w-4" /> Add New Backup
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 border-b bg-white dark:bg-zinc-900 flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900">
                  <DialogTitle className="text-xl font-bold text-slate-700 uppercase tracking-tight dark:text-zinc-400">Add Backup Record</DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-6 bg-white dark:bg-zinc-900 dark:bg-zinc-900">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Domain:</label>
                       <Input placeholder="Domain name" className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Web Type:</label>
                       <Select>
                        <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                          <SelectValue placeholder="Choose..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full Site</SelectItem>
                          <SelectItem value="database">Database Only</SelectItem>
                          <SelectItem value="files">Files Only</SelectItem>
                        </SelectContent>
                       </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Backup Destination / URL:</label>
                    <Input placeholder="Storage location or URL" className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Detail / Notes:</label>
                    <Textarea className="min-h-[120px] bg-slate-50/50 border-slate-200 resize-none dark:border-zinc-800" placeholder="Enter backup details..." />
                  </div>
                </div>
                <DialogFooter className="p-6 bg-slate-50/50 flex flex-row justify-end gap-3 border-t">
                  <Button variant="ghost" className="bg-white dark:bg-zinc-900 border text-slate-700 hover:bg-slate-100 px-8 h-11 font-bold dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400">Close</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-11 font-bold shadow-sm">Save Backup</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium dark:text-zinc-400">Show</span>
              <Select defaultValue="10">
                <SelectTrigger className="w-20 h-9 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500 font-medium dark:text-zinc-400">entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium dark:text-zinc-400">Search:</span>
              <Input 
                className="h-9 w-64 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" 
                placeholder="Find by domain..."
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm dark:border-zinc-800">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 w-16 dark:text-zinc-400">No#</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Domain Name</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Backup Type</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Storage URL</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Description</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Backup Date</TableHead>
                  <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBackups.map((item: any, idx: number) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors border-slate-50 dark:border-zinc-800">
                    <TableCell className="text-slate-500 font-bold dark:text-zinc-400">{idx + 1}</TableCell>
                    <TableCell className="font-bold text-slate-800 dark:text-zinc-100">{item.domainName || item.domain || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${item.type === 'Full' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'} font-bold`}>
                        {item.type || "Full"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-emerald-600 font-semibold">{item.location || item.url || "N/A"}</TableCell>
                    <TableCell className="text-slate-500 text-xs italic max-w-[200px] truncate dark:text-zinc-400">{item.notes || item.detail || "No details provided"}</TableCell>
                    <TableCell className="text-slate-600 font-medium text-sm dark:text-zinc-300">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="destructive" className="h-8 w-8 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border-none transition-all rounded-full shadow-sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBackups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 text-slate-200" />
                        <p className="font-medium">No backup records available</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

           <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium dark:text-zinc-400">Showing {filteredBackups.length} entries</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="font-bold" disabled>Previous</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold px-4">1</Button>
              <Button variant="outline" size="sm" className="font-bold" disabled>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
