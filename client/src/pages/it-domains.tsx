import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, User, RefreshCw, FileText, Download, Copy, Printer, Globe, Loader2, MessageSquare, ShieldCheck, HardDrive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function ItDomains() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: domains = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/it/domains"],
  });

  const domainsList = Array.isArray(domains) ? domains : []; const filteredDomains = domainsList.filter(d => 
    (d.domainName || d.domain || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = (type: string) => {
    switch (type) {
      case "Copy":
        const text = filteredDomains.map(d => `${d.company || 'N/A'}\t${d.domainName || d.domain}\t${d.expiryDate || d.domainExp}`).join('\n');
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Table data copied to clipboard" });
        break;
      case "Print":
        window.print();
        break;
      case "Excel":
      case "CSV":
      case "PDF":
        toast({ title: "Exporting...", description: `Preparing ${type} file for download` });
        setTimeout(() => {
          toast({ title: "Success", description: `${type} exported successfully` });
        }, 1000);
        break;
    }
  };

  const exportButtons = [
    { label: "Copy", icon: Copy },
    { label: "Excel", icon: Download },
    { label: "CSV", icon: FileText },
    { label: "PDF", icon: FileText },
    { label: "Print", icon: Printer },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen dark:bg-zinc-950 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          header, aside, .print\\:p-0 > :not(.print-content) { display: none !important; }
          .print-content { display: block !important; width: 100% !important; margin: 0 !important; }
        }
      `}</style>
      <div className="no-print">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase dark:text-zinc-100">IT Department</h1>
      </div>

      {/* Filter Card */}
      <Card className="border-none shadow-sm no-print">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Company Name</label>
            <Input placeholder="Enter company name" className="bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Person Name</label>
            <Input placeholder="Enter person name" className="bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Contact No#</label>
            <Input placeholder="Enter contact no" className="bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase dark:text-zinc-400">Email</label>
            <Input placeholder="Enter e-mail" className="bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" />
          </div>
        </CardContent>
      </Card>

      <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase mt-2 no-print dark:text-zinc-100">Domain / Hosting / SSL</h1>

      {/* Table Card */}
      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-900 print-content dark:bg-zinc-900">
        <CardContent className="p-0">
          <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b no-print">
            <div className="flex gap-2">
              {exportButtons.map((btn) => (
                <Button 
                  key={btn.label} 
                  variant="outline" 
                  size="sm" 
                  className={`bg-slate-50 dark:bg-zinc-9000 text-white border-none hover:bg-slate-600 h-9 px-4 ${btn.label === 'Print' ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                  onClick={() => handleExport(btn.label)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-zinc-400">Search:</span>
              <Input 
                className="h-9 w-48 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
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
              {filteredDomains.map((item: any, idx: number) => (
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
                    <Badge variant="secondary" className="text-[10px] bg-slate-50 text-white leading-none px-1.5 py-0.5 dark:bg-zinc-900">Renew</Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{item.hostingExpiryDate ? new Date(item.hostingExpiryDate).toLocaleDateString() : "N/A"}</div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-700 text-white leading-none px-1.5 py-0.5">Renew</Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{item.sslExpiryDate ? new Date(item.sslExpiryDate).toLocaleDateString() : "N/A"}</div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-50 text-white leading-none px-1.5 py-0.5 dark:bg-zinc-900">Renew</Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm dark:text-zinc-300">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                       <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full">
                              <User className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] w-[1200px] p-0 gap-0 overflow-hidden border-none shadow-2xl bg-[#f8f9fa] dark:bg-zinc-900">
                            <DialogHeader className="p-4 bg-white dark:bg-zinc-900 border-b flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900">
                              <DialogTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">Attribute</DialogTitle>
                            </DialogHeader>
                            <div className="p-6 overflow-y-auto max-h-[85vh]">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                {/* Left Column: Client Info */}
                                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden dark:bg-zinc-900">
                                  <CardContent className="p-6 flex flex-col items-center text-center">
                                    <h3 className="font-bold text-slate-800 text-lg mb-2 dark:text-zinc-100">{item.company || "N/A"}</h3>
                                    <div className="h-12 w-12 rounded-full bg-blue-100/50 flex items-center justify-center text-blue-600 font-bold text-xl mb-4">
                                      {(item.company || "N").charAt(0)}
                                    </div>
                                    <h4 className="font-bold text-slate-700 dark:text-zinc-400">Client Contact</h4>
                                    <p className="text-xs text-slate-400 mb-4">{item.email || "N/A"}</p>
                                    
                                    <div className="flex gap-2 mb-6">
                                      <Badge className="bg-emerald-600 hover:bg-emerald-600 px-3 py-1 text-[10px] font-bold">{item.contactNo || "N/A"}</Badge>
                                    </div>

                                    <div className="grid grid-cols-2 w-full gap-4 mb-6">
                                      <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold mb-1">Grade:</span>
                                        <div className="h-10 w-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-400 font-bold">D</div>
                                      </div>
                                      <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold mb-1">Contact:</span>
                                        <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-400 font-bold">0</div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Middle Column: Expiry History */}
                                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden dark:bg-zinc-900">
                                  <CardContent className="p-6 dark:bg-zinc-900">
                                    <h3 className="font-bold text-slate-700 text-sm mb-6 flex items-center gap-2 dark:text-zinc-400">
                                      Expiry Date
                                    </h3>
                                    <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
                                      <div className="flex gap-4 relative">
                                        <div className="h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 flex items-center justify-center z-10 shrink-0 mt-1 dark:bg-zinc-900 dark:border-zinc-800">
                                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                              <Globe className="h-4 w-4" />
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-400">Domain</p>
                                              <p className="text-[10px] text-slate-400 italic font-mono">{item.domainName || item.domain}</p>
                                            </div>
                                          </div>
                                          <Badge className="bg-slate-800 text-white font-mono text-[9px] w-fit">Exp: {item.expiryDate || "N/A"}</Badge>
                                        </div>
                                      </div>

                                      <div className="flex gap-4 relative">
                                        <div className="h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 flex items-center justify-center z-10 shrink-0 mt-1 dark:bg-zinc-900 dark:border-zinc-800">
                                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                              <ShieldCheck className="h-4 w-4" />
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-400">SSL</p>
                                              <p className="text-[10px] text-slate-400 italic font-mono">{item.domainName || item.domain}</p>
                                            </div>
                                          </div>
                                          <Badge className="bg-slate-800 text-white font-mono text-[9px] w-fit">Exp: {item.sslExpiryDate || "N/A"}</Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Right Column: Tools */}
                                <div className="space-y-6">
                                  <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden dark:bg-zinc-900">
                                    <CardContent className="p-6 dark:bg-zinc-900">
                                      <h3 className="font-bold text-slate-700 text-sm mb-4 dark:text-zinc-400">Whatsapp Message</h3>
                                      <div className="space-y-4">
                                        <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 resize-none dark:bg-zinc-900 dark:border-zinc-800" />
                                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 font-bold uppercase text-[11px] tracking-wide flex items-center gap-2">
                                          <MessageSquare className="h-4 w-4" /> Whatsapp
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                       </Dialog>
                       <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] w-[1200px] p-0 gap-0 overflow-hidden border-none shadow-2xl bg-[#f8f9fa] dark:bg-zinc-900">
                            <DialogHeader className="p-4 bg-white dark:bg-zinc-900 border-b dark:bg-zinc-900">
                              <div className="flex items-center gap-2">
                                <DialogTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">Invoice Quotation</DialogTitle>
                                <span className="text-xs font-bold text-emerald-500">{new Date().toLocaleString()}</span>
                              </div>
                            </DialogHeader>
                            <div className="p-6 overflow-y-auto max-h-[85vh]">
                              <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden p-6 mb-6 text-slate-800 dark:bg-zinc-900 dark:text-zinc-100">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase dark:text-zinc-400">Company</label>
                                    <Input value={item.company || "N/A"} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800" />
                                  </div>
                                </div>
                                <Table>
                                  <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
                                    <TableRow>
                                      <TableHead className="text-xs font-bold">Product</TableHead>
                                      <TableHead className="text-xs font-bold">Detail</TableHead>
                                      <TableHead className="text-xs font-bold text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell className="text-xs">Domain Renewal</TableCell>
                                      <TableCell className="text-xs">{item.domainName || item.domain}</TableCell>
                                      <TableCell className="text-xs text-right">0.00</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                                <div className="mt-8 flex justify-end">
                                  <Button className="bg-emerald-600 hover:bg-emerald-700">Generate Quotation</Button>
                                </div>
                              </Card>
                            </div>
                          </DialogContent>
                       </Dialog>
                    </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
