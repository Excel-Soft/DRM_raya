import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Facebook, Instagram, Linkedin, Youtube, Music2, PlusCircle, Trash2, Link } from "lucide-react";

export default function AllSocialAccountsPage() {
    const [isAddAccountModalOpen, setAddAccountModalOpen] = useState(false);
    const [isAddChannelModalOpen, setAddChannelModalOpen] = useState(false);

    const mockData = [
        {
            id: 1,
            name: "Muhammad Tuqeer Razaq",
            email: "tuqeer@gmail.com",
            phone: "034254878548",
        }
    ];

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">
                All Social Accounts
            </h1>

            <div className="mb-6">
                <Button 
                    className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 text-[13px] font-medium tracking-wide h-9 shadow-sm rounded-sm"
                    onClick={() => setAddAccountModalOpen(true)}
                >
                    Add New Account
                </Button>
            </div>

            {/* Table Area */}
            <div className="w-full bg-white shadow-sm border border-gray-100 rounded-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#e4ebd] border-b border-gray-100 dark:border-zinc-800" style={{ backgroundColor: "#e2f2e7" }}>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">S.No</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Name</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Email</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Phone</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Accounts</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mockData.map((row) => (
                            <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                <td className="px-4 py-4 text-[13px] text-[#212529] font-medium dark:text-zinc-100">{row.id}</td>
                                <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.name}</td>
                                <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.email}</td>
                                <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.phone}</td>
                                <td className="px-4 py-4 text-[13px] text-[#6c757d]">
                                    <div className="flex items-center gap-1.5 opacity-80">
                                        <Facebook size={16} />
                                        <Instagram size={16} />
                                        <Linkedin size={16} />
                                        <Youtube size={16} />
                                        <Music2 size={16} />
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-[13px]">
                                    <div className="flex items-center gap-3">
                                        <PlusCircle 
                                            size={17} 
                                            className="text-[#00a65a] cursor-pointer hover:scale-110 transition-transform dark:text-zinc-400" 
                                            onClick={() => setAddChannelModalOpen(true)}
                                        />
                                        <Trash2 size={17} className="text-[#e74c3c] cursor-pointer hover:scale-110 transition-transform" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add New Account Modal */}
            <Dialog open={isAddAccountModalOpen} onOpenChange={setAddAccountModalOpen}>
                <DialogContent className="max-w-[450px] p-0 flex flex-col gap-0 overflow-hidden bg-white rounded-md dark:bg-zinc-900">
                    <DialogHeader className="p-4 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-semibold text-[#495057] dark:text-zinc-400">
                            Add New Account
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-5">
                        {/* Person Selection */}
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Person:</Label>
                            <Select>
                                <SelectTrigger className="h-10 w-full text-[13px] text-gray-600 shadow-sm dark:text-zinc-300">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user1">Muhammad Tuqeer Razaq</SelectItem>
                                    <SelectItem value="user2">SYED HURR ABBAS</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Account Email */}
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Account Email:</Label>
                            <Input className="h-10 shadow-sm text-[13px] font-medium" />
                        </div>

                        {/* Account Phone */}
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Account Phone:</Label>
                            <Input className="h-10 shadow-sm text-[13px] font-medium" />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end p-4 border-t border-gray-100 bg-white gap-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button 
                            variant="secondary" 
                            className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-800 px-5 font-medium shadow-none h-9 text-[13px] dark:text-zinc-100 dark:bg-zinc-900"
                            onClick={() => setAddAccountModalOpen(false)}
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

            {/* Add New Channel Modal */}
            <Dialog open={isAddChannelModalOpen} onOpenChange={setAddChannelModalOpen}>
                <DialogContent className="max-w-[550px] p-0 flex flex-col gap-0 overflow-hidden bg-white rounded-md dark:bg-zinc-900">
                    <DialogHeader className="p-4 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-semibold text-[#495057] dark:text-zinc-400">
                            Add New Channel
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                        {/* Person Selection (Disabled/Readonly style) */}
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Person:</Label>
                            <Input 
                                disabled 
                                value="Muhammad Tuqeer Razaq"
                                className="h-10 text-[13px] bg-[#f4f6f9] text-[#495057] shadow-sm font-medium border-gray-200 opacity-90 cursor-not-allowed dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900" 
                            />
                        </div>

                        {/* Profiles mapping */}
                        {[
                            { name: "Facebook", icon: <Facebook size={17} className="text-[#4267B2] dark:text-zinc-400" /> },
                            { name: "Instagram", icon: <Instagram size={17} className="text-[#E1306C]" /> },
                            { name: "Linkedin", icon: <Linkedin size={17} className="text-[#0077b5] dark:text-zinc-400" /> },
                            { name: "Youtube", icon: <Youtube size={17} className="text-[#495057] dark:text-zinc-400" /> },
                            { name: "Tiktok", icon: <Music2 size={17} className="text-[#495057] dark:text-zinc-400" /> }
                        ].map((social, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row gap-4 items-start w-full mt-3">
                                {/* Profile Input Block */}
                                <div className="space-y-1.5 w-full">
                                    <Label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">{social.name} Profile:</Label>
                                    <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="flex items-center justify-center w-11 bg-[#f4f6f9] border-r border-gray-300 shrink-0 dark:border-zinc-800 dark:bg-zinc-900">
                                            {social.icon}
                                        </div>
                                        <Input className="flex-1 border-0 rounded-none h-9 shadow-none focus-visible:ring-0 px-3 text-[13px]" placeholder="Username" />
                                    </div>
                                </div>

                                {/* URL Input Block */}
                                <div className="space-y-1.5 w-full">
                                    <Label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">{social.name} Url:</Label>
                                    <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="flex items-center justify-center w-11 bg-[#f4f6f9] border-r border-gray-300 shrink-0 dark:border-zinc-800 dark:bg-zinc-900">
                                            <Link size={16} className="text-[#4267B2] dark:text-zinc-400" />
                                        </div>
                                        <Input className="flex-1 border-0 rounded-none h-9 shadow-none focus-visible:ring-0 px-3 text-[13px]" placeholder="Profile link" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end p-4 border-t border-gray-100 bg-white gap-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button 
                            variant="secondary" 
                            className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-800 px-5 font-medium shadow-none h-9 text-[13px] dark:text-zinc-100 dark:bg-zinc-900"
                            onClick={() => setAddChannelModalOpen(false)}
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
