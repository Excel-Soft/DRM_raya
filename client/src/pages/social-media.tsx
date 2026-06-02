import { Button } from "@/components/ui/button";
import { Eye, ThumbsUp, MessageCircle, Share2, Facebook, Instagram, Linkedin, Youtube, Music2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function SocialMedia() {
  const sections = ["Webexcels", "Welc", "Ceo"];
  const [isAddPostModalOpen, setIsAddPostModalOpen] = useState(false);
  
  // State for storing posts: { "Webexcels": { "Facebook": "url", ... }, ... }
  const [posts, setPosts] = useState<Record<string, Record<string, string>>>({});
  
  // Form state
  const [selectedAccount, setSelectedAccount] = useState("Webexcels");
  const [formData, setFormData] = useState<Record<string, string>>({
    Facebook: "",
    Instagram: "",
    Linkedin: "",
    Youtube: "",
    Tiktok: ""
  });

  const handleSave = () => {
    setPosts(prev => ({
      ...prev,
      [selectedAccount]: {
        ...(prev[selectedAccount] || {}),
        ...Object.fromEntries(Object.entries(formData).filter(([_, v]) => v.trim() !== ""))
      }
    }));
    
    // Clear form and close modal
    setFormData({
      Facebook: "",
      Instagram: "",
      Linkedin: "",
      Youtube: "",
      Tiktok: ""
    });
    setIsAddPostModalOpen(false);
  };

  
  const platforms = [
    { name: "Facebook", bg: "bg-[#e2eaf4]", color: "text-[#00a65a]" },
    { name: "Instagram", bg: "bg-[#fdf0d5]", color: "text-[#00a65a]" },
    { name: "Linkedin", bg: "bg-[#e2eaf4]", color: "text-[#00a65a]" },
    { name: "Youtube", bg: "bg-[#fce5e6]", color: "text-[#00a65a]" },
    { name: "Tiktok", bg: "bg-[#d4f2e3]", color: "text-[#00a65a]" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-6 font-sans dark:bg-zinc-950">
      <div className="mb-4 text-sm font-bold tracking-wide uppercase text-gray-700 dark:text-zinc-400">
        ALL SOCIAL ACCOUNTS POST
      </div>
      
      <Button 
        onClick={() => setIsAddPostModalOpen(true)}
        className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 py-1 h-8 text-xs font-semibold rounded mb-6"
      >
        Add New Post
      </Button>

      {/* Add New Post Modal */}
      <Dialog open={isAddPostModalOpen} onOpenChange={setIsAddPostModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="border-b border-gray-100 pb-4 dark:border-zinc-800">
            <DialogTitle className="text-gray-700 font-semibold text-lg dark:text-zinc-400">Add New Post</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3 dark:text-zinc-400">Account</h4>
              <RadioGroup value={selectedAccount} onValueChange={setSelectedAccount} className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Webexcels" id="r1" className={selectedAccount === "Webexcels" ? "text-[#00a65a] border-[#00a65a]" : ""} />
                  <Label htmlFor="r1" className="text-gray-600 font-normal dark:text-zinc-300">Webexcels</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Welc" id="r2" className={selectedAccount === "Welc" ? "text-[#00a65a] border-[#00a65a]" : ""} />
                  <Label htmlFor="r2" className="text-gray-600 font-normal dark:text-zinc-300">Welc</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Ceo" id="r3" className={selectedAccount === "Ceo" ? "text-[#00a65a] border-[#00a65a]" : ""} />
                  <Label htmlFor="r3" className="text-gray-600 font-normal dark:text-zinc-300">CEO</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4">
              {[
                { name: "Facebook", icon: <Facebook className="w-4 h-4 text-gray-600 dark:text-zinc-300" /> },
                { name: "Instagram", icon: <Instagram className="w-4 h-4 text-gray-600 dark:text-zinc-300" /> },
                { name: "Linkedin", icon: <Linkedin className="w-4 h-4 text-gray-600 dark:text-zinc-300" /> },
                { name: "Youtube", icon: <Youtube className="w-4 h-4 text-gray-600 dark:text-zinc-300" /> },
                { name: "Tiktok", icon: <svg className="w-4 h-4 text-gray-600 dark:text-zinc-300" viewBox="0 0 448 512" fill="currentColor"><path d="M448 209.9a210.1 210.1 0 0 1 -122.8-39.3V349.4A162.6 162.6 0 1 1 185 188.3V278.2a74.6 74.6 0 1 0 52.2 71.2V0l88 0a121.2 121.2 0 0 0 1.9 22.2h0A122.2 122.2 0 0 0 381 102.4a121.4 121.4 0 0 0 67 20.1z"/></svg> }
              ].map(platform => (
                <div key={platform.name}>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block dark:text-zinc-400">{platform.name}:</label>
                  <div className="flex border border-gray-300 rounded overflow-hidden dark:border-zinc-800">
                    <div className="bg-[#f4f6f9] px-4 py-2 flex items-center justify-center border-r border-gray-300 dark:border-zinc-800 dark:bg-zinc-900">
                      {platform.icon}
                    </div>
                    <Input 
                      value={formData[platform.name]}
                      onChange={e => setFormData({ ...formData, [platform.name]: e.target.value })}
                      placeholder="Enter post url" 
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none h-9 text-sm" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-gray-100 pt-4 gap-2 sm:gap-0 dark:border-zinc-800">
            <Button variant="outline" onClick={() => setIsAddPostModalOpen(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 h-9 dark:bg-zinc-900 dark:text-zinc-400">
              Close
            </Button>
            <Button onClick={handleSave} className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        {sections.map(section => (
          <div key={section} className="flex flex-col">
            <h3 className="text-center text-lg text-gray-700 font-semibold mb-3 dark:text-zinc-400">{section}</h3>
            
            <div className="w-full border-t border-l border-r border-gray-200 dark:border-zinc-800">
              <div className="grid grid-cols-5 text-xs font-bold text-black">
                {platforms.map(p => (
                  <div key={p.name} className={`${p.bg} px-3 py-2 flex items-center justify-between border-r border-white last:border-r-0`}>
                    <span>{p.name}</span>
                    <Eye className={`w-3.5 h-3.5 ${p.color}`} />
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-5 text-xs text-gray-600 bg-white dark:bg-zinc-900 dark:text-zinc-300">
                {platforms.map(p => {
                  const postData = posts[section]?.[p.name];
                  return (
                    <div key={p.name} className="px-3 py-4 border-r border-white last:border-r-0 break-all">
                      {postData ? (
                        <a href={postData.startsWith('http') ? postData : `https://${postData}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                          {postData}
                        </a>
                      ) : (
                        "No data available"
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="grid grid-cols-5 text-xs font-bold text-black bg-[#d1e1ec] border-b border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                {platforms.map(p => (
                  <div key={p.name} className="px-3 py-2 flex items-center justify-between border-r border-white last:border-r-0">
                    <span>{p.name}</span>
                    <div className="flex gap-2 text-[#e74c3c] font-normal">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-800 font-bold mb-0.5 dark:text-zinc-100">(0)</span>
                        <ThumbsUp className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-800 font-bold mb-0.5 dark:text-zinc-100">(0)</span>
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-800 font-bold mb-0.5 dark:text-zinc-100">(0)</span>
                        <Share2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
