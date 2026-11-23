// View Products — the posting-product catalogue (legacy view-posting-product).
// One card per product: main image + its small views, numbered like legacy.
// Loaded lazily: 20 per batch, more as you scroll.
// Categories come with real names and counts (Restricted 987 / Trash 988 hidden),
// searchable. Images are served through
// /api/legacy-assets/posting-data (https-safe proxy of the legacy files).
import { useEffect, useRef, useState } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Download, Image as ImageIcon, Loader2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, extractApiError } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface CategoryOption { value: string; label: string; count: number }
interface Product {
  id: string;
  category: string;
  categoryName: string;
  mainImage: string | null;
  images: string[];
  createdAt: string | null;
  fromCategoryName?: string | null;
}

/** active = View Products; restricted / trash = Restricted (987) / Trash (988) Products pages. */
export type ProductScope = "active" | "restricted" | "trash";
const SCOPE_TITLE: Record<ProductScope, string> = {
  active: "SEARCH CATEGORY PRODUCTS",
  restricted: "RESTRICTED PRODUCTS",
  trash: "TRASH PRODUCTS",
};

export const legacyImageUrl = (file: string) => `/api/legacy-assets/posting-data?f=${encodeURIComponent(file)}`;

function Thumb({ file, className }: { file: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-100 text-slate-300 dark:bg-zinc-800", className)}>
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <a href={legacyImageUrl(file)} target="_blank" rel="noreferrer" title={file}>
      <img
        src={legacyImageUrl(file)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("object-contain bg-white", className)}
      />
    </a>
  );
}

