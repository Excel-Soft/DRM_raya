"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { PORTFOLIO_VIEW } from "@/lib/navigation/portfolio-routes";
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { PORTFOLIO_MAIN_CATEGORIES, subCategoriesForMain } from "@/modules/portfolio/portfolio-data";
import { PortfolioNavTabs } from "@/modules/portfolio/portfolio-nav";
import {
  DrmSection,
  PortfolioFileField,
  PortfolioShell,
  drmFieldClass,
  portfolioSelectTriggerClass,
} from "@/modules/portfolio/portfolio-ui";

export function PortfolioAddView() {
  const { toast } = useToast();
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [mainCategory, setMainCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [serverLink, setServerLink] = useState("");
  const [topHeaderImage, setTopHeaderImage] = useState<File | null>(null);
  const [bodyImage, setBodyImage] = useState<File | null>(null);
  const [fullImage, setFullImage] = useState<File | null>(null);
  const [sliders, setSliders] = useState<File[]>([]);

  const subOptions = useMemo(() => subCategoriesForMain(mainCategory), [mainCategory]);

  useEffect(() => {
    if (subCategory && !subOptions.some((o) => o.value === subCategory)) {
      setSubCategory("");
    }
  }, [mainCategory, subCategory, subOptions]);

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

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiRequest("POST", "/api/portfolio", formData);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to save portfolio");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Portfolio saved",
        description: "Opening the design gallery…",
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      resetForm();
      router.push(PORTFOLIO_VIEW);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!keyword.trim() && !serverLink.trim()) {
      toast({
        title: "Missing details",
        description: "Enter a keyword or server link so the design can be identified in the gallery.",
        variant: "destructive",
      });
      return;
    }
    if (!mainCategory) {
      toast({ title: "Main category required", description: "Choose a main category.", variant: "destructive" });
      return;
    }
    if (!fullImage && !topHeaderImage && !bodyImage && sliders.length === 0) {
      toast({
        title: "Add at least one image",
        description: "Upload a full, header, body, or slider image.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("keyword", keyword.trim());
    formData.append("mainCategory", mainCategory);
    formData.append("subCategory", subCategory);
    formData.append("serverLink", serverLink.trim());
    if (topHeaderImage) formData.append("topHeaderImage", topHeaderImage);
    if (bodyImage) formData.append("bodyImage", bodyImage);
    if (fullImage) formData.append("fullImage", fullImage);
    sliders.forEach((file) => formData.append("sliders", file));
    createMutation.mutate(formData);
  };

  return (
    <PortfolioShell
      title="Add portfolio"
      description="Upload design assets and metadata. At least one image and a keyword or server link are required."
      actions={<PortfolioNavTabs />}
    >
      <DrmSection title="Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field id="portfolio-keyword" label="Keyword" hint="Shown as the card title when set">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. Sports wear blue"
              className={drmFieldClass}
            />
          </Field>
          <Field id="portfolio-main-category" label="Main category">
            <Select value={mainCategory} onValueChange={setMainCategory}>
              <SelectTrigger className={portfolioSelectTriggerClass()}>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {PORTFOLIO_MAIN_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="portfolio-sub-category" label="Sub category">
            <Select value={subCategory} onValueChange={setSubCategory} disabled={!mainCategory}>
              <SelectTrigger className={portfolioSelectTriggerClass()}>
                <SelectValue placeholder={mainCategory ? "Choose…" : "Pick main category first"} />
              </SelectTrigger>
              <SelectContent>
                {subOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="portfolio-server-link" label="Server / live link" hint="Used as title fallback and preview link">
            <Input
              value={serverLink}
              onChange={(e) => setServerLink(e.target.value)}
              placeholder="https://example.com"
              className={drmFieldClass}
            />
          </Field>
        </div>
      </DrmSection>

      <DrmSection title="Images">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PortfolioFileField
            label="Full preview (gallery thumbnail)"
            filesLabel={fullImage?.name ?? "No file chosen"}
            onChange={(files) => setFullImage(files?.[0] ?? null)}
          />
          <PortfolioFileField
            label="Top header"
            filesLabel={topHeaderImage?.name ?? "No file chosen"}
            onChange={(files) => setTopHeaderImage(files?.[0] ?? null)}
          />
          <PortfolioFileField
            label="Body"
            filesLabel={bodyImage?.name ?? "No file chosen"}
            onChange={(files) => setBodyImage(files?.[0] ?? null)}
          />
        </div>
        <div className="mt-4 max-w-xl">
          <PortfolioFileField
            label="Sliders (optional, multiple)"
            multiple
            filesLabel={sliders.length > 0 ? `${sliders.length} file(s)` : "No files chosen"}
            onChange={(files) => {
              if (files?.length) setSliders((prev) => [...prev, ...Array.from(files)]);
            }}
          />
          {sliders.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              {sliders.map((file, idx) => (
                <li key={`${file.name}-${idx}`} className="rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                  {file.name}{" "}
                  <button type="button" className="text-red-600 hover:underline" onClick={() => setSliders((p) => p.filter((_, i) => i !== idx))}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrmSection>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" className="h-10" onClick={resetForm} disabled={createMutation.isPending}>
          Reset form
        </Button>
        <Button
          type="button"
          className="h-11 min-w-[200px] bg-emerald-600 font-semibold uppercase hover:bg-emerald-700"
          onClick={handleSave}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Save portfolio
        </Button>
      </div>
    </PortfolioShell>
  );
}
