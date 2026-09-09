import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle2, ExternalLink, Facebook, Instagram, Linkedin, Youtube, Music2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TodayPost = {
    id: string;
    platform: string;
    entity: string | null;
    postUrl: string;
    title: string | null;
    customerId: string | null;
    projectId: string | null;
    socialAccountId: string | null;
    status: string;
    notes: string | null;
    postedBy: string | null;
    postedAt: string | null;
    completedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    postedByName: string | null;
    customerName: string | null;
};

type TodayPostsResponse = {
    data: TodayPost[];
    total: number;
    page: number;
    pageSize: number;
};

type SocialStats = {
    platform: string;
    bgColor: string; // The specific background for the top header
};

const SOCIAL_PLATFORMS: SocialStats[] = [
    { platform: "Facebook", bgColor: "bg-[#e5ecf6] dark:bg-zinc-900" },
    { platform: "Instagram", bgColor: "bg-[#fdf0d5] dark:bg-zinc-900" },
    { platform: "Linkedin", bgColor: "bg-[#e2f3ec] dark:bg-zinc-900" },
    { platform: "Youtube", bgColor: "bg-[#feeceb] dark:bg-zinc-900" },
    { platform: "Tiktok", bgColor: "bg-[#e1f7ec] dark:bg-zinc-900" },
];

// Fixed business entities used for grouping + the add-post account selector.
const ENTITIES = ["Webexcels", "Welc", "CEO"];

const PLATFORM_ICONS: Record<string, { Icon: typeof Facebook; color: string }> = {
    Facebook: { Icon: Facebook, color: "text-[#4267B2] dark:text-zinc-400" },
    Instagram: { Icon: Instagram, color: "text-[#E1306C]" },
    Linkedin: { Icon: Linkedin, color: "text-[#0077b5] dark:text-zinc-400" },
    Youtube: { Icon: Youtube, color: "text-[#495057] dark:text-zinc-400" },
    Tiktok: { Icon: Music2, color: "text-[#495057] dark:text-zinc-400" },
};

