import React, { useState, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { LayoutGrid, ArrowLeft } from "lucide-react";
import { useQuery } from '@tanstack/react-query';

export default function DelayProjectPage() {
    const [searchQuery, setSearchQuery] = useState("");

    const handleBack = () => {
        window.history.back();
    };

    const { data: response, isLoading } = useQuery<any>({
        queryKey: ['/api/hod/projects/delayed'],
    });

    const delayedProjects = response?.data || [];

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return delayedProjects;
        const lowerQuery = searchQuery.toLowerCase();
        return delayedProjects.filter((row: any) =>
            (row.company || "").toLowerCase().includes(lowerQuery) ||
            (row.project || "").toLowerCase().includes(lowerQuery) ||
            (row.id || "").toLowerCase().includes(lowerQuery) ||
            ((row.createDate ? new Date(row.createDate).toLocaleDateString() : "")).includes(lowerQuery)
        );
    }, [searchQuery, delayedProjects]);

    const generateTooltip = (label: string, row: any) => {
        const colKeyMap: Record<string, string> = {
            'HOD': 'hod',
            'VAS Docs': 'vasDocs',
            'Dep App': 'depApp',
            'QA Dep Pending': 'qaDepP',
            'Vfy Dep Pending': 'vfyDepP'
        };
        const value = row[colKeyMap[label] || label.toLowerCase()] || "N/A";
        const isNA = value === "N/A";
        const createDate = row.createDate ? new Date(row.createDate).toLocaleDateString() : "00/00/0000";
        const deadLineDate = row.deadline ? new Date(row.deadline).toLocaleDateString() : "00/00/0000";
        const actionDate = isNA ? "N/A" : (value === "0" ? "DONE" : "PENDING");

        return `Create : ${createDate} | Status : ${actionDate} | Dead Line : ${deadLineDate} | DELAY DAYS : ${row.days || 0}`;
    };

    const renderBadge = (row: any, colKey: string, label: string) => {
        const value = row[colKey] || "N/A";
        let colors = {
            bg: "bg-[#f4f6f8]",
            text: "text-[#9ba3af]",
            border: "border border-[#eaedf1]",
            tooltipBg: "bg-white dark:bg-zinc-900",
            tooltipText: "text-[#333] shadow-lg",
            tooltipBorder: "border border-gray-200 dark:border-slate-700"
        };
        
        if (value === "0") {
            colors = {
                bg: "bg-[#0f8c5b]",
                text: "text-white",
                border: "shadow-sm shadow-[#0f8c5b]/20",
                tooltipBg: "bg-[#0f8c5b]",
                tooltipText: "text-white shadow-lg shadow-[#0f8c5b]/30",
                tooltipBorder: "border border-[#0f8c5b]"
            };
        } else if (value !== "N/A") {
            colors = {
                bg: "bg-[#dd3b4a]",
                text: "text-white",
                border: "shadow-sm shadow-[#dd3b4a]/20",
                tooltipBg: "bg-[#dd3b4a]",
                tooltipText: "text-white shadow-lg shadow-[#dd3b4a]/30",
                tooltipBorder: "border border-[#dd3b4a]"
            };
        }

        const tooltipText = generateTooltip(label, row);

        return (
            <div className="relative group/badge flex justify-center m-auto w-fit">
                <div className={`w-7 h-7 rounded-full ${colors.bg} ${colors.border} ${colors.text} font-semibold text-[11px] flex items-center justify-center relative z-10 cursor-help transition-all`}>
                    {value}
                </div>
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded shadow-lg ${colors.tooltipBg} ${colors.tooltipText} ${colors.tooltipBorder} text-[11.5px] font-bold whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-50 flex items-center gap-2`}>
                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${colors.tooltipBg} ${colors.tooltipBorder} border-t-0 border-l-0`}></div>
                    {tooltipText.split('|').map((part, index, array) => (
                        <React.Fragment key={index}>
                            <span>{part.trim()}</span>
                            {index < array.length - 1 && (
                                <span className={value === "N/A" ? "text-gray-400 font-normal px-0.5" : "text-white/80 font-normal px-0.5"}>|</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 min-h-screen bg-[#f4f6f9] font-sans dark:bg-zinc-950">
            <div className="mb-6 flex items-center gap-3">
                <button 
                    onClick={handleBack}
                    className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-600 bg-white shadow-sm border border-gray-100 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                    title="Back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <h1 className="text-[17px] font-bold text-[#495057] uppercase tracking-wide dark:text-zinc-400">DELAY PROJECTS</h1>
                    <div className="bg-[#41a877] text-white p-[3px] rounded-sm">
                        <LayoutGrid size={14} />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded border border-gray-100 shadow-sm p-4 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <Input
                        type="text"
                        placeholder="Search by Company, Project, Project ID, or Create Date (d/m/Y)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-[13px] border-gray-200 focus-visible:ring-0 focus-visible:border-gray-300 h-10 dark:border-zinc-800"
                    />
                </div>

                <div className="overflow-x-auto custom-scrollbar pb-16">
                    <table className="w-full border-collapse text-left whitespace-nowrap min-w-[1200px]">
                        <thead>
                            <tr className="bg-[#f8f9fa] border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">S.No</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Pro Id</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Create</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Project</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Company</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Person</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-left dark:text-zinc-400">Dep</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">HOD</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">VAS Docs</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Dep App</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Dep Not Assign</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Task Not Start</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Dep Not End</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">QA Dep Pending</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Vfy Dep Pending</th>
                                <th className="px-2 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Project Dead Line</th>
                                <th className="px-4 py-4 text-[13px] font-bold text-[#495057] text-center dark:text-zinc-400">Days</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={17} className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        Loading delayed projects...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={17} className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        No matching records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-3 py-4">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded border-gray-300 text-[#41a877] focus:ring-[#41a877] dark:border-zinc-800 dark:text-zinc-400" />
                                                <span className="text-[13px] text-gray-600 dark:text-zinc-300">{idx + 1}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">T:/P:{(row.id || "N/A").split('-')[0]}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.createDate ? new Date(row.createDate).toLocaleDateString() : "00/00/0000"}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.project || "No Project"}</td>
                                        <td className="px-3 py-4 text-[13px] font-semibold text-[#0f8c5b] uppercase dark:text-zinc-400">{row.company || "N/A"}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.person || "Unknown"}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 dark:text-zinc-300">{row.dep || "N/A"}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'hod', 'HOD')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'vasDocs', 'VAS Docs')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'depApp', 'Dep App')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'depNotAssign', 'Dep Not Assign')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'taskNotStart', 'Task Not Start')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'depNotEnd', 'Dep Not End')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'qaDepP', 'QA Dep Pending')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'vfyDepP', 'Vfy Dep Pending')}</td>
                                        <td className="px-2 py-4 text-center">{renderBadge(row, 'projectDeadLine', 'Project Dead Line')}</td>
                                        <td className="px-3 py-4 text-[13px] text-gray-600 text-center font-bold text-[#dd3b4a] dark:text-zinc-300">{row.days || 0}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <span className="text-[13px] text-[#828a96]">
                        Showing 1 to {filteredData.length} of {delayedProjects.length} entries
                    </span>
                    
                    <div className="flex gap-1 items-center">
                        <button className="text-[13px] text-gray-400 cursor-not-allowed hover:bg-gray-50 px-2 py-1 rounded dark:hover:bg-zinc-800">
                            ‹
                        </button>
                        <button className="text-[13px] text-white bg-[#0f8c5b] rounded-full w-7 h-7 flex items-center justify-center font-bold">
                            1
                        </button>
                        <button className="text-[13px] text-gray-400 cursor-not-allowed hover:bg-gray-50 px-2 py-1 rounded dark:hover:bg-zinc-800">
                            ›
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