export function LegacyProductCatalog({ scope = "active" }: { scope?: ProductScope }) {
  const isBin = scope !== "active";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [category, setCategory] = useState("all"); // chosen in the dropdown
  const [applied, setApplied] = useState("all"); // shown (legacy: after "View")
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<"restricted" | "trash" | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: catData } = useQuery<{ total: number; categories: CategoryOption[] }>({
    queryKey: ["/api/posting-data/product-categories"],
    queryFn: () => apiRequestJson("GET", "/api/posting-data/product-categories"),
    enabled: !isBin,
  });
  const categories = catData?.categories ?? [];
  const total = catData?.total ?? 0;

  // Lazy loading: 20 products per batch, next batch fetched when the sentinel scrolls into view.
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery<{ total: number; data: Product[] }>({
    queryKey: ["/api/posting-data/products", scope, applied],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequestJson(
        "GET",
        `/api/posting-data/products?scope=${scope}&category=${encodeURIComponent(isBin ? "all" : applied)}&page=${pageParam}&pageSize=${PAGE_SIZE}`,
      ),
    getNextPageParam: (last, pages) =>
      pages.length * PAGE_SIZE < (last?.total ?? 0) ? pages.length + 1 : undefined,
  });
  const products = data?.pages.flatMap((p) => p.data) ?? [];
  const matchTotal = data?.pages[0]?.total ?? 0;

  // Selection is per category view; a new View clears it.
  useEffect(() => setSelected(new Set()), [applied]);
  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const toggleAll = (on: boolean) => setSelected(on ? new Set(products.map((p) => p.id)) : new Set());
  const toggleOne = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const moveMutation = useMutation({
    mutationFn: (target: "restricted" | "trash") =>
      apiRequestJson("POST", "/api/posting-data/products/move", { ids: Array.from(selected), target }),
    onSuccess: (res: any, target) => {
      toast({
        title: `Moved ${res?.moved ?? 0} product(s)`,
        description: target === "trash" ? "Moved to Trash Products" : "Moved to Restricted Products",
      });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/posting-data/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posting-data/product-categories"] });
    },
    onError: (err: any) => toast({ title: "Move failed", description: err?.message || "Please try again", variant: "destructive" }),
  });

  const MAX_ZIP = 300; // backend limit per download
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/posting-data/products/download", { ids: Array.from(selected) });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(extractApiError(body, res.status));
      }
      const missing = Number(res.headers.get("X-Missing-Files") || 0);
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "products.zip";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return missing;
    },
    onSuccess: (missing) =>
      toast({
        title: "Zip downloaded",
        description: missing > 0 ? `${missing} image(s) could not be fetched from the old server and were skipped.` : undefined,
      }),
    onError: (err: any) => toast({ title: "Download failed", description: err?.message || "Please try again", variant: "destructive" }),
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, products.length]);

  const selectedLabel =
    category === "all"
      ? `All Categories (${total})`
      : (() => {
          const c = categories.find((x) => x.value === category);
          return c ? `${c.label} (${c.count})` : "Choose...";
        })();

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-lg dark:bg-zinc-900">
        <div className="bg-white border-b px-6 py-3 dark:bg-zinc-900">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">
            {SCOPE_TITLE[scope]}{" "}
            <span className="text-rose-500 ml-1">{(isBin ? matchTotal : total).toLocaleString()}</span>
          </h2>
        </div>
        {!isBin && (
        <CardContent className="p-6">
          <div className="flex flex-wrap items-end gap-4 p-4 rounded border border-slate-100 bg-slate-50/30 dark:border-zinc-800">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 dark:text-zinc-400">
                Select Category
              </label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="w-full h-10 justify-between font-normal bg-white dark:bg-zinc-900"
                  >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search category..." />
                    <CommandList className="max-h-80">
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value={`__all__ All Categories`} onSelect={() => { setCategory("all"); setPickerOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", category === "all" ? "opacity-100" : "opacity-0")} />
                          All Categories ({total})
                        </CommandItem>
                        {categories.map((c) => (
                          <CommandItem
                            key={c.value}
                            value={`${c.label} ${c.value}`}
                            onSelect={() => { setCategory(c.value); setPickerOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", category === c.value ? "opacity-100" : "opacity-0")} />
                            {c.label} ({c.count})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <Button
              onClick={() => setApplied(category)}
              className="h-10 px-10 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold uppercase tracking-wider shadow-sm"
            >
              View
            </Button>
          </div>
        </CardContent>
        )}
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center">
          <Search className="h-10 w-10 mx-auto text-slate-200 mb-3" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isBin ? "No products here" : "No products found for this category"}</p>
        </div>
      ) : (
        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-lg font-bold text-slate-700 dark:text-zinc-200 cursor-pointer select-none">
                Select All
                <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(v === true)} className="h-5 w-5" />
              </label>
              {scope !== "restricted" && (
              <Button
                disabled={selected.size === 0 || moveMutation.isPending}
                onClick={() => setConfirmTarget("restricted")}
                className="bg-[#3a8a4f] hover:bg-[#2f7341] text-white"
              >
                Move To Restricted Products
              </Button>
              )}
              {scope !== "trash" && (
              <Button
                disabled={selected.size === 0 || moveMutation.isPending}
                onClick={() => setConfirmTarget("trash")}
                className="bg-[#60a5fa] hover:bg-[#3b82f6] text-white"
              >
                Move To Trash
              </Button>
              )}
              <Button
                variant="outline"
                disabled={selected.size === 0 || selected.size > MAX_ZIP || downloadMutation.isPending}
                title={selected.size > MAX_ZIP ? `Select at most ${MAX_ZIP} products per zip` : undefined}
                onClick={() => downloadMutation.mutate()}
              >
                {downloadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {downloadMutation.isPending ? "Preparing zip..." : "Download Zip"}
              </Button>
              {selected.size > 0 && (
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  {selected.size} selected{selected.size > MAX_ZIP ? ` (zip max ${MAX_ZIP})` : ""}
                </span>
              )}
              {moveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {products.map((p, idx) => (
                <div key={p.id} className="flex flex-col">
                  <div className="aspect-square border border-slate-100 rounded overflow-hidden dark:border-zinc-800">
                    {p.mainImage ? (
                      <Thumb file={p.mainImage} className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="h-8 w-8" /></div>
                    )}
                  </div>
                  {p.images.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.images.map((img) => (
                        <Thumb key={img} file={img} className="h-7 w-7 border border-slate-100 rounded dark:border-zinc-800" />
                      ))}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => toggleOne(p.id, v === true)} />
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">{idx + 1}</span>
                    </label>
                    {isBin ? (
                      p.fromCategoryName && (
                        <span className="truncate ml-2" title={`Moved from ${p.fromCategoryName}`}>from {p.fromCategoryName}</span>
                      )
                    ) : (
                      applied === "all" && <span className="truncate ml-2" title={p.categoryName}>{p.categoryName}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div ref={sentinelRef} className="mt-6 flex flex-col items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
              {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-slate-300" />}
              <div>
                Showing {products.length.toLocaleString()} of {matchTotal.toLocaleString()} products
              </div>
              {hasNextPage && !isFetchingNextPage && (
                <Button variant="outline" size="sm" className="h-8 px-4" onClick={() => fetchNextPage()}>Load more</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmTarget !== null} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget === "trash" ? "Move to Trash?" : "Move to Restricted Products?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} selected product(s) will be moved to{" "}
              {confirmTarget === "trash" ? "Trash Products" : "Restricted Products"} and removed from this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmTarget) moveMutation.mutate(confirmTarget); setConfirmTarget(null); }}
            >
              Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
