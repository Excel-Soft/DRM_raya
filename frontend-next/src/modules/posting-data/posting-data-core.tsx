"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Upload, Loader2, Image as ImageIcon, PlusCircle, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/legacy/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query/query-client";
import {
  DrmFormActions,
  DrmSection,
  drmFieldClass,
  pdSelectTriggerClass,
  PdFormGrid,
  PdStatTile,
} from "@/modules/posting-data/posting-data-ui";
type InsertProductPostingData = {
  category?: string;
  title?: string;
  keywords?: string;
  description?: string;
  status?: string;
  platform?: string;
};

type PostingRow = {
  id: string | number;
  category?: string;
  title?: string;
  keywords?: string;
  description?: string;
  status?: string;
  platform?: string;
  createdAt?: string;
  remaining?: number;
  mainImage?: string;
};

export type PostingDataScreen =
  | "add-products"
  | "add-keywords"
  | "view-keywords"
  | "view-products"
  | "data-verify"
  | "link-report"
  | "restricted-keywords";

export function PostingDataCore({ screen }: { screen: PostingDataScreen }) {
    const queryClient = useQueryClient();
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
    const { data: postingData = [], isLoading, refetch } = useQuery<PostingRow[]>({
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

    const verifiedPct =
        postingData.length > 0
            ? Math.round((postingData.filter((d) => d.status === "Verified").length / postingData.length) * 100)
            : 0;
    const pendingCount = postingData.filter((d) => d.status === "Pending").length;

    const restrictedFiltered = useMemo(
        () =>
            restrictedKeywords.filter((k: { keyword?: string; id: string }) =>
                k.keyword?.toLowerCase().includes(restrictedSearch.toLowerCase()),
            ),
        [restrictedKeywords, restrictedSearch],
    );

    const pendingRows = useMemo(() => postingData.filter((d) => d.status === "Pending"), [postingData]);

    const keywordTableRows = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return postingData.filter(
            (d) =>
                !q ||
                d.title?.toLowerCase().includes(q) ||
                d.keywords?.toLowerCase().includes(q) ||
                d.description?.toLowerCase().includes(q),
        );
    }, [postingData, searchTerm]);

    const keywordColumns = useMemo((): DataTableColumn<PostingRow>[] => {
        return [
            { id: "n", header: "#", cell: (row) => <span className="tabular-nums text-zinc-500">{row.id}</span>, className: "w-12" },
            { id: "title", header: "Title", cell: (row) => <span className="font-medium">{row.title}</span> },
            { id: "kw", header: "Keywords", cell: (row) => <span className="max-w-[200px] truncate">{row.keywords || "—"}</span> },
            { id: "desc", header: "Description", cell: (row) => <span className="max-w-[280px] truncate text-zinc-600 dark:text-zinc-400">{row.description || "—"}</span> },
            {
                id: "date",
                header: "Date",
                cell: (row) => (
                    <span className="whitespace-nowrap text-sm text-zinc-500">
                        {row.createdAt
                            ? new Date(row.createdAt)
                                  .toLocaleString("en-GB", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                  })
                                  .replace(",", "")
                            : "—"}
                    </span>
                ),
            },
        ];
    }, []);

    const verifyColumns = useMemo((): DataTableColumn<PostingRow>[] => {
        return [
            { id: "n", header: "#", cell: (row) => <span className="tabular-nums text-zinc-500">{row.id}</span>, className: "w-12" },
            {
                id: "product",
                header: "Product",
                cell: (row) => (
                    <div>
                        <div className="font-medium">{row.title}</div>
                        {row.keywords ? <div className="truncate text-xs text-zinc-500">{row.keywords}</div> : null}
                    </div>
                ),
            },
            { id: "cat", header: "Category", cell: (row) => row.category || "—" },
            {
                id: "added",
                header: "Added",
                cell: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"),
            },
            {
                id: "actions",
                header: "Actions",
                headerClassName: "text-right",
                className: "text-right",
                cell: (row) => (
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: row.id, status: "Verified" })}
                    >
                        {statusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                    </Button>
                ),
            },
        ];
    }, [statusMutation.isPending]);

    const restrictedColumns = useMemo((): DataTableColumn<{ id: string; keyword?: string }>[] => {
        return [
            { id: "n", header: "#", cell: (row) => <span className="tabular-nums text-zinc-500">{row.id}</span>, className: "w-12" },
            { id: "kw", header: "Keyword", cell: (row) => <span className="font-medium uppercase">{row.keyword}</span> },
            {
                id: "actions",
                header: "Actions",
                headerClassName: "text-right",
                className: "text-right",
                cell: (row) => (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400"
                        title="Remove"
                        onClick={() => deleteRestrictedMutation.mutate(row.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                ),
            },
        ];
    }, [deleteRestrictedMutation]);

    const fileInputClass = cn(
        drmFieldClass,
        "file:mr-3 file:h-full file:border-0 file:border-r file:border-zinc-200 file:bg-zinc-100 file:px-3 file:text-sm dark:file:border-zinc-700 dark:file:bg-zinc-800",
    );

    return (
        <div className="space-y-4">
            {screen === "add-products" && (
                <>
                    <DrmSection title="Product upload" description="Choose category and attach product images.">
                        <PdFormGrid cols={4}>
                            <Field id="pd-prod-cat" label="Category">
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className={pdSelectTriggerClass}>
                                        <SelectValue placeholder="Choose category" />
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
                            </Field>
                            <Field id="pd-main-img" label="Main image">
                                <Input type="file" className={fileInputClass} />
                            </Field>
                            <Field id="pd-other-img" label="Other views">
                                <Input type="file" multiple className={fileInputClass} />
                            </Field>
                        </PdFormGrid>
                        <DrmFormActions>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={saveMutation.isPending}
                                onClick={() => {
                                    if (!category) {
                                        toast({ title: "Error", description: "Category is required.", variant: "destructive" });
                                        return;
                                    }
                                    saveMutation.mutate({
                                        category,
                                        title: "Product Image Upload",
                                        status: "Pending",
                                        platform: "Web UI",
                                    });
                                }}
                            >
                                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save
                            </Button>
                        </DrmFormActions>
                    </DrmSection>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <PdStatTile label="Total products" value={postingData.length} />
                        <PdStatTile label="Verified" value={`${verifiedPct}%`} />
                        <PdStatTile label="Pending" value={pendingCount} />
                    </div>
                </>
            )}

            {screen === "add-keywords" && (
                    <DrmSection
                        title="Post keyword data"
                        description="Add keywords manually or import from CSV."
                        actions={
                            <div className="flex flex-wrap gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept=".csv"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleImportClick}
                                    disabled={importMutation.isPending}
                                >
                                    {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Import
                                </Button>
                                <Button type="button" variant="secondary" size="sm" onClick={handleDownloadTemplate}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Template
                                </Button>
                            </div>
                        }
                    >
                        <PdFormGrid cols={3}>
                            <Field id="pd-kw-cat" label="Category">
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className={pdSelectTriggerClass}>
                                        <SelectValue placeholder="Choose …" />
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
                            </Field>
                            <Field id="pd-kw-title" label="Title">
                                <Input
                                    className={drmFieldClass}
                                    placeholder="Enter title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </Field>
                            <Field id="pd-kw-keywords" label="Keywords">
                                <Input
                                    className={drmFieldClass}
                                    placeholder="Enter keywords"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                />
                            </Field>
                        </PdFormGrid>
                        <Field id="pd-kw-desc" label="Description" className="mt-4">
                            <Textarea
                                className={cn(drmFieldClass, "min-h-[160px] resize-y")}
                                placeholder="Enter description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </Field>
                        <DrmFormActions>
                            <Button type="button" variant="primary" size="sm" onClick={handleSaveKeyword} disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save
                            </Button>
                        </DrmFormActions>
                    </DrmSection>
            )}

            {screen === "view-keywords" && (
                <>
                    <DrmSection title="Search filters" description="Filter keywords by category and date.">
                        <PdFormGrid cols={4}>
                            <Field id="pd-vk-cat" label="Category">
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className={pdSelectTriggerClass}>
                                        <SelectValue placeholder="All categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All categories</SelectItem>
                                        <SelectItem value="electronics">Electronics</SelectItem>
                                        <SelectItem value="clothing">Clothing</SelectItem>
                                        <SelectItem value="home">Home & Garden</SelectItem>
                                        <SelectItem value="industrial">Industrial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field id="pd-vk-start" label="Start date">
                                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={drmFieldClass} />
                            </Field>
                            <Field id="pd-vk-end" label="End date">
                                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={drmFieldClass} />
                            </Field>
                            <div className="flex items-end">
                                <Button type="button" variant="primary" size="sm" onClick={() => refetch()}>
                                    View
                                </Button>
                            </div>
                        </PdFormGrid>
                    </DrmSection>
                    <DrmSection
                        title="Keyword records"
                        description={isLoading ? "Loading…" : `${keywordTableRows.length} record(s)`}
                        actions={
                            <Input
                                placeholder="Search…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`${drmFieldClass} h-9 w-48`}
                            />
                        }
                    >
                        <DataTable
                            columns={keywordColumns}
                            rows={keywordTableRows}
                            rowKey={(row) => String(row.id)}
                            loading={isLoading}
                            emptyMessage="No records found for this filter."
                            className="min-w-[720px]"
                        />
                    </DrmSection>
                </>
            )}

            {screen === "view-products" && (
                <>
                    <DrmSection
                        title="Category search"
                        description={`${postingData.length} product(s) in database`}
                    >
                        <PdFormGrid cols={4}>
                            <Field id="pd-vp-cat" label="Category" className="md:col-span-2">
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className={pdSelectTriggerClass}>
                                        <SelectValue placeholder="Choose category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All categories ({postingData.length})</SelectItem>
                                        <SelectItem value="Leather products">Leather products ({getCount("Leather products")})</SelectItem>
                                        <SelectItem value="veterinary Instruments">veterinary Instruments ({getCount("veterinary Instruments")})</SelectItem>
                                        <SelectItem value="Apparel">Apparel ({getCount("Apparel")})</SelectItem>
                                        <SelectItem value="Costumes">Costumes ({getCount("Costumes")})</SelectItem>
                                        <SelectItem value="Electronics">Electronics ({getCount("Electronics")})</SelectItem>
                                        <SelectItem value="Fashion">Fashion ({getCount("Fashion")})</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <div className="flex items-end">
                                <Button type="button" variant="primary" size="sm" onClick={() => refetch()}>
                                    View
                                </Button>
                            </div>
                        </PdFormGrid>
                    </DrmSection>
                    <DrmSection title="Products" description={isLoading ? "Loading…" : `${filteredData.length} shown`}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50" />
                            ))
                        ) : filteredData.length > 0 ? (
                            filteredData.map((item) => (
                                <div key={item.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                                    <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-950">
                                        {item.mainImage ? (
                                            <img src={item.mainImage} alt={item.title || ""} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
                                                <ImageIcon className="h-8 w-8" />
                                                <span className="text-xs font-medium">No image</span>
                                            </div>
                                        )}
                                        <Badge variant={item.status === "Verified" ? "success" : "warning"} className="absolute right-2 top-2">
                                            {item.status}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2 p-3">
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-medium uppercase text-emerald-700 dark:text-emerald-400">{item.category}</span>
                                            <Badge variant="neutral">{item.platform || "Web UI"}</Badge>
                                        </div>
                                        <h4 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title || "Untitled product"}</h4>
                                        <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
                                            <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</span>
                                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                <PlusCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-16 text-center text-sm text-zinc-500">
                                <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
                                No products found for this category.
                            </div>
                        )}
                        </div>
                    </DrmSection>
                </>
            )}

            {screen === "restricted-keywords" && (
                <>
                    <DrmSection title="Add restricted keyword" description="Blocked keywords are rejected during posting.">
                        <Field id="pd-rk-new" label="Keyword">
                            <Input
                                placeholder="Add restricted keyword"
                                value={newRestrictedKeyword}
                                onChange={(e) => setNewRestrictedKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addRestrictedMutation.mutate(newRestrictedKeyword)}
                                className={drmFieldClass}
                            />
                        </Field>
                        <DrmFormActions>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => addRestrictedMutation.mutate(newRestrictedKeyword)}
                                disabled={addRestrictedMutation.isPending || !newRestrictedKeyword.trim()}
                            >
                                {addRestrictedMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Submit
                            </Button>
                        </DrmFormActions>
                    </DrmSection>
                    <DrmSection
                        title="Restricted list"
                        description={loadingRestricted ? "Loading…" : `${restrictedFiltered.length} keyword(s)`}
                        actions={
                            <Input
                                placeholder="Search…"
                                value={restrictedSearch}
                                onChange={(e) => setRestrictedSearch(e.target.value)}
                                className={`${drmFieldClass} h-9 w-48`}
                            />
                        }
                    >
                        <DataTable
                            columns={restrictedColumns}
                            rows={restrictedFiltered}
                            rowKey={(row) => row.id}
                            loading={loadingRestricted}
                            emptyMessage="No restricted keywords found."
                            className="min-w-[480px]"
                        />
                    </DrmSection>
                </>
            )}

            {screen === "data-verify" && (
                <DrmSection
                    title="Pending verification"
                    description={`${pendingRows.length} record(s) awaiting approval`}
                    actions={<Badge variant="warning">{pendingCount} pending</Badge>}
                >
                    <DataTable
                        columns={verifyColumns}
                        rows={pendingRows}
                        rowKey={(row) => String(row.id)}
                        loading={isLoading}
                        emptyMessage="All data has been verified."
                        className="min-w-[640px]"
                    />
                </DrmSection>
            )}

        </div>
    );
}
