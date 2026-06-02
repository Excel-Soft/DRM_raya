import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Search, User, RefreshCw, Plus, Server, Database, Trash2, Globe, HardDrive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export default function ItServers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormVisible, setIsFormVisible] = useState(true);
  const { toast } = useToast();

  const { data: servers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/it/servers"],
  });

  const { data: registries = [] } = useQuery<any[]>({
    queryKey: ["/api/it/registries"],
  });

  const { data: hostingPackages = [] } = useQuery<any[]>({
    queryKey: ["/api/it/hosting-packages"],
  });

  const { data: domains = [] } = useQuery<any[]>({
    queryKey: ["/api/it/domains"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const serversList = Array.isArray(servers) ? servers : []; const registriesList = Array.isArray(registries) ? registries : []; const hostingPackagesList = Array.isArray(hostingPackages) ? hostingPackages : []; const domainsList = Array.isArray(domains) ? domains : []; const filteredDomains = domainsList.filter(d => 
    d && (d.domainName || d.domain || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteServerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/it/servers/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Server deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/servers"] });
    },
    onError: () => toast({ title: "Failed to delete server", variant: "destructive" })
  });

  const deleteRegistryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/it/registries/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Registry deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/registries"] });
    },
    onError: () => toast({ title: "Failed to delete registry", variant: "destructive" })
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/it/hosting-packages/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Hosting package deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/hosting-packages"] });
    },
    onError: () => toast({ title: "Failed to delete package", variant: "destructive" })
  });

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen dark:bg-zinc-950">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h1 
          className="text-2xl font-bold tracking-tight text-slate-800 cursor-pointer select-none flex items-center gap-3 group dark:text-zinc-100"
          onClick={() => setIsFormVisible(!isFormVisible)}
        >
          ADD SERVER / <span className="text-emerald-600">ADD DOMAIN</span>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity dark:text-zinc-400 dark:bg-zinc-900">
            {isFormVisible ? "Click to hide" : "Click to show"}
          </span>
        </h1>
      </div>

      {/* Main Form Card */}
      {isFormVisible && (
        <Card className="border-none shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
        <CardContent className="p-6 dark:bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Row 1 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Company Name<span className="text-red-500">*</span></label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search Company Through Id/Name" className="pl-10 h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Domain Name<span className="text-red-500">*</span></label>
              <Input placeholder="Enter domain name" className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Registry<span className="text-red-500">*</span></label>
              <Select>
                <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  {registriesList.map((r: any) => r && (
                    <SelectItem key={r.id || r.name || String(r)} value={r.id || r.name || String(r)}>{r.name || String(r)}</SelectItem>
                  ))}
                  {registriesList.length === 0 && <SelectItem value="none" disabled>No registries found</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">SSL</label>
                <div className="flex items-center h-11 px-3 border rounded-md bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <Checkbox id="ssl" className="border-slate-300 dark:border-zinc-800" />
                  <label htmlFor="ssl" className="ml-2 text-sm text-slate-500 dark:text-zinc-400">Enable SSL</label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Hosting</label>
                <Select>
                  <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serversList.map((s: any) => s && (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                    {serversList.length === 0 && <SelectItem value="none" disabled>No servers found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">First Date<span className="text-red-500">*</span></label>
              <Input type="date" className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Activation Date<span className="text-red-500">*</span></label>
              <Input type="date" className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert" />
            </div>

            {/* Row 3 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Active Duration<span className="text-red-500">*</span></label>
              <Select>
                <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years</SelectItem>
                  <SelectItem value="5">5 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Cpanel Username<span className="text-red-500">*</span></label>
              <Input placeholder="Enter username" className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Cpanel Password<span className="text-red-500">*</span></label>
              <Input type="password" placeholder="Enter password" className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
            </div>
          </div>

          <div className="mt-8">
            <Button className="h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all">
              Submit
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Table Section */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between bg-white dark:bg-zinc-900 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-zinc-400">Show</span>
              <Select defaultValue="10">
                <SelectTrigger className="w-16 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500 dark:text-zinc-400">entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-zinc-400">Search:</span>
              <Input className="h-8 w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
              <TableRow>
                <TableHead className="w-12 font-bold text-slate-700 dark:text-zinc-400">No</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company Name</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Domain Name</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Domain</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Hosting</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">SSL</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Register</TableHead>
                <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDomains.map((item: any, idx: number) => item && (
                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                  <TableCell className="text-slate-500 font-medium dark:text-zinc-400">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-700 dark:text-zinc-400">{item.company || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 transition-colors">
                      {item.domainName || item.domain}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "N/A"}</div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-700 text-white leading-none px-1.5 py-0.5">Renew</Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{item.hostingExpiryDate ? new Date(item.hostingExpiryDate).toLocaleDateString() : "N/A"}</div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-700 text-white leading-none px-1.5 py-0.5">Renew</Badge>
                  </TableCell>
                  <TableCell>
                    {item.ssl && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm dark:text-zinc-300">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}</TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full"
                      onClick={() => toast({ title: "User credentials module under construction" })}
                    >
                      <User className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full" onClick={() => toast({ title: "Refreshing domain status..." })}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredDomains.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-slate-500 dark:text-zinc-400">No domains found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-4 border-t flex items-center justify-between bg-white dark:bg-zinc-900 dark:bg-zinc-900">
            <span className="text-sm text-slate-500 dark:text-zinc-400">Showing {filteredDomains.length} entries</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">1</Button>
              <Button variant="outline" size="sm" disabled>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Servers List */}
        <Card className="border-none shadow-sm overflow-hidden flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader className="bg-emerald-600 py-3 px-4 flex flex-row items-center justify-between space-y-0 text-white">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-white" /> Add Server
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-zinc-900 flex-1 text-white dark:bg-zinc-900">
            <div className="space-y-6">
              {serversList.map((server: any, i: number) => server && (
                <div key={i} className="flex flex-col gap-1 border-b border-slate-50 pb-4 last:border-0 last:pb-0 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[13px] dark:text-zinc-100">{server.name}</span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-500 font-medium dark:text-zinc-400 dark:bg-zinc-900">
                      {server.ip}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-bold ${server.status === "Active" ? "text-emerald-500" : "text-red-500"}`}>
                        Status : {server.status}
                      </span>
                      <span className="text-[10px] text-slate-400">Provider: {server.provider}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteServerMutation.mutate(server.id)} disabled={deleteServerMutation.isPending}>
                      {deleteServerMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
              {serversList.length === 0 && <div className="text-center py-4 text-slate-400 text-sm">No servers listed</div>}
            </div>
          </CardContent>
        </Card>

        {/* Registry List */}
        <Card className="border-none shadow-sm overflow-hidden flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader className="bg-slate-50 dark:bg-zinc-800 py-3 px-4 flex flex-row items-center justify-between space-y-0 text-white dark:bg-zinc-900">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-white" /> Add Registry
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-zinc-900 flex-1 text-white dark:bg-zinc-900">
            <div className="space-y-3">
              {registriesList.map((reg: any, i: number) => reg && (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 dark:border-zinc-800">
                  <span className="text-[13px] font-medium text-slate-700 dark:text-zinc-400">{reg.name || reg}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteRegistryMutation.mutate(reg.id)} disabled={deleteRegistryMutation.isPending}>
                    {deleteRegistryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
              {registriesList.length === 0 && <div className="text-center py-4 text-slate-400 text-sm">No registries listed</div>}
            </div>
          </CardContent>
        </Card>

        {/* Hosting Packages */}
        <Card className="border-none shadow-sm overflow-hidden flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader className="bg-emerald-600 py-3 px-4 flex flex-row items-center justify-between space-y-0 text-white">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-white" /> Add Hosting Pkg
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-zinc-900 flex-1 text-white dark:bg-zinc-900">
            <div className="space-y-3">
              {hostingPackagesList.map((pkg: any, i: number) => pkg && (
                <div key={i} className="flex flex-col gap-0.5 py-2 border-b border-slate-50 last:border-0 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-zinc-100">{pkg.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deletePackageMutation.mutate(pkg.id)} disabled={deletePackageMutation.isPending}>
                      {deletePackageMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold tracking-wide">Capacity: {pkg.capacity || "N/A"}</span>
                </div>
              ))}
              {hostingPackagesList.length === 0 && <div className="text-center py-4 text-slate-400 text-sm">No packages listed</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