function isHttpUrl(value: string): boolean {
    try {
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

const EMPTY_URLS: Record<string, string> = {
    Facebook: "",
    Instagram: "",
    Linkedin: "",
    Youtube: "",
    Tiktok: "",
};

export default function TodayPostPage() {
    const { toast } = useToast();
    const [isAddPostModalOpen, setAddPostModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(ENTITIES[0]);
    const [urls, setUrls] = useState<Record<string, string>>({ ...EMPTY_URLS });

    const { data: response, isLoading } = useQuery<TodayPostsResponse>({
        queryKey: ["/api/drm/today-posts"],
        queryFn: () => apiRequestJson<TodayPostsResponse>("GET", "/api/drm/today-posts?pageSize=500"),
    });

    const posts = response?.data ?? [];

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/drm/today-posts"] });
    };

    const createMutation = useMutation({
        mutationFn: async (payloads: { platform: string; entity: string; postUrl: string }[]) => {
            for (const payload of payloads) {
                await apiRequestJson("POST", "/api/drm/today-posts", payload);
            }
        },
        onSuccess: () => {
            toast({ title: "Post(s) added" });
            setAddPostModalOpen(false);
            setUrls({ ...EMPTY_URLS });
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to add post", description: err?.message, variant: "destructive" });
        },
    });

    const completeMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("PATCH", `/api/drm/today-posts/${id}/complete`),
        onSuccess: () => {
            toast({ title: "Post marked complete" });
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to complete post", description: err?.message, variant: "destructive" });
        },
    });

    const handleSave = () => {
        const payloads: { platform: string; entity: string; postUrl: string }[] = [];
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
            payloads.push({ platform, entity: selectedAccount, postUrl: value });
        }
        if (payloads.length === 0) {
            toast({ title: "Enter at least one post URL", variant: "destructive" });
            return;
        }
        createMutation.mutate(payloads);
    };

    const getPosts = (entity: string, platform: string) =>
        posts.filter((p) => (p.entity ?? "") === entity && p.platform === platform);

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">Today Post</h1>

            <div className="mb-6">
                <Button
                    className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 text-[13px] font-medium tracking-wide h-9 shadow-sm rounded-sm"
                    onClick={() => setAddPostModalOpen(true)}
                    data-testid="button-add-post"
                >
                    Add New Post
                </Button>
            </div>

            <div className="space-y-8 pb-10">
                {isLoading ? (
                    <div className="text-center text-[13px] text-[#495057] dark:text-zinc-400">Loading...</div>
                ) : (
                    ENTITIES.map((entity, eIdx) => (
                        <div key={eIdx} className="w-full">
                            {/* Company / Entity Title */}
                            <div className="text-center mb-4">
                                <h2 className="text-[18px] font-medium text-[#495057] dark:text-zinc-400">{entity}</h2>
                            </div>

                            {/* Platform columns with real posts (or empty) */}
                            <div className="grid grid-cols-1 md:grid-cols-5 border-b-0">
                                {SOCIAL_PLATFORMS.map((social, sIdx) => {
                                    const cellPosts = getPosts(entity, social.platform);
                                    return (
                                        <div key={sIdx} className={cn("p-3 flex flex-col gap-2 min-h-[70px]", social.bgColor)}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[13px] font-bold text-[#212529] dark:text-zinc-100">{social.platform}</span>
                                                <Eye size={14} className="text-[#00a65a] dark:text-zinc-400" />
                                                {cellPosts.length > 0 && (
                                                    <span className="text-[12px] font-bold text-[#00a65a] dark:text-zinc-400">({cellPosts.length})</span>
                                                )}
                                            </div>
                                            {cellPosts.length === 0 ? (
                                                <div className="text-[12px] font-bold text-[#495057] dark:text-zinc-400">
                                                    No data available
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {cellPosts.map((post) => (
                                                        <div key={post.id} className="flex items-center justify-between gap-2 bg-white/70 dark:bg-zinc-900/70 rounded-sm px-2 py-1" data-testid={`post-${post.id}`}>
                                                            <a
                                                                href={post.postUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-[12px] text-[#0077b5] hover:underline truncate dark:text-zinc-300"
                                                                title={post.postUrl}
                                                            >
                                                                <ExternalLink size={12} />
                                                                <span className="truncate max-w-[90px]">{post.title || "View post"}</span>
                                                            </a>
                                                            {post.status === "completed" ? (
                                                                <span className="flex items-center gap-1 text-[11px] font-bold text-[#00a65a]">
                                                                    <CheckCircle2 size={13} /> Done
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => completeMutation.mutate(post.id)}
                                                                    disabled={completeMutation.isPending}
                                                                    className="text-[11px] font-bold text-[#00a65a] hover:underline disabled:opacity-50"
                                                                    data-testid={`button-complete-${post.id}`}
                                                                >
                                                                    Complete
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Thin gray separator between blocks, like in the image */}
                            <div className="border-b border-gray-200 mt-8 last:hidden w-full dark:border-zinc-800"></div>
                        </div>
                    ))
                )}
            </div>

            {/* Add New Post Modal */}
            <Dialog open={isAddPostModalOpen} onOpenChange={setAddPostModalOpen}>
                <DialogContent className="max-w-[500px] p-0 flex flex-col gap-0 overflow-hidden bg-white rounded-md dark:bg-zinc-900">
                    <DialogHeader className="p-4 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-semibold text-[#495057] dark:text-zinc-400">
                            Add New Post
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                        {/* Account Selection */}
                        <div className="space-y-3">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Account</Label>
                            <RadioGroup
                                value={selectedAccount}
                                onValueChange={setSelectedAccount}
                                className="flex items-center gap-6"
                            >
                                {ENTITIES.map((entity, idx) => (
                                    <div key={entity} className="flex items-center space-x-2">
                                        <RadioGroupItem value={entity} id={`r${idx}`} className="text-[#00a65a] border-gray-300 [&_span]:bg-[#00a65a] dark:border-zinc-800 dark:text-zinc-400" />
                                        <Label htmlFor={`r${idx}`} className="text-[13px] text-gray-700 font-medium dark:text-zinc-400">{entity}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {/* Social Inputs */}
                        <div className="space-y-4">
                            {SOCIAL_PLATFORMS.map(({ platform }) => {
                                const { Icon, color } = PLATFORM_ICONS[platform];
                                return (
                                    <div key={platform} className="space-y-1.5">
                                        <Label className="text-[13px] text-gray-600 dark:text-zinc-300">{platform}:</Label>
                                        <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors dark:border-zinc-800">
                                            <div className="flex items-center justify-center w-12 bg-[#f4f6f9] border-r border-gray-300 dark:border-zinc-800 dark:bg-zinc-900">
                                                <Icon size={18} className={color} />
                                            </div>
                                            <Input
                                                value={urls[platform] ?? ""}
                                                onChange={(e) => setUrls((prev) => ({ ...prev, [platform]: e.target.value }))}
                                                className="flex-1 border-0 rounded-none h-10 shadow-none focus-visible:ring-0 px-3 text-[13px]"
                                                placeholder="Enter post url"
                                                data-testid={`input-${platform.toLowerCase()}-url`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end p-4 border-t border-gray-100 bg-white gap-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button
                            variant="secondary"
                            className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-800 px-5 font-medium shadow-none h-9 text-[13px] dark:text-zinc-100 dark:bg-zinc-900"
                            onClick={() => setAddPostModalOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 font-medium shadow-none h-9 text-[13px]"
                            onClick={handleSave}
                            disabled={createMutation.isPending}
                            data-testid="button-save-post"
                        >
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
