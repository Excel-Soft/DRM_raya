import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, ThumbsUp, MessageSquare, Share2, Facebook, Instagram, Linkedin, Youtube, Music2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SocialStats = {
    platform: string;
    bgColor: string; // The specific background for the top header
};

const SOCIAL_PLATFORMS: SocialStats[] = [
    { platform: "Facebook", bgColor: "bg-[#e5ecf6]" },
    { platform: "Instagram", bgColor: "bg-[#fdf0d5]" },
    { platform: "Linkedin", bgColor: "bg-[#e2f3ec]" },
    { platform: "Youtube", bgColor: "bg-[#feeceb]" },
    { platform: "Tiktok", bgColor: "bg-[#e1f7ec]" },
];

const MOCK_ENTITIES = [
    "Webexcels",
    "Welc",
    "Ceo"
];

function SocialMetricsRow() {
    return (
        <div className="flex gap-2 text-[#e74c3c]">
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-[12px] font-bold text-[#00a65a] dark:text-zinc-400">(0)</span>
                <ThumbsUp size={16} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-[12px] font-bold text-[#00a65a] dark:text-zinc-400">(0)</span>
                <MessageSquare size={16} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-[12px] font-bold text-[#00a65a] dark:text-zinc-400">(0)</span>
                <Share2 size={16} strokeWidth={1.5} />
            </div>
        </div>
    );
}

export default function TodayPostPage() {
    const [isAddPostModalOpen, setAddPostModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState("webexcels");

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">Today Post</h1>
            
            <div className="mb-6">
                <Button 
                    className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 text-[13px] font-medium tracking-wide h-9 shadow-sm rounded-sm"
                    onClick={() => setAddPostModalOpen(true)}
                >
                    Add New Post
                </Button>
            </div>

            <div className="space-y-8 pb-10">
                {MOCK_ENTITIES.map((entity, eIdx) => (
                    <div key={eIdx} className="w-full">
                        {/* Company / Entity Title */}
                        <div className="text-center mb-4">
                            <h2 className="text-[18px] font-medium text-[#495057] dark:text-zinc-400">{entity}</h2>
                        </div>

                        {/* Top Row: Links / No Data */}
                        <div className="grid grid-cols-1 md:grid-cols-5 border-b-0">
                            {SOCIAL_PLATFORMS.map((social, sIdx) => (
                                <div key={sIdx} className={cn("p-3 flex flex-col justify-between min-h-[70px]", social.bgColor)}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[13px] font-bold text-[#212529] dark:text-zinc-100">{social.platform}</span>
                                        <Eye size={14} className="text-[#00a65a] dark:text-zinc-400" />
                                    </div>
                                    <div className="text-[12px] font-bold text-[#495057] dark:text-zinc-400">
                                        No data available
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bottom Row: Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-5 bg-[#dbe6f0] dark:bg-zinc-900">
                            {SOCIAL_PLATFORMS.map((social, sIdx) => (
                                <div key={sIdx} className="p-3 py-4 flex items-center justify-between border-b border-white last:border-b-0 min-h-[70px]">
                                    <div className="text-[13px] font-bold text-[#212529] dark:text-zinc-100">
                                        {social.platform}
                                    </div>
                                    <SocialMetricsRow />
                                </div>
                            ))}
                        </div>
                        
                        {/* Thin gray separator between blocks, like in the image */}
                        <div className="border-b border-gray-200 mt-8 last:hidden w-full dark:border-zinc-800"></div>
                    </div>
                ))}
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
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="webexcels" id="r1" className="text-[#00a65a] border-gray-300 [&_span]:bg-[#00a65a] dark:border-zinc-800 dark:text-zinc-400" />
                                    <Label htmlFor="r1" className="text-[13px] text-gray-700 font-medium dark:text-zinc-400">Webexcels</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="welc" id="r2" className="text-[#00a65a] border-gray-300 [&_span]:bg-[#00a65a] dark:border-zinc-800 dark:text-zinc-400" />
                                    <Label htmlFor="r2" className="text-[13px] text-gray-700 font-medium dark:text-zinc-400">Welc</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="ceo" id="r3" className="text-[#00a65a] border-gray-300 [&_span]:bg-[#00a65a] dark:border-zinc-800 dark:text-zinc-400" />
                                    <Label htmlFor="r3" className="text-[13px] text-gray-700 font-medium dark:text-zinc-400">CEO</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Social Inputs */}
                        <div className="space-y-4">
                            {/* Facebook */}
                            <div className="space-y-1.5">
                                <Label className="text-[13px] text-gray-600 dark:text-zinc-300">Facebook:</Label>
                                <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors dark:border-zinc-800">
                                    <div className="flex items-center justify-center w-12 bg-[#f4f6f9] border-r border-gray-300 dark:border-zinc-800 dark:bg-zinc-900">
                                        <Facebook size={18} className="text-[#4267B2] dark:text-zinc-400" />
                                    </div>
                                    <Input className="flex-1 border-0 rounded-none h-10 shadow-none focus-visible:ring-0 px-3 text-[13px]" placeholder="Enter post url" />
                                </div>
                            </div>
                            
                            {/* Instagram */}
                            <div className="space-y-1.5">
                                <Label className="text-[13px] text-gray-600 dark:text-zinc-300">Instagram:</Label>
                                <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors dark:border-zinc-800">
                                    <div className="flex items-center justify-center w-12 bg-[#f4f6f9] border-r border-gray-300 dark:border-zinc-800 dark:bg-zinc-900">
                                        <Instagram size={18} className="text-[#E1306C]" />
                                    </div>
                                    <Input className="flex-1 border-0 rounded-none h-10 shadow-none focus-visible:ring-0 px-3 text-[13px]" placeholder="Enter post url" />
                                </div>
                            </div>

                            {/* Linkedin */}
                            <div className="space-y-1.5">
                                <Label className="text-[13px] text-gray-600 dark:text-zinc-300">Linkedin:</Label>
                                <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors dark:border-zinc-800">
                                    <div className="flex items-center justify-center w-12 bg-[#f4f6f9] border-r border-gray-300 dark:border-zinc-800 dark:bg-zinc-900">
                                        <Linkedin size={18} className="text-[#0077b5] dark:text-zinc-400" />
                                    </div>
                                    <Input className="flex-1 border-0 rounded-none h-10 shadow-none focus-visible:ring-0 px-3 text-[13px]" placeholder="Enter post url" />
                                </div>
                            </div>

                            {/* Youtube */}
                            <div className="space-y-1.5">
                                <Label className="text-[13px] text-gray-600 dark:text-zinc-300">Youtube:</Label>
                                <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors dark:border-zinc-800">
                                    <div className="flex items-center justify-center w-12 bg-[#f4f6f9] border-r border-gray-300 dark:border-zinc-800 dark:bg-zinc-900">
                                        <Youtube size={18} className="text-[#495057] dark:text-zinc-400" />
                                    </div>
                                    <Input className="flex-1 border-0 rounded-none h-10 shadow-none focus-visible:ring-0 px-3 text-[13px]" placeholder="Enter post url" />
                                </div>
                            </div>

                            {/* Tiktok */}
                            <div className="space-y-1.5">
                                <Label className="text-[13px] text-gray-600 dark:text-zinc-300">Tiktok:</Label>
                                <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors dark:border-zinc-800">
                                    <div className="flex items-center justify-center w-12 bg-[#f4f6f9] border-r border-gray-300 dark:border-zinc-800 dark:bg-zinc-900">
                                        <Music2 size={18} className="text-[#495057] dark:text-zinc-400" />
                                    </div>
                                    <Input className="flex-1 border-0 rounded-none h-10 shadow-none focus-visible:ring-0 px-3 text-[13px]" placeholder="Enter post url" />
                                </div>
                            </div>
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
                        >
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
