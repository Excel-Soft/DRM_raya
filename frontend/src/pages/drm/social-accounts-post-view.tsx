import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Eye, Facebook, Instagram, Linkedin, Youtube, Music2, ThumbsUp, MessageCircle, Share2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PlatformCell = {
  platform: string;
  postUrl: string | null;
  likes: string;
  shares: string;
  comments: string;
};

type PostSession = {
  id: string;
  entity: string;
  createdAt: string | null;
  dateKey: string;
  platforms: PlatformCell[];
  source?: string;
};

type SessionsResponse = {
  sessions: PostSession[];
  total: number;
  startDate?: string;
  endDate?: string;
  source?: string;
};

const SOCIAL_PLATFORMS = [
  { platform: "Facebook", bgColor: "bg-[#e5ecf6] dark:bg-zinc-900" },
  { platform: "Instagram", bgColor: "bg-[#fdf0d5] dark:bg-zinc-900" },
  { platform: "Linkedin", bgColor: "bg-[#e2f3ec] dark:bg-zinc-900" },
  { platform: "Youtube", bgColor: "bg-[#feeceb] dark:bg-zinc-900" },
  { platform: "Tiktok", bgColor: "bg-[#e1f7ec] dark:bg-zinc-900" },
] as const;

const ENTITIES = ["Webexcels", "Welc", "CEO"];

const PLATFORM_ICONS: Record<string, { Icon: typeof Facebook; color: string }> = {
  Facebook: { Icon: Facebook, color: "text-[#4267B2]" },
  Instagram: { Icon: Instagram, color: "text-[#E1306C]" },
  Linkedin: { Icon: Linkedin, color: "text-[#0077b5]" },
  Youtube: { Icon: Youtube, color: "text-[#495057]" },
  Tiktok: { Icon: Music2, color: "text-[#495057]" },
};

const EMPTY_URLS: Record<string, string> = {
  Facebook: "",
  Instagram: "",
  Linkedin: "",
  Youtube: "",
  Tiktok: "",
};

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultLastMonthRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { startDate: toInputDate(start), endDate: toInputDate(end) };
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDisplayDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Props = {
  pageTitle?: string;
};

