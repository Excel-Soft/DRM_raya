import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Eye, 
  Trash2, 
  Search, 
  Copy as CopyIcon, 
  Check,
  ChevronDown
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem, 
  DropdownMenuContent, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { DrmPolicy } from "@shared/schema";

type PolicyRow = DrmPolicy & {
  legacyReadOnly?: boolean;
  legacyFileName?: string | null;
};

const LEGACY_POLICY_ASSET_BASE = "https://webexcels.pk/assets/images/policies/";

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PoliciesSettings() {
  const { toast } = useToast();
  const descEditorRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleColumns, setVisibleColumns] = useState({
    hash: true,
    head: true,
    type: true,
    detail: true,
    minAllow: true,
    maxAllow: true,
    penalty: true,
    image: true,
    create: true
  });

  // Form state
  const [formData, setFormData] = useState({
    head: "",
    type: "",
    penalty: "",
    minAllow: "",
    maxAllow: "",
    description: "",
    fileUrl: ""
  });

  // Fetch policies
  const { data: policies = [], isLoading } = useQuery<PolicyRow[]>({
    queryKey: ["/api/policies"],
  });

  // Create policy mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/policies", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to create policy");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      toast({ title: "Success", description: "Policy created successfully" });
      setFormData({
        head: "",
        type: "",
        penalty: "",
        minAllow: "",
        maxAllow: "",
        description: "",
        fileUrl: ""
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create policy",
        variant: "destructive"
      });
    },
  });

  // Delete policy mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/policies/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to delete policy");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      toast({ title: "Deleted", description: "Policy removed successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.head) {
      toast({ title: "Validation Error", description: "Policy Head is required", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredPolicies = policies.filter((p) => {
    const q = searchTerm.toLowerCase();
    const detail = stripHtml(p.description).toLowerCase();
    return (
      p.head.toLowerCase().includes(q) ||
      (p.type && p.type.toLowerCase().includes(q)) ||
      detail.includes(q)
    );
  });

  // Export functions
  const handleCopy = () => {
    const dataString = filteredPolicies.map((p, i) => 
      `${i + 1}\t${p.head}\t${p.type || ""}\t${p.description || ""}\t${p.minAllow || ""}\t${p.maxAllow || ""}\t${p.penalty || ""}\t${p.createdAt ? format(new Date(p.createdAt), "dd-MM-yyyy hh:mm a") : ""}`
    ).join("\n");
    
    const headers = "#\tHead\tType\tDetail\tMin Allow\tMax Allow\tPenalty\tCreated At\n";
    navigator.clipboard.writeText(headers + dataString);
    toast({ title: "Copied", description: "Table data copied to clipboard" });
  };

  const handleExportExcel = () => {
    const data = filteredPolicies.map((p, i) => ({
      "#": i + 1,
      "Head": p.head,
      "Policy Type": p.type,
      "Detail": p.description,
      "Min Allow": p.minAllow,
      "Max Allow": p.maxAllow,
      "Penalty": p.penalty,
      "Created At": p.createdAt ? format(new Date(p.createdAt), "dd-MM-yyyy hh:mm a") : ""
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Policies");
    XLSX.writeFile(wb, "DRM_Policies.xlsx");
    toast({ title: "Exported", description: "Policies exported to Excel" });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const tableData = filteredPolicies.map((p, i) => [
      i + 1,
      p.head,
      p.type || "",
      p.description || "",
      p.minAllow || "",
      p.maxAllow || "",
      p.penalty || "",
      p.createdAt ? format(new Date(p.createdAt), "dd-MM-yyyy") : ""
    ]);

    autoTable(doc, {
      head: [["#", "Head", "Type", "Detail", "Min", "Max", "Penalty", "Date"]],
      body: tableData,
    });

    doc.save("DRM_Policies.pdf");
    toast({ title: "Exported", description: "Policies exported to PDF" });
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 bg-[#f8fafc] dark:bg-zinc-950 min-h-screen">
      <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight px-1">
        <span className="text-slate-800 uppercase dark:text-zinc-100">Notice</span>
        <span className="text-[#059669] px-0.5 dark:text-zinc-400">/</span>
        <span className="text-[#059669] uppercase dark:text-zinc-400">DRM Policies</span>
      </div>

      {/* Create Policy Form */}
      <Card className="border border-slate-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800">
          <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-300">
            Create DRM Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium dark:text-zinc-400">Policy Head</Label>
                <Input 
                  placeholder="enter banner title"
                  value={formData.head}
                  onChange={(e) => setFormData({...formData, head: e.target.value})}
                  className="bg-white dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium dark:text-zinc-400">File</Label>
                <div className="flex gap-2">
                  <Input 
                    type="file" 
                    accept="image/*"
                    className="bg-white cursor-pointer dark:bg-zinc-900 dark:text-zinc-100"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, fileUrl: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium dark:text-zinc-400">Penalty Amount</Label>
                <Input 
                  type="number"
                  placeholder="0.00"
                  value={formData.penalty}
                  onChange={(e) => setFormData({...formData, penalty: e.target.value})}
                  className="bg-white dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium dark:text-zinc-400">Policy Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val) => setFormData({...formData, type: val})}
                >
                  <SelectTrigger className="bg-white dark:bg-zinc-900 dark:text-zinc-100">
                    <SelectValue placeholder="Choose .." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly_time">Monthly Time</SelectItem>
                    <SelectItem value="daily_target">Daily Target</SelectItem>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium dark:text-zinc-400">Min Allow</Label>
                <Input 
                  type="number"
                  value={formData.minAllow}
                  onChange={(e) => setFormData({...formData, minAllow: e.target.value})}
                  className="bg-white dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium dark:text-zinc-400">Max Allow</Label>
                <Input 
                  type="number"
                  value={formData.maxAllow}
                  onChange={(e) => setFormData({...formData, maxAllow: e.target.value})}
                  className="bg-white dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium dark:text-zinc-400">Description</Label>
              <div className="rounded-md border border-input bg-white overflow-hidden dark:bg-zinc-900">
                <div className="flex items-center gap-1 p-2 border-b bg-slate-50/80 dark:bg-zinc-800 dark:border-zinc-800">
                  <button
                    type="button"
                    title="Bold"
                    onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false, undefined); }}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-slate-700 dark:text-zinc-300 select-none font-bold"
                  >B</button>
                  <button
                    type="button"
                    title="Italic"
                    onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false, undefined); }}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-slate-700 dark:text-zinc-300 select-none italic"
                  >I</button>
                  <button
                    type="button"
                    title="Underline"
                    onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false, undefined); }}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-slate-700 dark:text-zinc-300 select-none underline"
                  >U</button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button
                    type="button"
                    title="Clear formatting"
                    onMouseDown={(e) => { e.preventDefault(); document.execCommand('removeFormat', false, undefined); }}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-slate-700 dark:text-zinc-300 select-none"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
                <div
                  ref={descEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Enter details here..."
                  className="min-h-[120px] p-3 text-sm outline-none focus:ring-0 bg-white dark:bg-zinc-900 dark:text-zinc-100 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
                  onInput={(e) => {
                    setFormData({ ...formData, description: e.currentTarget.innerHTML });
                  }}
                />
              </div>
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                className="bg-[#008d41] hover:bg-[#007a38] text-white font-semibold h-10 px-12 min-w-[140px]"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Policies Table Card */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <CardContent className="p-0">
          <div className="p-4 border-b bg-white flex flex-col md:flex-row gap-4 items-center justify-between dark:bg-zinc-900">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCopy} variant="outline" size="sm" className="bg-slate-700 text-white hover:bg-slate-600 hover:text-white border-none h-9 px-4">Copy</Button>
              <Button onClick={handleExportExcel} variant="outline" size="sm" className="bg-slate-700 text-white hover:bg-slate-600 hover:text-white border-none h-9 px-4">Excel</Button>
              <Button onClick={handleExportPDF} variant="outline" size="sm" className="bg-slate-700 text-white hover:bg-slate-600 hover:text-white border-none h-9 px-4">PDF</Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-slate-700 text-white hover:bg-slate-600 hover:text-white border-none h-9 px-4 flex items-center gap-2">
                    Column visibility <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {Object.keys(visibleColumns).map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col}
                      className="capitalize"
                      checked={visibleColumns[col as keyof typeof visibleColumns]}
                      onCheckedChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {col.replace(/([A-Z])/g, ' $1').trim()}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search..."
                className="pl-9 h-9 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#e9f7ef] text-slate-700 font-bold border-b border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  {visibleColumns.hash && <th className="px-4 py-4 w-12">#</th>}
                  {visibleColumns.head && <th className="px-4 py-4 min-w-[200px]">Head</th>}
                  {visibleColumns.type && <th className="px-4 py-4">Policy Type</th>}
                  {visibleColumns.detail && <th className="px-4 py-4 min-w-[300px]">Detail</th>}
                  {visibleColumns.minAllow && <th className="px-4 py-4">Min Allow</th>}
                  {visibleColumns.maxAllow && <th className="px-4 py-4">Max Allow</th>}
                  {visibleColumns.penalty && <th className="px-4 py-4">Penalty</th>}
                  {visibleColumns.image && <th className="px-4 py-4">Image</th>}
                  {visibleColumns.create && <th className="px-4 py-4">Create</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:bg-zinc-900">
                {isLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-4 py-4 bg-slate-50 dark:bg-zinc-900"></td>
                    </tr>
                  ))
                ) : filteredPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-medium dark:text-zinc-400">
                      {searchTerm ? "No policies found matching your search." : "No policies yet. Create one above or check legacy sync."}
                    </td>
                  </tr>
                ) : (
                  filteredPolicies.map((policy, index) => (
                    <tr key={policy.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                      {visibleColumns.hash && <td className="px-4 py-4 font-medium text-slate-600 dark:text-zinc-300">{index + 1}</td>}
                      {visibleColumns.head && <td className="px-4 py-4 font-semibold text-slate-800 dark:text-zinc-100">{policy.head}</td>}
                      {visibleColumns.type && (
                        <td className="px-4 py-4 text-slate-600 dark:text-zinc-300">
                          {policy.type === 'monthly_time' ? 'monthly_time' : policy.type}
                        </td>
                      )}
                      {visibleColumns.detail && (
                        <td className="px-4 py-4 text-slate-600 max-w-md dark:text-zinc-300">
                          <p className="line-clamp-3 whitespace-pre-wrap break-words">
                            {stripHtml(policy.description) || "-"}
                          </p>
                        </td>
                      )}
                      {visibleColumns.minAllow && <td className="px-4 py-4 font-medium text-slate-600 dark:text-zinc-300">{policy.minAllow || '-'}</td>}
                      {visibleColumns.maxAllow && <td className="px-4 py-4 font-medium text-slate-600 dark:text-zinc-300">{policy.maxAllow || '-'}</td>}
                      {visibleColumns.penalty && <td className="px-4 py-4 font-bold text-slate-700 dark:text-zinc-400">{policy.penalty || '-'}</td>}
                      {visibleColumns.image && (
                        <td className="px-4 py-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            title="View Image"
                            onClick={() => {
                              if (policy.fileUrl && policy.fileUrl.startsWith("data:image")) {
                                const w = window.open("");
                                if (w) {
                                  w.document.write(`<img src="${policy.fileUrl}" style="max-width: 100%;" />`);
                                }
                                return;
                              }
                              if (policy.legacyFileName) {
                                const asset = `${LEGACY_POLICY_ASSET_BASE}${encodeURIComponent(policy.legacyFileName)}`;
                                window.open(asset, "_blank", "noopener,noreferrer");
                                return;
                              }
                              toast({ title: "No file", description: "No image or file attached to this policy." });
                            }}
                          >
                            <Eye className="w-5 h-5" />
                          </Button>
                        </td>
                      )}
                      {visibleColumns.create && (
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 tabular-nums dark:text-zinc-400">
                              {policy.createdAt ? format(new Date(policy.createdAt), "dd-MM-yyyy hh:mm a") : '-'}
                            </span>
                            {!policy.legacyReadOnly && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this policy?")) {
                                    deleteMutation.mutate(policy.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-white border-t text-sm text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
            Showing {filteredPolicies.length} of {policies.length} entries
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
