"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Loader2, Play, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageEmpty, PageError, PageForbidden, PageLoading } from "@/components/ui/page-states";
import { cn } from "@/lib/utils/cn";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { DrmSection, fmtTrainingDate, TrainingShell } from "@/modules/training/training-ui";

type TrainingSubcategory = {
  id: string;
  title: string;
  status: string;
  thumbnailUrl?: string | null;
  date?: string;
  videoCount?: number;
};

type TrainingCategory = {
  id: string;
  title: string;
  status: string;
  thumbnailUrl?: string | null;
  date?: string;
  subcategoryCount?: number;
  subcategories: TrainingSubcategory[];
};

type TrainingTreeResponse = {
  categories: TrainingCategory[];
};

type TrainingVideo = {
  id: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  durationSeconds?: number | null;
  publishedAt?: string | null;
};

type TrainingVideosResponse = {
  videos: TrainingVideo[];
};

function Thumbnail({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (src) {
    return <img src={src} alt={alt} className={cn("rounded-lg border border-zinc-200 object-cover dark:border-zinc-700", className)} />;
  }
  return <div className={cn("rounded-lg bg-zinc-100 dark:bg-zinc-800", className)} aria-hidden />;
}

export function TrainingView() {
  const { data, loading, error, forbidden, refetch } = useApiResource<TrainingTreeResponse>("/api/training/tree");
  const categories = data?.categories ?? [];

  const [selectedSub, setSelectedSub] = useState<TrainingSubcategory | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);

  const videosPath = selectedSub?.id ? `/api/training/subcategories/${selectedSub.id}/videos` : null;
  const {
    data: videosData,
    loading: videosLoading,
    error: videosError,
    refetch: refetchVideos,
  } = useApiResource<TrainingVideosResponse>(videosPath);

  const stats = useMemo(() => {
    const subs = categories.reduce((n, c) => n + (c.subcategories?.length ?? 0), 0);
    return { categories: categories.length, subs };
  }, [categories]);

  useEffect(() => {
    if (selectedSub || categories.length === 0) return;
    for (const cat of categories) {
      const first = cat.subcategories?.[0];
      if (first) {
        setSelectedSub(first);
        break;
      }
    }
  }, [categories, selectedSub]);

  useEffect(() => {
    const first = videosData?.videos?.[0];
    setSelectedVideo(first ?? null);
  }, [videosData, selectedSub?.id]);

  if (forbidden) {
    return (
      <TrainingShell description="Training videos and categories">
        <PageForbidden message="You do not have permission to view training content." />
      </TrainingShell>
    );
  }

  if (loading) {
    return (
      <TrainingShell description="Training videos and categories">
        <PageLoading label="Loading training catalog…" />
      </TrainingShell>
    );
  }

  if (error) {
    return (
      <TrainingShell description="Training videos and categories">
        <PageError message={error} onRetry={refetch} />
      </TrainingShell>
    );
  }

  return (
    <TrainingShell
      description="Browse categories, pick a subcategory, and watch assigned videos."
      actions={
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {stats.categories} categories · {stats.subs} subcategories
        </span>
      }
    >
      {categories.length === 0 ? (
        <PageEmpty message="No training categories available." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <DrmSection title="Categories" description="Select a subcategory to load videos">
            <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto pr-1">
              {categories.map((category) => (
                <div key={category.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <Thumbnail src={category.thumbnailUrl} alt="" className="h-12 w-20 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{category.title}</p>
                        <Badge variant="brand" className="normal-case">
                          {category.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {fmtTrainingDate(category.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3.5 w-3.5" />
                          {category.subcategoryCount ?? category.subcategories.length} subcategories
                        </span>
                      </div>
                    </div>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {category.subcategories.map((sub) => {
                      const active = selectedSub?.id === sub.id;
                      return (
                        <li key={sub.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedSub(sub)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                              active
                                ? "bg-emerald-50/80 dark:bg-emerald-950/30"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40",
                            )}
                          >
                            <Thumbnail src={sub.thumbnailUrl} alt="" className="h-11 w-11 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">{sub.title}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                <Badge variant={sub.status === "Active" ? "success" : "neutral"} className="normal-case">
                                  {sub.status}
                                </Badge>
                                <span>{fmtTrainingDate(sub.date)}</span>
                                <span className="tabular-nums">{sub.videoCount ?? 0} videos</span>
                              </div>
                            </div>
                            <ChevronRight className={cn("h-4 w-4 shrink-0", active ? "text-emerald-700" : "text-zinc-400")} />
                          </button>
                        </li>
                      );
                    })}
                    {category.subcategories.length === 0 ? (
                      <li className="px-4 py-3 text-xs text-zinc-500">No subcategories.</li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
          </DrmSection>

          <DrmSection
            title={selectedSub ? selectedSub.title : "Video player"}
            description={selectedSub ? "Watch training videos for this subcategory" : "Choose a subcategory on the left"}
          >
            {!selectedSub ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-center text-zinc-500">
                <Video className="h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Select a subcategory</p>
                <p className="text-xs">Videos will appear here.</p>
              </div>
            ) : videosLoading ? (
              <div className="flex min-h-[360px] items-center justify-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                Loading videos…
              </div>
            ) : videosError ? (
              <PageError message={videosError} onRetry={refetchVideos} />
            ) : (videosData?.videos?.length ?? 0) === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-center">
                <Video className="h-10 w-10 text-zinc-300" />
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{selectedSub.title}</p>
                <p className="text-sm text-zinc-500">No videos published yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-800">
                  {selectedVideo ? (
                    <video key={selectedVideo.id} controls className="aspect-video w-full" src={selectedVideo.videoUrl}>
                      Your browser does not support video playback.
                    </video>
                  ) : null}
                </div>
                {selectedVideo ? (
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedVideo.title}</p>
                    {selectedVideo.description ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{selectedVideo.description}</p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {videosData?.videos?.map((video) => (
                    <Button
                      key={video.id}
                      type="button"
                      size="sm"
                      variant={selectedVideo?.id === video.id ? "primary" : "secondary"}
                      onClick={() => setSelectedVideo(video)}
                    >
                      <Play className="h-4 w-4" />
                      {video.title}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </DrmSection>
        </div>
      )}
    </TrainingShell>
  );
}
