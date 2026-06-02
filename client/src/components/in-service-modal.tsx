import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Book, FileText, MessageSquare } from "lucide-react";

export function InServiceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState("q1");

    const tabs = [
        { id: "q1", label: "Q1 Apr-Jun", count: 0, months: ["Apr", "May", "Jun"] },
        { id: "q2", label: "Q2 Jul-Sep", count: 0, months: ["Jul", "Aug", "Sep"] },
        { id: "q3", label: "Q3 Oct-Dec", count: 0, months: ["Oct", "Nov", "Dec"] },
        { id: "q4", label: "Q4 Jan-Mar", count: 0, months: ["Jan", "Feb", "Mar"] }
    ];

    const activeTabData = tabs.find(t => t.id === activeTab) || tabs[0];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl p-6 bg-[#f8fafc] gap-6 dark:bg-zinc-900">
                <DialogHeader>
                    <DialogTitle className="text-[17px] font-bold text-slate-700 dark:text-zinc-400">
                        In Service Customer
                    </DialogTitle>
                </DialogHeader>

                <div>
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 gap-6 dark:border-zinc-800">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${activeTab === tab.id
                                        ? "border-[#059669] text-[#059669]"
                                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                            >
                                <span className="text-[13px] font-bold">{tab.label}</span>
                                <span className={`text-[11px] font-bold px-1.5 rounded-full ${activeTab === tab.id ? "bg-[#d1fae5]" : "bg-slate-200"
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Cards grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        <div className="bg-white rounded-[6px] shadow-sm border border-slate-100 p-4 flex justify-between items-center dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <h3 className="text-[12px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">{activeTabData.months[0]} Expire</h3>
                                <p className="text-[20px] font-bold text-slate-800 dark:text-zinc-100">0</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center dark:bg-zinc-800">
                                <Book className="w-5 h-5 text-[#059669] dark:text-zinc-400" />
                            </div>
                        </div>

                        <div className="bg-white rounded-[6px] shadow-sm border border-slate-100 p-4 flex justify-between items-center dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <h3 className="text-[12px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">{activeTabData.months[1]} Expire</h3>
                                <p className="text-[20px] font-bold text-slate-800 dark:text-zinc-100">0</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center dark:bg-zinc-800">
                                <FileText className="w-5 h-5 text-[#059669] dark:text-zinc-400" />
                            </div>
                        </div>

                        <div className="bg-white rounded-[6px] shadow-sm border border-slate-100 p-4 flex justify-between items-center dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <h3 className="text-[12px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">{activeTabData.months[2]} Expire</h3>
                                <p className="text-[20px] font-bold text-slate-800 dark:text-zinc-100">0</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center dark:bg-zinc-800">
                                <MessageSquare className="w-5 h-5 text-[#059669] dark:text-zinc-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
