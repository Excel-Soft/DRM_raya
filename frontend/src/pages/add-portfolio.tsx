import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";
import { PortfolioCategorySelect } from "@/lib/portfolio-category-select";

type PortfolioCategoryTree = {
    mainCategories: { id: string; name: string }[];
    subCategoriesByMainId: Record<string, { id: string; name: string }[]>;
};

export default function AddPortfolio() {
    const { toast } = useToast();
    const [keyword, setKeyword] = useState("");
    const [mainCategory, setMainCategory] = useState("");
    const [subCategory, setSubCategory] = useState("");
    const [serverLink, setServerLink] = useState("");
    
    // Real File objects — uploaded via multipart FormData and saved to disk by the server (see handleSave below).
    const [topHeaderImage, setTopHeaderImage] = useState<File | null>(null);
    const [bodyImage, setBodyImage] = useState<File | null>(null);
    const [fullImage, setFullImage] = useState<File | null>(null);
    const [sliders, setSliders] = useState<File[]>([]);

    const { data: categoryTree, isLoading: categoriesLoading } = useQuery<PortfolioCategoryTree>({
        queryKey: ["/api/portfolio/categories"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/portfolio/categories");
            if (!res.ok) throw new Error("Failed to load categories");
            return res.json();
        },
    });

    const subCategoryOptions = useMemo(() => {
        if (!categoryTree || !mainCategory) return [];
        return categoryTree.subCategoriesByMainId[mainCategory] ?? [];
    }, [categoryTree, mainCategory]);

    const createMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            // Uses apiRequest so the authenticated user's token/credentials are attached,
            // same as every other API call in the app. The server saves the images to disk
            // via multer (see server/portfolio-routes.ts) and returns the real stored URLs.
            const res = await apiRequest("POST", "/api/portfolio", formData);
            if (!res.ok) throw new Error("Failed to save portfolio");
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Portfolio Saved",
                description: "The portfolio item has been successfully added.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
            resetForm();
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const resetForm = () => {
        setKeyword("");
        setMainCategory("");
        setSubCategory("");
        setServerLink("");
        setTopHeaderImage(null);
        setBodyImage(null);
        setFullImage(null);
        setSliders([]);
    };

    const handleSave = () => {
        const mainName =
            categoryTree?.mainCategories.find((m) => m.id === mainCategory)?.name || "";
        const subName =
            subCategoryOptions.find((s) => s.id === subCategory)?.name || "";

        if (!mainName) {
            toast({
                title: "Validation",
                description: "Please select a main category.",
                variant: "destructive",
            });
            return;
        }
        if (subCategoryOptions.length > 0 && !subName) {
            toast({
                title: "Validation",
                description: "Please select a sub category.",
                variant: "destructive",
            });
            return;
        }

        const formData = new FormData();
        formData.append("keyword", keyword);
        formData.append("mainCategory", mainName);
        formData.append("subCategory", subName);
        formData.append("serverLink", serverLink);
        if (topHeaderImage) formData.append("topHeaderImage", topHeaderImage);
        if (bodyImage) formData.append("bodyImage", bodyImage);
        if (fullImage) formData.append("fullImage", fullImage);
        sliders.forEach((file, index) => {
            formData.append(`sliders`, file);
        });

        createMutation.mutate(formData);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSliders(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeSlider = (index: number) => {
        setSliders(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col gap-4 p-4 lg:p-6 bg-[#f4f7f6] min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="flex items-center gap-2 text-[14px] font-bold tracking-tight mb-2">
                <span className="text-gray-800 uppercase dark:text-zinc-100">ADD PORTFOLIO</span>
            </div>

            <Card className="shadow-none border border-gray-200 dark:border-zinc-800">
                <CardHeader className="bg-white border-b px-6 py-3 dark:bg-zinc-900">
                    <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Portfolio List</CardTitle>
                </CardHeader>
                <CardContent className="p-6 bg-white space-y-6 dark:bg-zinc-900">
                    {/* First Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Enter KeyWord (Just for Read)</Label>
                            <Input 
                                placeholder="Enter KeyWord" 
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="h-10 border-gray-200 focus:ring-[#00a65a] focus:border-[#00a65a] dark:border-zinc-800" 
                            />
                        </div>
                        <PortfolioCategorySelect
                            label="Main Category"
                            options={categoryTree?.mainCategories ?? []}
                            value={mainCategory}
                            disabled={categoriesLoading}
                            onChange={(id) => {
                                setMainCategory(id);
                                setSubCategory("");
                            }}
                        />
                        <PortfolioCategorySelect
                            label="Sub Category"
                            options={subCategoryOptions}
                            value={subCategory}
                            disabled={!mainCategory || subCategoryOptions.length === 0}
                            placeholder={
                                !mainCategory
                                  ? "Choose main category first"
                                  : subCategoryOptions.length === 0
                                    ? "No sub category"
                                    : "Choose..."
                            }
                            onChange={setSubCategory}
                        />
                    </div>

                    {/* Second Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Server Link</Label>
                            <Input 
                                placeholder="Link" 
                                value={serverLink}
                                onChange={(e) => setServerLink(e.target.value)}
                                className="h-10 border-gray-200 focus:ring-[#00a65a] focus:border-[#00a65a] dark:border-zinc-800" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Top Header Image</Label>
                            <div className="flex">
                                <label className="flex items-center justify-center px-4 h-10 bg-gray-100 border border-r-0 border-gray-200 rounded-l cursor-pointer hover:bg-gray-200 transition-colors dark:border-zinc-800 dark:bg-zinc-900">
                                    <span className="text-[12px] font-medium text-gray-500 dark:text-zinc-400">Choose file</span>
                                    <input type="file" className="hidden" onChange={(e) => setTopHeaderImage(e.target.files?.[0] || null)} />
                                </label>
                                <div className="flex-1 flex items-center px-3 h-10 border border-gray-200 rounded-r bg-white text-[12px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap dark:bg-zinc-900 dark:border-zinc-800">
                                    {topHeaderImage ? topHeaderImage.name : "No file chosen"}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Body Image</Label>
                            <div className="flex">
                                <label className="flex items-center justify-center px-4 h-10 bg-gray-100 border border-r-0 border-gray-200 rounded-l cursor-pointer hover:bg-gray-200 transition-colors dark:border-zinc-800 dark:bg-zinc-900">
                                    <span className="text-[12px] font-medium text-gray-500 dark:text-zinc-400">Choose file</span>
                                    <input type="file" className="hidden" onChange={(e) => setBodyImage(e.target.files?.[0] || null)} />
                                </label>
                                <div className="flex-1 flex items-center px-3 h-10 border border-gray-200 rounded-r bg-white text-[12px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap dark:bg-zinc-900 dark:border-zinc-800">
                                    {bodyImage ? bodyImage.name : "No file chosen"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Third Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Full Image</Label>
                            <div className="flex">
                                <label className="flex items-center justify-center px-4 h-10 bg-gray-100 border border-r-0 border-gray-200 rounded-l cursor-pointer hover:bg-gray-200 transition-colors dark:border-zinc-800 dark:bg-zinc-900">
                                    <span className="text-[12px] font-medium text-gray-500 dark:text-zinc-400">Choose file</span>
                                    <input type="file" className="hidden" onChange={(e) => setFullImage(e.target.files?.[0] || null)} />
                                </label>
                                <div className="flex-1 flex items-center px-3 h-10 border border-gray-200 rounded-r bg-white text-[12px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap dark:bg-zinc-900 dark:border-zinc-800">
                                    {fullImage ? fullImage.name : "No file chosen"}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Sliders (Select All)</Label>
                            <div className="flex">
                                <label className="flex items-center justify-center px-4 h-10 bg-gray-100 border border-r-0 border-gray-200 rounded-l cursor-pointer hover:bg-gray-200 transition-colors dark:border-zinc-800 dark:bg-zinc-900">
                                    <span className="text-[12px] font-medium text-gray-500 dark:text-zinc-400">Choose files</span>
                                    <input type="file" multiple className="hidden" onChange={handleSliderChange} />
                                </label>
                                <div className="flex-1 flex items-center px-3 h-10 border border-gray-200 rounded-r bg-white text-[12px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap dark:bg-zinc-900 dark:border-zinc-800">
                                    {sliders.length > 0 ? `${sliders.length} files chosen` : "No file chosen"}
                                </div>
                            </div>
                            {sliders.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {sliders.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded border text-[11px] text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">
                                            <span>{file.name}</span>
                                            <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeSlider(idx)} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Action */}
                    <div className="pt-4">
                        <Button 
                            className="w-full max-w-xs bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 uppercase"
                            onClick={handleSave}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

