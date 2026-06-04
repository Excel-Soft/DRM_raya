import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { CalendarDays, ChevronRight, Loader2, Play, Video as VideoIcon } from "lucide-react";

type TrainingSubcategory = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  status: string;
  date?: string;
  videoCount?: number;
};

type TrainingCategory = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  status: string;
  date?: string;
  subcategoryCount?: number;
  subcategories: TrainingSubcategory[];
};

type TrainingVideo = {
  id: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  durationSeconds?: number | null;
  publishedAt?: string | null;
};

export default function TrainingCenter() {
  const [selectedSub, setSelectedSub] = useState<TrainingSubcategory | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);

  const { data: tree, isLoading: treeLoading } = useQuery<{ categories: TrainingCategory[] }>({
    queryKey: ["/api/training/tree"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/training/tree");
      return res.json();
    },
  });

  const { data: videosData, isLoading: videosLoading } = useQuery<{ videos: TrainingVideo[] }>({
    queryKey: ["/api/training/subcategories", selectedSub?.id, "videos"],
    enabled: Boolean(selectedSub?.id),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/training/subcategories/${selectedSub?.id}/videos`);
      return res.json();
    },
  });

  const categories = tree?.categories ?? [];

  // Initialize selection when data arrives
  useEffect(() => {
    if (!selectedSub && categories.length > 0) {
      const first = categories[0].subcategories[0];
      if (first) setSelectedSub(first);
    }
  }, [categories, selectedSub]);

  // Pick first video when subcategory changes or new data loads
  useEffect(() => {
    const firstVideo = videosData?.videos?.[0];
    if (firstVideo) {
      setSelectedVideo(firstVideo);
    } else {
      setSelectedVideo(null);
    }
  }, [videosData, selectedSub]);

  return (
    <div className="flex-1 overflow-auto bg-muted/40 p-6" data-testid="page-training-center">
      <div className="mb-4">
        <h1 className="text-2xl font-bold uppercase tracking-tight">Training Video</h1>
        <p className="text-sm text-muted-foreground">Categories &amp; Sub Categories</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,1.3fr]">
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Categories &amp; Sub Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {treeLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading training catalog...
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No training categories available.</p>
            ) : (
              categories.map((category) => (
                <div key={category.id} className="rounded-lg bg-card shadow-sm border border-border">
                  <div className="flex items-start gap-3 border-b border-border px-4 py-3">
                    {category.thumbnailUrl ? (
                      <img
                        src={category.thumbnailUrl}
                        alt={category.title}
                        className="h-12 w-20 rounded object-cover shadow-xs"
                      />
                    ) : (
                      <div className="h-12 w-20 rounded bg-muted" />
                    )}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{category.title}</p>
                        <Badge
                          variant="outline"
                          className="bg-emerald-100 text-emerald-700"
                        >
                          {category.status}
                        </Badge>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <CalendarDays className="mr-1 h-4 w-4" />
                          {category.date ? new Date(category.date).toLocaleDateString() : "—"}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <VideoIcon className="mr-1 h-4 w-4" />
                          {category.subcategories.length} Sub Categories
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {category.subcategories.map((sub) => {
                      const isActive = selectedSub?.id === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedSub(sub)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted ${isActive ? "bg-muted" : ""
                            }`}
                          data-testid={`subcat-${sub.id}`}
                        >
                          {sub.thumbnailUrl ? (
                            <img
                              src={sub.thumbnailUrl}
                              alt={sub.title}
                              className="h-12 w-12 rounded object-cover shadow-xs"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded bg-muted" />
                          )}
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{sub.title}</p>
                              <Badge
                                variant="secondary"
                                className="bg-emerald-100 text-emerald-700"
                              >
                                {sub.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center">
                                <CalendarDays className="mr-1 h-4 w-4" />
                                {sub.date ? new Date(sub.date).toLocaleDateString() : "—"}
                              </span>
                              {sub.videoCount !== undefined && (
                                <span className="flex items-center">
                                  <VideoIcon className="mr-1 h-4 w-4" />
                                  {sub.videoCount} Video{sub.videoCount === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="flex h-full min-h-[480px] flex-col gap-4">
            {videosLoading ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading videos...
              </div>
            ) : !selectedSub ? (
              <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <VideoIcon className="h-6 w-6" />
                </div>
                <p className="text-lg font-semibold text-foreground">Select a subcategory to view videos</p>
                <p className="text-sm">Click on any subcategory from the left panel</p>
              </div>
            ) : (videosData?.videos?.length ?? 0) === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground space-y-2">
                <VideoIcon className="h-10 w-10" />
                <p className="text-lg font-semibold text-foreground">{selectedSub.title}</p>
                <p className="text-sm">No videos available yet.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <VideoIcon className="h-6 w-6" />
                  </div>
                  <p className="text-lg font-semibold">{selectedSub.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Ready to watch videos from <span className="font-semibold">{selectedSub.title}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(videosData?.videos?.length ?? 0)} video(s) available
                  </p>
                </div>

                {selectedVideo && (
                  <div className="w-full overflow-hidden rounded-lg border shadow-sm">
                    <video
                      key={selectedVideo.id}
                      controls
                      className="h-72 w-full bg-black"
                      src={selectedVideo.videoUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="p-3 space-y-1">
                      <p className="font-semibold">{selectedVideo.title}</p>
                      {selectedVideo.description && (
                        <p className="text-sm text-muted-foreground">{selectedVideo.description}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {videosData?.videos?.map((video) => (
                    <Button
                      key={video.id}
                      variant={selectedVideo?.id === video.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedVideo(video)}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      {video.title}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 hidden" />
    </div>
  );
}
