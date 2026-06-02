import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Search, Filter, FileText, CheckCircle2, AlertCircle, Download, Upload, Loader2, Save as SaveIcon, Image as ImageIcon, PlusCircle, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProductPostingData, InsertProductPostingData } from "@shared/schema";

export default function PostingDataPage() {
    const [location, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Form states
    const [category, setCategory] = useState("");
    const [title, setTitle] = useState("");
    const [keywords, setKeywords] = useState("");
    const [description, setDescription] = useState("");

    const [categoryFilter, setCategoryFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [entriesCount, setEntriesCount] = useState("10");
    const [userFilter, setUserFilter] = useState("all");

    const [newRestrictedKeyword, setNewRestrictedKeyword] = useState("");
    const [restrictedSearch, setRestrictedSearch] = useState("");

    const expectArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

    // Fetch users for Link Report
    const { data: usersData = [] } = useQuery<any[]>({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            return expectArray(await res.json());
        }
    });

    // Fetch current user data
    const { data: currentUser } = useQuery<any>({
        queryKey: ["/api/me/profile"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/me/profile");
            return await res.json();
        },
    });

    useEffect(() => {
        if (currentUser?.id) {
            setUserFilter(currentUser.id.toString());
        }
    }, [currentUser]);

    // Fetch restricted keywords
    const { data: restrictedKeywords = [], isLoading: loadingRestricted } = useQuery<any[]>({
        queryKey: ["/api/restricted-keywords"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/restricted-keywords");
            return expectArray(await res.json());
        }
    });

    // Mutations for restricted keywords
    const addRestrictedMutation = useMutation({
        mutationFn: async (keyword: string) => {
            const res = await apiRequest("POST", "/api/restricted-keywords", { keyword });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/restricted-keywords"] });
            setNewRestrictedKeyword("");
            toast({ title: "Success", description: "Keyword added to restricted list." });
        }
    });

    const deleteRestrictedMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/restricted-keywords/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/restricted-keywords"] });
            toast({ title: "Removed", description: "Keyword removed from restricted list." });
        }
    });

    const { data: categoryCounts = [] } = useQuery<{category: string, count: number}[]>({
        queryKey: ["/api/posting-data/counts"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/posting-data/counts");
            return expectArray(await res.json());
        }
    });

    const getCount = (cat: string) => {
        // Find by exact match or normalized match (case-insensitive)
        const item = categoryCounts.find(c => c.category?.toLowerCase() === cat.toLowerCase());
        return item ? Number(item.count) : 0;
    };

    // Fetch data with query params if requested
    const { data: postingData = [], isLoading, refetch } = useQuery<ProductPostingData[]>({
        queryKey: ["/api/posting-data", categoryFilter, startDate, endDate],
        queryFn: async ({ queryKey }) => {
            const [urlBase, category, start, end] = queryKey as [string, string, string, string];
            let url = urlBase;
            const params = new URLSearchParams();
            if (category && category !== "all") params.append("category", category);
            if (start) params.append("startDate", start);
            if (end) params.append("endDate", end);
            const res = await apiRequest("GET", `${url}?${params.toString()}`);
            return expectArray(await res.json());
        }
    });

    const { data: linkReportData = [], isLoading: isLoadingReport, refetch: refetchReport } = useQuery<any[]>({
        queryKey: ["/api/product-posting/report-links", userFilter, startDate, endDate],
        queryFn: async ({ queryKey }) => {
            const [urlBase, user, start, end] = queryKey as [string, string, string, string];
            let url = urlBase;
            const params = new URLSearchParams();
            if (user && user !== "all") params.append("userFilter", user);
            if (start) params.append("startDate", start);
            if (end) params.append("endDate", end);
            const res = await apiRequest("GET", `${url}?${params.toString()}`);
            const json = await res.json();
            return expectArray(json.data || json); 
        }
    });

    // Mutations
    const saveMutation = useMutation({
        mutationFn: async (newData: InsertProductPostingData) => {
            const res = await apiRequest("POST", "/api/posting-data", newData);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/posting-data"] });
            toast({ title: "Success", description: "Data saved successfully." });
            // Clear form
            setTitle("");
            setKeywords("");
            setDescription("");
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const importMutation = useMutation({
        mutationFn: async (items: InsertProductPostingData[]) => {
            const res = await apiRequest("POST", "/api/posting-data/import", items);
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/posting-data"] });
            toast({ title: "Import Successful", description: `${data.length} items imported.` });
        },
        onError: (error: any) => {
            toast({ title: "Import Failed", description: error.message, variant: "destructive" });
        }
    });

    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string | number, status: string }) => {
            const res = await apiRequest("PATCH", `/api/posting-data/${id}/status`, { status });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/posting-data"] });
            toast({ title: "Updated", description: "Product status changed successfully." });
        }
    });

    const filteredData = postingData.filter(d => 
        (d.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         d.keywords?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         d.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    ).slice(0, parseInt(entriesCount));

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (text) {
                    // Simple CSV parsing
                    const lines = text.split('\n');
                    const headers = lines[0].split(',');
                    const items: InsertProductPostingData[] = [];

                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        const values = lines[i].split(',');
                        if (values.length >= 4) {
                            items.push({
                                category: values[0].trim(),
                                title: values[1].trim(),
                                keywords: values[2].trim(),
                                description: values[3].trim(),
                                status: "Pending",
                                platform: "Imported"
                            });
                        }
                    }

                    if (items.length > 0) {
                        importMutation.mutate(items);
                    } else {
                        toast({ title: "Import Error", description: "No valid data found in CSV.", variant: "destructive" });
                    }
                }
            };
            reader.readAsText(file);
        }
    };

    const handleDownloadTemplate = () => {
        const data = "Category,Title,Keywords,Description\nElectronic,Example Product,keyword1;keyword2,Detailed description here";
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'Keyword_Import_Template.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: "Template Downloaded", description: "Keyword_Import_Template.csv saved." });
    };

    const handleSaveKeyword = () => {
        if (!category || !title) {
            toast({ title: "Error", description: "Category and Title are required.", variant: "destructive" });
            return;
        }
        saveMutation.mutate({
            category,
            title,
            keywords,
            description,
            status: "Pending",
            platform: "Web UI"
        });
    };

    return (
        <div className="flex flex-col gap-6 p-6 bg-[#f0f2f5] min-h-screen dark:bg-zinc-950">
            <div className="flex items-center justify-between">
                <div>
                   <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase flex items-center gap-2 dark:text-zinc-100">
                     <Database className="h-6 w-6 text-emerald-600" /> Posting Data Management
                   </h1>
                   <p className="text-sm text-slate-500 mt-1 dark:text-zinc-400">Manage and verify cross-platform product posting data.</p>
                </div>
                {location !== "/posting-data/add-products" && (
                    <Button 
                        onClick={() => setLocation("/posting-data/add-products")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Add Product Data
                    </Button>
                )}
            </div>

            {location === "/posting-data/add-products" && (
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <div className="bg-white px-6 py-4 dark:bg-zinc-900">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">
                                MONTHLY REPORTS
                            </h2>
                        </div>
                        <CardContent className="px-6 pb-6 pt-0">
                            <div className="flex flex-wrap items-end gap-4 p-4 rounded border border-slate-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex-1 min-w-[200px] space-y-1.5">
                                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">Category</label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="h-9 bg-white border-slate-200 text-sm dark:bg-zinc-900 dark:border-zinc-800">
                                            <SelectValue placeholder="Choose Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="oil">Oil & Natural Gas</SelectItem>
                                            <SelectItem value="leather">Leather products</SelectItem>
                                            <SelectItem value="veterinary">veterinary Instruments</SelectItem>
                                            <SelectItem value="apparel">Apparel</SelectItem>
                                            <SelectItem value="costumes">Costumes</SelectItem>
                                            <SelectItem value="electronics">Electronics</SelectItem>
                                            <SelectItem value="fashion">Fashion</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 min-w-[200px] space-y-1.5">
                                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">Main Image</label>
                                    <Input 
                                        type="file" 
                                        className="h-9 w-full bg-white border-slate-200 text-sm text-slate-600 file:bg-slate-100 file:text-slate-600 file:border-none file:border-r file:border-slate-200 file:h-full file:px-3 file:mr-3 cursor-pointer dark:bg-zinc-900 dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="flex-1 min-w-[200px] space-y-1.5">
                                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">Other View</label>
                                    <Input 
                                        type="file" 
                                        multiple
                                        className="h-9 w-full bg-white border-slate-200 text-sm text-slate-600 file:bg-slate-100 file:text-slate-600 file:border-none file:border-r file:border-slate-200 file:h-full file:px-3 file:mr-3 cursor-pointer dark:bg-zinc-900 dark:border-zinc-800" 
                                    />
                                </div>
                                <Button 
                                    onClick={() => {
                                        if (!category) {
                                            toast({ title: "Error", description: "Category is required.", variant: "destructive" });
                                            return;
                                        }
                                        saveMutation.mutate({
                                            category,
                                            title: "Product Image Upload",
                                            status: "Pending",
                                            platform: "Web UI"
                                        });
                                    }}
                                    disabled={saveMutation.isPending}
                                    className="h-9 px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white text-sm font-medium shadow-sm"
                                >
                                    {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-none shadow-sm bg-[#0073b7] text-white overflow-hidden">
                           <CardContent className="p-6">
                               <div className="flex items-center justify-between">
                                   <div>
                                       <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Total Products</p>
                                       <h3 className="text-3xl font-black mt-1">{postingData.length}</h3>
                                   </div>
                                   <div className="h-12 w-12 rounded bg-white flex items-center justify-center font-bold text-xl dark:bg-zinc-900">
                                      P
                                   </div>
                               </div>
                           </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-[#00a65a] text-white overflow-hidden">
                           <CardContent className="p-6">
                               <div className="flex items-center justify-between">
                                   <div>
                                       <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Verified Data</p>
                                       <h3 className="text-3xl font-black mt-1">
                                           {postingData.length > 0 
                                             ? Math.round((postingData.filter(d => d.status === 'Verified').length / postingData.length) * 100) 
                                             : 0}%
                                       </h3>
                                   </div>
                                   <div className="h-12 w-12 rounded bg-white flex items-center justify-center font-bold text-xl dark:bg-zinc-900">
                                      V
                                   </div>
                               </div>
                           </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-[#374850] text-white overflow-hidden">
                           <CardContent className="p-6">
                               <div className="flex items-center justify-between">
                                   <div>
                                       <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Pending Tasks</p>
                                       <h3 className="text-3xl font-black mt-1">
                                           {postingData.filter(d => d.status === 'Pending').length}
                                       </h3>
                                   </div>
                                   <div className="h-12 w-12 rounded bg-white flex items-center justify-center font-bold text-xl dark:bg-zinc-900">
                                      T
                                   </div>
                               </div>
                           </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {location === "/posting-data/add-keywords" && (
                <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                    <CardHeader className="bg-white px-6 py-4 flex flex-row items-center justify-between border-b dark:bg-zinc-900">
                        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">
                            POST KEYWORD DATA
                        </h2>
                        <div className="flex items-center gap-2">
                             <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileChange}
                                accept=".csv"
                             />
                             <Button 
                                size="sm" 
                                onClick={handleImportClick}
                                disabled={importMutation.isPending}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-8 px-4 font-bold flex items-center gap-1.5"
                             >
                                {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} 
                                Import
                             </Button>
                             <Button 
                                size="sm" 
                                onClick={handleDownloadTemplate}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-8 px-4 font-bold flex items-center gap-1.5"
                             >
                                <Download className="h-3.5 w-3.5" /> Template
                             </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Category</label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className="h-11 bg-white border-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose .." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Apparel">Apparel</SelectItem>
                                        <SelectItem value="Costumes">Costumes</SelectItem>
                                        <SelectItem value="TV & Movie Costumes">TV & Movie Costumes</SelectItem>
                                        <SelectItem value="Reenactment Attire">Reenactment Attire</SelectItem>
                                        <SelectItem value="Mascot">Mascot</SelectItem>
                                        <SelectItem value="Anime Costumes">Anime Costumes</SelectItem>
                                        <SelectItem value="Zentai / Catsuit">Zentai / Catsuit</SelectItem>
                                        <SelectItem value="Garment Accessories">Garment Accessories</SelectItem>
                                        <SelectItem value="Garment Tags">Garment Tags</SelectItem>
                                        <SelectItem value="Underwear Accessories">Underwear Accessories</SelectItem>
                                        <SelectItem value="Patches">Patches</SelectItem>
                                        <SelectItem value="Interlinings & Linings">Interlinings & Linings</SelectItem>
                                        <SelectItem value="Garment Labels">Garment Labels</SelectItem>
                                        <SelectItem value="Buttons">Buttons</SelectItem>
                                        <SelectItem value="Badges">Badges</SelectItem>
                                        <SelectItem value="Garment Beads">Garment Beads</SelectItem>
                                        <SelectItem value="Sequins">Sequins</SelectItem>
                                        <SelectItem value="Shoulder Pads">Shoulder Pads</SelectItem>
                                        <SelectItem value="Lace & Cords & Trimming">Lace & Cords & Trimming</SelectItem>
                                        <SelectItem value="Webbing">Webbing</SelectItem>
                                        <SelectItem value="Braid">Braid</SelectItem>
                                        <SelectItem value="Buckle & Hook & Loop">Buckle & Hook & Loop</SelectItem>
                                        <SelectItem value="Garment Clips">Garment Clips</SelectItem>
                                        <SelectItem value="Boning">Boning</SelectItem>
                                        <SelectItem value="Zippers & Accessories">Zippers & Accessories</SelectItem>
                                        <SelectItem value="Rhinestones">Rhinestones</SelectItem>
                                        <SelectItem value="Knitting Rib">Knitting Rib</SelectItem>
                                        <SelectItem value="Infant & Toddlers Clothing">Infant & Toddlers Clothing</SelectItem>
                                        <SelectItem value="Baby Sweaters">Baby Sweaters</SelectItem>
                                        <SelectItem value="Baby Vests & Waistcoats">Baby Vests & Waistcoats</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Title</label>
                                <Input 
                                    className="h-11 border-slate-300 dark:border-zinc-800" 
                                    placeholder="Enter title" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Keywords</label>
                                <Input 
                                    className="h-11 border-slate-300 dark:border-zinc-800" 
                                    placeholder="Enter keywords" 
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Description</label>
                            <Textarea 
                                className="min-h-[200px] border-slate-300 resize-none dark:border-zinc-800" 
                                placeholder="Enter description" 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                        <Button 
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 px-10 shadow-md"
                            onClick={handleSaveKeyword}
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </CardContent>
                </Card>
            )}

            {location === "/posting-data/view-keywords" && (
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <div className="bg-slate-50 border-b px-4 py-3 dark:bg-zinc-900/50 dark:border-zinc-800">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">
                                SEARCH KEYWORDS FOR CATEGORY
                            </h2>
                        </div>
                        <div className="p-4 border-b border-slate-100 flex flex-wrap items-end gap-4 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="flex-1 min-w-[200px] space-y-1.5">
                                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">Category</label>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="h-9 bg-white border-slate-200 text-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose ..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        <SelectItem value="electronics">Electronics</SelectItem>
                                        <SelectItem value="clothing">Clothing</SelectItem>
                                        <SelectItem value="home">Home & Garden</SelectItem>
                                        <SelectItem value="industrial">Industrial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 min-w-[180px] space-y-1.5">
                                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">Start Date</label>
                                <Input 
                                    type="date" 
                                    className="h-9 bg-white border-slate-200 text-sm text-slate-500 dark:bg-zinc-900 dark:border-zinc-800" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex-1 min-w-[180px] space-y-1.5">
                                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">End Date</label>
                                <Input 
                                    type="date" 
                                    className="h-9 bg-white border-slate-200 text-sm text-slate-500 dark:bg-zinc-900 dark:border-zinc-800" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <Button 
                                onClick={() => refetch()}
                                className="h-9 px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white text-sm font-medium shadow-sm"
                            >
                                View
                            </Button>
                        </div>
                        <CardContent className="p-0">
                            <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] text-slate-600 dark:text-zinc-400">Show</label>
                                    <div className="flex items-center gap-2">
                                        <Select value={entriesCount} onValueChange={setEntriesCount}>
                                            <SelectTrigger className="h-8 w-16 bg-white border-slate-200 text-xs dark:bg-zinc-900 dark:border-zinc-800">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <span className="text-[11px] text-slate-600 dark:text-zinc-400">entries</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] text-slate-600 dark:text-zinc-400">Search:</label>
                                    <Input 
                                        className="h-8 w-48 bg-white border-slate-200 text-sm dark:bg-zinc-900 dark:border-zinc-800" 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
                                    <TableRow className="border-b border-slate-100 dark:border-zinc-800 hover:bg-transparent">
                                        <TableHead className="w-12 text-[11px] font-bold text-slate-700 dark:text-zinc-400 h-10">#</TableHead>
                                        <TableHead className="text-[11px] font-bold text-slate-700 dark:text-zinc-400 h-10">Title</TableHead>
                                        <TableHead className="text-[11px] font-bold text-slate-700 dark:text-zinc-400 h-10">Keywords</TableHead>
                                        <TableHead className="text-[11px] font-bold text-slate-700 dark:text-zinc-400 h-10">Description</TableHead>
                                        <TableHead className="text-[11px] font-bold text-slate-700 dark:text-zinc-400 h-10">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredData.length > 0 ? (
                                        filteredData.map((item, idx) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50 border-b border-slate-100 dark:border-zinc-800">
                                                <TableCell className="text-slate-600 text-xs font-medium dark:text-zinc-400 py-3">{idx + 1}</TableCell>
                                                <TableCell className="text-slate-800 text-xs font-medium dark:text-zinc-100 py-3">{item.title}</TableCell>
                                                <TableCell className="text-slate-600 text-xs max-w-[200px] truncate dark:text-zinc-300 py-3">{item.keywords}</TableCell>
                                                <TableCell className="text-slate-600 text-xs max-w-[300px] truncate dark:text-zinc-400 py-3">{item.description}</TableCell>
                                                <TableCell className="text-slate-600 text-[11px] whitespace-nowrap dark:text-zinc-400 py-3">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    }).replace(',', '') : "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm font-medium">
                                                No records found matching your criteria
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="p-4 flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400">
                                <div>Showing 1 to {filteredData.length} of {filteredData.length} entries</div>
                                <div className="flex items-center gap-1 rounded-md border border-slate-200 overflow-hidden dark:border-zinc-800">
                                    <Button variant="ghost" size="sm" className="h-8 px-3 rounded-none text-[11px] hover:bg-slate-50 dark:hover:bg-zinc-800" disabled>Previous</Button>
                                    <Button variant="default" size="sm" className="h-8 px-3 w-8 rounded-none text-[11px] bg-[#00a65a] hover:bg-[#008d4c]">1</Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 rounded-none text-[11px] hover:bg-slate-50 dark:hover:bg-zinc-800" disabled>Next</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {location === "/posting-data/view-products" && (
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <div className="bg-white border-b px-6 py-3 flex items-center justify-between dark:bg-zinc-900">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">
                                SEARCH CATEGORY PRODUCTS <span className="text-rose-500 ml-1">{postingData.length}</span>
                            </h2>
                        </div>
                        <CardContent className="p-6">
                            <div className="flex flex-wrap items-end gap-4 p-4 rounded border border-slate-100 bg-slate-50/30 dark:border-zinc-800">
                                <div className="flex-1 min-w-[300px] space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Select Category</label>
                                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                        <SelectTrigger className="h-10 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                                            <SelectValue placeholder="Choose..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Categories ({postingData.length})</SelectItem>
                                            <SelectItem value="Leather products">Leather products ({getCount("Leather products")})</SelectItem>
                                            <SelectItem value="veterinary Instruments">veterinary Instruments ({getCount("veterinary Instruments")})</SelectItem>
                                            <SelectItem value="Apparel">Apparel ({getCount("Apparel")})</SelectItem>
                                            <SelectItem value="Costumes">Costumes ({getCount("Costumes")})</SelectItem>
                                            <SelectItem value="TV & Movie Costumes">TV & Movie Costumes ({getCount("TV & Movie Costumes")})</SelectItem>
                                            <SelectItem value="Reenactment Attire">Reenactment Attire ({getCount("Reenactment Attire")})</SelectItem>
                                            <SelectItem value="Mascot">Mascot ({getCount("Mascot")})</SelectItem>
                                            <SelectItem value="Anime Costumes">Anime Costumes ({getCount("Anime Costumes")})</SelectItem>
                                            <SelectItem value="Zentai / Catsuit">Zentai / Catsuit ({getCount("Zentai / Catsuit")})</SelectItem>
                                            <SelectItem value="Hunting Jacket">Hunting Jacket ({getCount("Hunting Jacket")})</SelectItem>
                                            <SelectItem value="Hunting Hoodies">Hunting Hoodies ({getCount("Hunting Hoodies")})</SelectItem>
                                            <SelectItem value="Hunting Suit">Hunting Suit ({getCount("Hunting Suit")})</SelectItem>
                                            <SelectItem value="Electronics">Electronics ({getCount("Electronics")})</SelectItem>
                                            <SelectItem value="Fashion">Fashion ({getCount("Fashion")})</SelectItem>
                                            <SelectItem value="Home & Garden">Home & Garden ({getCount("Home & Garden")})</SelectItem>
                                            <SelectItem value="Industrial">Industrial ({getCount("Industrial")})</SelectItem>
                                            <SelectItem value="Beauty">Beauty ({getCount("Beauty")})</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button 
                                    onClick={() => refetch()}
                                    className="h-10 px-10 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold uppercase tracking-wider shadow-sm"
                                >
                                    View
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <Card key={i} className="animate-pulse border-none shadow-sm">
                                    <div className="aspect-square bg-slate-200" />
                                    <CardContent className="p-4 space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                                    </CardContent>
                                </Card>
                            ))
                        ) : filteredData.length > 0 ? (
                            filteredData.map((item) => (
                                <Card key={item.id} className="group border-none shadow-sm hover:shadow-md transition-all overflow-hidden bg-white dark:bg-zinc-900">
                                    <div className="aspect-square relative bg-slate-100 overflow-hidden dark:bg-zinc-900">
                                        {item.mainImage ? (
                                            <img src={item.mainImage} alt={item.title || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                                <ImageIcon className="h-10 w-10" />
                                                <span className="text-[10px] font-bold uppercase">No Image</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2">
                                            <Badge className={item.status === 'Verified' ? 'bg-emerald-500' : 'bg-amber-500'}>
                                                {item.status}
                                            </Badge>
                                        </div>
                                    </div>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">{item.category}</p>
                                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-600 border-blue-100">
                                                {item.platform || "Amazon"}
                                            </Badge>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight h-9 dark:text-zinc-100">{item.title || "Untitled Product"}</h4>
                                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                                            <span className="text-[10px] text-slate-400 font-medium">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</span>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
                                                <PlusCircle className="h-4 w-4 text-slate-400" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center space-y-3">
                                <Search className="h-12 w-12 text-slate-200 mx-auto" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No products found for this category</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {location === "/posting-data/link-report" && (
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <div className="bg-white border-b px-6 py-3 items-center dark:bg-zinc-900">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">
                                LINK REPORT
                            </h2>
                        </div>
                        <CardContent className="p-6">
                            <div className="flex flex-wrap items-end gap-4 p-4 rounded border border-slate-100 bg-slate-50/30 dark:border-zinc-800">
                                <div className="flex-1 min-w-[300px] space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Select User</label>
                                    <Input
                                        className="h-10 bg-slate-50 border-slate-200 text-slate-600 font-medium opacity-100 cursor-not-allowed dark:bg-zinc-800/50 dark:border-zinc-800 dark:text-zinc-400"
                                        value={currentUser?.name || currentUser?.fullName || currentUser?.username || sessionStorage.getItem("userName") || "Loading..."}
                                        readOnly
                                        disabled
                                    />
                                </div>
                                <div className="flex-1 min-w-[180px] space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Start Date</label>
                                    <Input 
                                        type="date" 
                                        className="h-10 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 min-w-[180px] space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">End Date</label>
                                    <Input 
                                        type="date" 
                                        className="h-10 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                                <Button 
                                    onClick={() => refetchReport()}
                                    className="h-10 px-10 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold uppercase tracking-wider shadow-sm"
                                >
                                    View
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <CardContent className="p-0">
                            <div className="px-6 py-3 border-b">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-400">List</h3>
                            </div>
                            <Table>
                                <TableHeader className="bg-[#e9f7f0] dark:bg-zinc-900">
                                    <TableRow>
                                        <TableHead className="w-12 font-bold text-slate-700 dark:text-zinc-400">#</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">ID</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Links</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingReport ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" />
                                            </TableCell>
                                        </TableRow>
                                    ) : linkReportData.length > 0 ? (
                                        linkReportData.map((item, idx) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                <TableCell className="text-slate-500 font-medium dark:text-zinc-400">{idx + 1}</TableCell>
                                                <TableCell className="text-slate-500 text-xs font-mono dark:text-zinc-400">{item.id}</TableCell>
                                                <TableCell className="font-medium text-slate-800 dark:text-zinc-100">{item.title || "Example Company"}</TableCell>
                                                <TableCell className="text-slate-600 truncate max-w-[200px] dark:text-zinc-300">
                                                    {item.keywords ? (
                                                        <a href={item.keywords} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                                            {item.keywords}
                                                        </a>
                                                    ) : "http://example.com/posting-link"}
                                                </TableCell>
                                                <TableCell className="text-slate-500 text-sm dark:text-zinc-400">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB') : "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-slate-400 font-medium">
                                                No results found for the selected criteria
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}

            {location === "/posting-data/restricted-keywords" && (
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <div className="bg-white border-b px-6 py-4 dark:bg-zinc-900">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 dark:text-zinc-400">
                                RESTRICTED KEYWORDS / <span className="text-emerald-600">ADD KEYWORD</span>
                            </h2>
                        </div>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">Keyword</label>
                                    <Input 
                                        placeholder="add restricted keyword" 
                                        className="h-11 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800" 
                                        value={newRestrictedKeyword}
                                        onChange={(e) => setNewRestrictedKeyword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addRestrictedMutation.mutate(newRestrictedKeyword)}
                                    />
                                </div>
                                <Button 
                                    className="w-full h-11 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold uppercase tracking-widest shadow-md"
                                    onClick={() => addRestrictedMutation.mutate(newRestrictedKeyword)}
                                    disabled={addRestrictedMutation.isPending || !newRestrictedKeyword.trim()}
                                >
                                    {addRestrictedMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Submit"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pr-1">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                            Search:
                            <Input 
                                className="h-9 w-48 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800" 
                                value={restrictedSearch}
                                onChange={(e) => setRestrictedSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-[#f0f2f5] dark:bg-zinc-900">
                                    <TableRow className="border-b border-slate-100 dark:border-zinc-800">
                                        <TableHead className="w-16 font-bold text-slate-600 uppercase text-xs dark:text-zinc-300">No</TableHead>
                                        <TableHead className="font-bold text-slate-600 uppercase text-xs dark:text-zinc-300">Keyword</TableHead>
                                        <TableHead className="w-24 font-bold text-slate-600 uppercase text-xs text-center dark:text-zinc-300">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingRestricted ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-200" />
                                            </TableCell>
                                        </TableRow>
                                    ) : restrictedKeywords.filter((k: any) => k.keyword?.toLowerCase().includes(restrictedSearch.toLowerCase())).length > 0 ? (
                                        restrictedKeywords
                                            .filter((k: any) => k.keyword?.toLowerCase().includes(restrictedSearch.toLowerCase()))
                                            .map((item, idx) => (
                                                <TableRow key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 dark:border-zinc-800">
                                                    <TableCell className="text-sm font-medium text-slate-400">{idx + 1}</TableCell>
                                                    <TableCell className="text-sm font-semibold text-slate-700 uppercase tracking-tight dark:text-zinc-400">{item.keyword}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                                            onClick={() => deleteRestrictedMutation.mutate(item.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-12 text-slate-400 font-medium">
                                                No restricted keywords found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
            {location === "/posting-data/data-verify" && (
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
                        <div className="bg-white border-b px-6 py-4 flex items-center justify-between dark:bg-zinc-900">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">
                                PENDING DATA VERIFICATION
                            </h2>
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                {postingData.filter(d => d.status === 'Pending').length} Pending
                            </Badge>
                        </div>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="w-12 font-bold text-slate-700 dark:text-zinc-400">#</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Product</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Category</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Added Date</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" />
                                            </TableCell>
                                        </TableRow>
                                    ) : postingData.filter(d => d.status === 'Pending').length > 0 ? (
                                        postingData.filter(d => d.status === 'Pending').map((item, idx) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/30">
                                                <TableCell className="text-slate-500 font-medium dark:text-zinc-400">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 dark:text-zinc-100">{item.title}</span>
                                                        <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{item.keywords}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="capitalize text-slate-600 dark:text-zinc-300">{item.category}</TableCell>
                                                <TableCell className="text-slate-500 text-sm dark:text-zinc-400">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button 
                                                        size="sm"
                                                        onClick={() => statusMutation.mutate({ id: item.id, status: "Verified" })}
                                                        disabled={statusMutation.isPending}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-4"
                                                    >
                                                        {statusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-16 text-slate-400 font-medium">
                                                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-slate-200" />
                                                All data has been verified.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}

            {location !== "/posting-data/add-products" && location !== "/posting-data/add-keywords" && location !== "/posting-data/view-keywords" && location !== "/posting-data/view-products" && location !== "/posting-data/link-report" && location !== "/posting-data/restricted-keywords" && location !== "/posting-data/data-verify" && (
                <Tabs defaultValue="all" className="w-full">
                    <Card className="border-none shadow-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="border-b bg-white p-0 dark:bg-zinc-900">
                            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                                <TabsList className="bg-slate-100/80">
                                    <TabsTrigger value="all">All Products</TabsTrigger>
                                    <TabsTrigger value="verified">Verified</TabsTrigger>
                                    <TabsTrigger value="pending">Pending</TabsTrigger>
                                    <TabsTrigger value="keywords">Keywords</TabsTrigger>
                                </TabsList>

                                <div className="flex items-center gap-2 ml-auto">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input 
                                            placeholder="Search data..." 
                                            className="pl-9 h-10 w-64 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Button variant="outline" size="icon" className="h-10 w-10">
                                        <Filter className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <TabsContent value="all" className="m-0">
                                <Table>
                                    <TableHeader className="bg-slate-50/80">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-700 dark:text-zinc-400">ID</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Product Name</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Category</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Platform</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Date Added</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Status</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-12">
                                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                <TableCell className="text-slate-500 font-medium font-mono text-xs truncate max-w-[80px] dark:text-zinc-400">
                                                    {item.id}
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-800 dark:text-zinc-100">{item.title || "No Title"}</TableCell>
                                                <TableCell className="text-slate-600 capitalize dark:text-zinc-300">{item.category}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                                                        {item.platform || "N/A"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-slate-500 text-sm dark:text-zinc-400">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={item.status === 'Verified' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'}>
                                                        {item.status === 'Verified' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                                                        {item.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                                                        <FileText className="h-4 w-4 text-emerald-600" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {!isLoading && filteredData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-12">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Database className="h-8 w-8 text-slate-200" />
                                                        <p className="text-slate-400 font-medium">No posting data available</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="verified" className="m-0 p-12 text-center text-slate-400">
                                Verified records will appear here.
                            </TabsContent>
                            <TabsContent value="pending" className="m-0 p-12 text-center text-slate-400">
                                Records awaiting verification will appear here.
                            </TabsContent>
                            <TabsContent value="keywords" className="m-0 p-12 text-center text-slate-400">
                                Keyword optimization tools and data.
                            </TabsContent>
                        </CardContent>
                    </Card>
                </Tabs>
            )}
        </div>
    );
}

function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={className}>{children}</div>;
}