export default function SocialAccountsPostView({ pageTitle = "ALL SOCIAL ACCOUNTS POST" }: Props) {
  const { toast } = useToast();
  const defaults = useMemo(() => defaultLastMonthRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [applied, setApplied] = useState(defaults);
  const [isAddPostModalOpen, setAddPostModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(ENTITIES[0]);
  const [urls, setUrls] = useState<Record<string, string>>({ ...EMPTY_URLS });

  const qs = useMemo(() => {
    const p = new URLSearchParams({ format: "sessions" });
    if (applied.startDate) p.set("startDate", applied.startDate);
    if (applied.endDate) p.set("endDate", applied.endDate);
    return p.toString();
  }, [applied]);

  const { data: response, isLoading, isError } = useQuery<SessionsResponse>({
    queryKey: ["/api/drm/today-posts", "sessions", applied.startDate, applied.endDate],
    queryFn: () => apiRequestJson<SessionsResponse>("GET", `/api/drm/today-posts?${qs}`),
  });

  const sessions = response?.sessions ?? [];

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, PostSession[]>();
    for (const s of sessions) {
      const key = s.dateKey || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/drm/today-posts"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: { entity: string; urls: Record<string, string> }) =>
      apiRequestJson("POST", "/api/drm/today-posts/bundle", body),
    onSuccess: () => {
      toast({ title: "Post saved" });
      setAddPostModalOpen(false);
      setUrls({ ...EMPTY_URLS });
      invalidate();
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to save";
      if (String(msg).toLowerCase().includes("already")) {
        toast({ title: "Today Post Already Add", variant: "destructive" });
      } else {
        toast({ title: "Failed to save post", description: msg, variant: "destructive" });
      }
    },
  });

  const handleSave = () => {
    for (const { platform } of SOCIAL_PLATFORMS) {
      const value = (urls[platform] ?? "").trim();
      if (!value) continue;
      if (!isHttpUrl(value)) {
        toast({
          title: "Invalid URL",
          description: `${platform} URL must be a valid http(s) link`,
          variant: "destructive",
        });
        return;
      }
    }
    const hasAny = SOCIAL_PLATFORMS.some(({ platform }) => (urls[platform] ?? "").trim());
    if (!hasAny) {
      toast({ title: "Enter at least one post URL", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      entity: selectedAccount,
      urls: {
        Facebook: urls.Facebook ?? "",
        Instagram: urls.Instagram ?? "",
        Linkedin: urls.Linkedin ?? "",
        Youtube: urls.Youtube ?? "",
        Tiktok: urls.Tiktok ?? "",
      },
    });
  };

  const getPlatformCell = (session: PostSession, platform: string): PlatformCell | undefined =>
    session.platforms.find((p) => p.platform === platform);

  return (
    <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
      <motion className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase dark:text-zinc-400">
          {pageTitle}
          {response?.source === "legacy" ? (
            <span className="text-[11px] font-normal text-slate-500 normal-case ml-2">(legacy archive)</span>
          ) : null}
        </h1>
        <Button
          className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 text-[13px] font-medium h-9 rounded-sm"
          onClick={() => setAddPostModalOpen(true)}
        >
          Add New Post
        </Button>
      </motion>

      <motion className="flex flex-wrap items-end gap-3 mb-6 p-3 bg-white border border-slate-200 rounded-sm dark:bg-zinc-900 dark:border-zinc-800">
        <motion className="flex flex-col gap-1">
          <Label className="text-[12px] text-slate-600">Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-[13px] w-40" />
        </motion>
        <motion className="flex flex-col gap-1">
          <Label className="text-[12px] text-slate-600">End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-[13px] w-40" />
        </motion>
        <Button
          className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9"
          onClick={() => setApplied({ startDate, endDate })}
        >
          View Statistics
        </Button>
      </motion>

      <h2 className="text-[14px] font-semibold text-[#495057] mb-4 dark:text-zinc-300">View Statistics</h2>

      {isLoading ? (
        <div className="text-center text-[13px] text-slate-500 py-10">Loading...</div>
      ) : isError ? (
        <div className="text-center text-[13px] text-red-500 py-10">Could not load posts.</div>
      ) : sessionsByDate.length === 0 ? (
        <div className="text-center text-[13px] text-slate-500 py-10 bg-white border border-slate-200 rounded-sm dark:bg-zinc-900">
          No data available for the selected date range.
        </div>
      ) : (
        <div className="space-y-10">
          {sessionsByDate.map(([dateKey, daySessions]) => (
            <div key={dateKey} className="space-y-6">
              <motion className="text-center text-[13px] font-semibold text-[#6c757d] dark:text-zinc-400">
                {formatDisplayDate(dateKey)}
              </motion>
              {daySessions.map((session) => (
                <motion key={session.id} className="w-full">
                  <div className="text-center mb-3">
                    <h3 className="text-[17px] font-medium text-[#495057] dark:text-zinc-300">{session.entity}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-0 border border-slate-200 dark:border-zinc-800 overflow-hidden rounded-sm">
                    {SOCIAL_PLATFORMS.map(({ platform, bgColor }) => {
                      const cell = getPlatformCell(session, platform);
                      const postUrl = cell?.postUrl ?? null;
                      const hasUrl = !!postUrl;
                      return (
                        <div key={platform} className={cn("p-3 flex flex-col min-h-[100px]", bgColor)}>
                          <motion className={cn("h-[6px] w-full mb-2 rounded-sm", hasUrl ? "bg-[#5bc0de]" : "bg-[#d9534f]")} />
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[12px] font-bold text-[#212529] dark:text-zinc-100">{platform}</span>
                            <Eye size={14} className="text-[#00a65a]" />
                          </div>
                          {hasUrl ? (
                            <a
                              href={postUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-[#0077b5] hover:underline mb-2 truncate dark:text-sky-400"
                            >
                              <ExternalLink size={12} />
                              <span className="truncate">Open post</span>
                            </a>
                          ) : (
                            <p className="text-[12px] font-bold text-[#495057] dark:text-zinc-400 mb-2">No data available</p>
                          )}
                          <motion className="flex items-center gap-2 text-[11px] text-[#495057] dark:text-zinc-400 mt-auto">
                            <span className="inline-flex items-center gap-0.5" title="Likes">
                              <ThumbsUp size={12} className="text-[#00a65a]" />
                              ({cell?.likes ?? "0"})
                            </span>
                            <span className="inline-flex items-center gap-0.5" title="Comments">
                              <MessageCircle size={12} className="text-[#00a65a]" />
                              ({cell?.comments ?? "0"})
                            </span>
                            <span className="inline-flex items-center gap-0.5" title="Shares">
                              <Share2 size={12} className="text-[#00a65a]" />
                              ({cell?.shares ?? "0"})
                            </span>
                          </motion>
                        </div>
                      );
                    })}
                  </div>
                </motion>
              ))}
            </div>
          ))}
        </div>
      )}

      {response?.total != null && response.total > 0 && (
        <p className="text-[12px] text-slate-500 mt-6">Showing {response.total} posting session(s)</p>
      )}

      <Dialog open={isAddPostModalOpen} onOpenChange={setAddPostModalOpen}>
        <DialogContent className="max-w-[500px] p-0 flex flex-col gap-0 overflow-hidden bg-white rounded-md dark:bg-zinc-900">
          <DialogHeader className="p-4 border-b border-gray-100 dark:border-zinc-800">
            <DialogTitle className="text-[17px] font-semibold text-[#495057] dark:text-zinc-300">Add New Post</DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
            <motion className="space-y-3">
              <Label className="text-[14px] font-semibold text-[#495057]">Account</Label>
              <RadioGroup value={selectedAccount} onValueChange={setSelectedAccount} className="flex items-center gap-6">
                {ENTITIES.map((entity, idx) => (
                  <motion key={entity} className="flex items-center space-x-2">
                    <RadioGroupItem value={entity} id={`soc-r${idx}`} />
                    <Label htmlFor={`soc-r${idx}`} className="text-[13px] font-medium">
                      {entity}
                    </Label>
                  </motion>
                ))}
              </RadioGroup>
            </motion>

            <div className="space-y-4">
              {SOCIAL_PLATFORMS.map(({ platform }) => {
                const { Icon, color } = PLATFORM_ICONS[platform];
                return (
                  <div key={platform} className="space-y-1.5">
                    <Label className="text-[13px] text-gray-600">{platform}:</Label>
                    <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:ring-1 focus-within:ring-blue-400 dark:border-zinc-700">
                      <motion className="flex items-center justify-center w-12 bg-[#f4f6f9] border-r border-gray-300 dark:bg-zinc-800">
                        <Icon size={18} className={color} />
                      </motion>
                      <Input
                        value={urls[platform] ?? ""}
                        onChange={(e) => setUrls((prev) => ({ ...prev, [platform]: e.target.value }))}
                        className="flex-1 border-0 rounded-none h-10 shadow-none focus-visible:ring-0 text-[13px]"
                        placeholder="Enter post url"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end p-4 border-t gap-3">
            <Button variant="secondary" className="h-9 text-[13px]" onClick={() => setAddPostModalOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 text-[13px]"
              onClick={handleSave}
              disabled={createMutation.isPending}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Tiny alias so we can use semantic tags without extra DOM wrappers from a missing component */
function motion({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}
