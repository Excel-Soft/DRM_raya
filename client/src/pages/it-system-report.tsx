import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Database, Search, ShieldCheck, Server, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface SystemReportItem {
  id: string;
  name: string;
  type: string;
  ip: string;
  status: string;
  lastBackup: string | null;
  expiryDate: string | null;
  serverUrl: string;
}

export default function ItSystemReport() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: report = [], isLoading } = useQuery<SystemReportItem[]>({
    queryKey: ["/api/it/system-report"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/it/system-report");
      return res.json();
    },
  });

  const reportList = Array.isArray(report) ? report : []; const filtered = reportList.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <BarChart3 className="h-6 w-6" />
            <h1 className="text-2xl font-bold">IT System Reports</h1>
          </div>
          <p className="text-muted-foreground">Detailed status of critical IT infrastructure, including servers, databases, and domain assets</p>
        </header>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by server name, type, or IP..."
              className="pl-10 h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-slate-50 border-none shadow-sm dark:bg-zinc-900">
             <CardHeader className="pb-2">
               <CardTitle className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Total Assets</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold">{reportList.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Infrastructure nodes monitored</p>
             </CardContent>
          </Card>
          <Card className="bg-slate-50 border-none shadow-sm dark:bg-zinc-900">
             <CardHeader className="pb-2">
               <CardTitle className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Active Status</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold text-green-600">{reportList.filter(r => r.status === 'Active').length}</div>
                <p className="text-xs text-muted-foreground mt-1">Nodes currently operational</p>
             </CardContent>
          </Card>
           <Card className="bg-slate-50 border-none shadow-sm dark:bg-zinc-900">
             <CardHeader className="pb-2">
               <CardTitle className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Backups Status</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold text-blue-600">85%</div>
                <p className="text-xs text-muted-foreground mt-1">System-wide backup coverage</p>
             </CardContent>
          </Card>
           <Card className="bg-slate-50 border-none shadow-sm dark:bg-zinc-900">
             <CardHeader className="pb-2">
               <CardTitle className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Recent Issues</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold text-orange-600">0</div>
                <p className="text-xs text-muted-foreground mt-1">Critical alerts in 24 hours</p>
             </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Card className="border-none shadow-sm overflow-hidden">
             <CardHeader className="bg-slate-900 border-b">
               <CardTitle className="text-lg text-white">System Infrastructure View</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-900 text-slate-400 uppercase text-xs font-semibold border-b border-slate-800 dark:border-zinc-800">
                     <tr>
                       <th className="px-6 py-4">Resource Name</th>
                       <th className="px-6 py-4">Type</th>
                       <th className="px-6 py-4">IP Address / URL</th>
                       <th className="px-6 py-4 text-center">Status</th>
                       <th className="px-6 py-4">Last Backup</th>
                       <th className="px-6 py-4">Expiry Date</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800 bg-slate-900 text-slate-300">
                     {filtered.length > 0 ? (
                       filtered.map((r) => (
                         <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <div className={`p-2 rounded-lg ${
                                 r.type === 'Server' ? 'bg-orange-500/10 text-orange-500' :
                                 r.type === 'Database' ? 'bg-blue-500/10 text-blue-500' :
                                 'bg-slate-500/10 text-slate-500'
                               }`}>
                                 {r.type === 'Server' ? <Server className="h-4 w-4" /> :
                                  r.type === 'Database' ? <Database className="h-4 w-4" /> :
                                  <Globe className="h-4 w-4" />}
                               </div>
                               <span className="font-semibold text-slate-100">{r.name}</span>
                             </div>
                           </td>
                           <td className="px-6 py-4">{r.type}</td>
                           <td className="px-6 py-4 text-slate-400 font-mono text-xs">{r.ip || r.serverUrl}</td>
                           <td className="px-6 py-4 text-center">
                             <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                               r.status === 'Active' ? 'bg-green-500/10 text-green-500' :
                               r.status === 'Warning' ? 'bg-orange-500/10 text-orange-500' :
                               'bg-red-500/10 text-red-500'
                             }`}>
                               {r.status}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-slate-400">
                             {r.lastBackup ? format(new Date(r.lastBackup), 'MMM dd, HH:mm') : '--'}
                           </td>
                           <td className="px-6 py-4 text-slate-400">
                             {r.expiryDate ? format(new Date(r.expiryDate), 'MMM dd, yyyy') : '--'}
                           </td>
                         </tr>
                       ))
                     ) : (
                       <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-400">
                            No system reports found matching your search.
                          </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
