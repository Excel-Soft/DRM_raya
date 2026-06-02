import React, { useState } from 'react';
import { Search, Grid } from "lucide-react";

const delayProjectsData = [
    { id: "10163", create: "26/03/2026", project: "Alibaba Product Posting", company: "JACOMO APPAREL", person: "M.salman", dep: "Product Posting", hod: 0, vasDocs: 1, days: 15 },
    { id: "10162", create: "26/03/2026", project: "Alibaba Minisite", company: "JACOMO APPAREL", person: "M.salman", dep: "D&D Department", hod: 0, vasDocs: 1, days: 5 },
    { id: "10161", create: "26/03/2026", project: "Listing Page", company: "JACOMO APPAREL", person: "M.salman", dep: "D&D Department", hod: 0, vasDocs: 1, days: 2 },
    { id: "10158", create: "26/03/2026", project: "Alibaba Product Posting", company: "STITCH LAB", person: "Zill E Huma", dep: "Product Posting", hod: 0, vasDocs: 1, days: 15 },
    { id: "10156", create: "26/03/2026", project: "Listing Page", company: "STITCH LAB", person: "Zill E Huma", dep: "D&D Department", hod: 0, vasDocs: 1, days: 2 },
    { id: "10155", create: "26/03/2026", project: "Alibaba Product Posting", company: "ZARCHY INDUSTRY", person: "Laiba fatima", dep: "Product Posting", hod: 0, vasDocs: 1, days: 15 },
    { id: "10154", create: "26/03/2026", project: "Alibaba Minisite", company: "ZARCHY INDUSTRY", person: "Laiba fatima", dep: "D&D Department", hod: 0, vasDocs: 1, days: 5 },
    { id: "10152", create: "26/03/2026", project: "Listing Page", company: "ZARCHY INDUSTRY", person: "Laiba fatima", dep: "D&D Department", hod: 0, vasDocs: 1, days: 2 },
];

export default function DelayProjectsNewPage() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredData = delayProjectsData.filter(item =>
        item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.includes(searchQuery)
    );

    const renderCircle = (value: number | "N/A", type: "green" | "red" | "gray") => {
        let tooltipContent;
        if (type === "green") {
            tooltipContent = (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex whitespace-nowrap bg-[#188852] text-white px-3 py-1.5 rounded-[3px] text-[12px] font-medium z-[100] items-center shadow-lg border border-[#137446] tracking-wide dark:border-zinc-800">
                    Create : 26-03-2026 <span className="mx-1.5 font-normal opacity-80">|</span> Approved : 26-03-2026 <span className="mx-1.5 font-normal opacity-80">|</span> Dead Line : 27-03-2026 <span className="mx-1.5 font-normal opacity-80">|</span> DELAY DAYS : 0
                </div>
            );
        } else if (type === "red") {
            tooltipContent = (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex whitespace-nowrap bg-[#dc3545] text-white px-3 py-1.5 rounded-[3px] text-[12px] font-medium z-[100] items-center shadow-lg border border-[#c82333] tracking-wide dark:border-zinc-800 dark:bg-zinc-900">
                    Start : 26-03-2026 <span className="mx-1.5 font-normal opacity-80">|</span> Upload : N/A <span className="mx-1.5 font-normal opacity-80">|</span> Dead Line : 27-03-2026 <span className="mx-1.5 font-normal opacity-80">|</span> DELAY DAYS : 1
                </div>
            );
        } else {
            tooltipContent = (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex whitespace-nowrap bg-white text-gray-800 border border-gray-200 px-3 py-1.5 rounded-[3px] text-[12px] font-medium z-[100] items-center shadow-lg tracking-wide dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
                    Start : N/A <span className="mx-1.5 font-normal text-gray-400">|</span> Approved : N/A <span className="mx-1.5 font-normal text-gray-400">|</span> Dead Line : N/A <span className="mx-1.5 font-normal text-gray-400">|</span> DELAY DAYS : N/A
                </div>
            );
        }

        const circleStyles = type === "green"
            ? "w-8 h-8 rounded-full bg-[#00a65a] text-white font-bold"
            : type === "red"
                ? "w-8 h-8 rounded-full bg-[#ef4444] text-white font-bold"
                : "w-9 h-9 rounded-full bg-white dark:bg-zinc-900 text-gray-500 dark:text-slate-400 font-medium border border-gray-100 dark:border-slate-700/50 shadow-[0_2px_8px_rgba(0,0,0,0.08)]";

        return (
            <div className="relative group mx-auto w-fit cursor-pointer">
                <div className={`flex items-center justify-center text-[13px] shadow-sm transition-transform group-hover:scale-105 ${circleStyles}`}>
                    {value}
                </div>
                {tooltipContent}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 min-h-screen bg-[#f4f6f9] font-sans dark:bg-zinc-950">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden pb-8 dark:bg-zinc-900 dark:border-zinc-800">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 dark:border-zinc-800">
                    <h1 className="text-[15px] font-bold text-gray-700 uppercase tracking-wide dark:text-zinc-400">DELAY PROJECTS</h1>
                    <div className="w-[18px] h-[18px] bg-[#00a65a] rounded-sm flex flex-wrap p-[3px] gap-[1px]">
                        <div className="w-[48%] h-[48%] bg-white rounded-[1px] dark:bg-zinc-900"></div>
                        <div className="w-[48%] h-[48%] bg-white rounded-[1px] dark:bg-zinc-900"></div>
                        <div className="w-[48%] h-[48%] bg-white rounded-[1px] dark:bg-zinc-900"></div>
                        <div className="w-[48%] h-[48%] bg-white rounded-[1px] dark:bg-zinc-900"></div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-5">
                    <div className="w-full">
                        <input
                            type="text"
                            placeholder="Search by Company, Project, Project ID, or Create Date (d/m/Y)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-[42px] px-4 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-[#00a65a] transition-colors shadow-sm placeholder:text-gray-400 dark:border-zinc-800"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[max-content]">
                        <thead>
                            <tr className="bg-[#f8f9fa] border-y border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-zinc-400">S.No</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-zinc-400">Pro Id</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-zinc-400">Create</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 min-w-[200px] dark:text-zinc-400">Project</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 min-w-[160px] dark:text-zinc-400">Company</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 dark:text-zinc-400">Person</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 min-w-[140px] dark:text-zinc-400">Dep</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">HOD</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">VAS Docs</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">Dep App</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">Dep Not Assign</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">Task Not Start</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">Dep Not End</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">QA Dep Pending</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">Vfy Dep Pending</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">Project Dead Line</th>
                                <th className="px-4 py-3.5 text-[13px] font-bold text-gray-700 text-center dark:text-zinc-400">Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((row, index) => (
                                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 dark:border-zinc-800">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" className="w-[15px] h-[15px] border-gray-300 rounded-sm text-[#00a65a] focus:ring-[#00a65a] dark:border-zinc-800 dark:text-zinc-400" />
                                            <span className="text-[13px] text-gray-600 font-medium dark:text-zinc-300">{index + 1}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-zinc-300">T:/P:{row.id}</td>
                                    <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-zinc-300">{row.create}</td>
                                    <td className="px-4 py-3 text-[13px] text-gray-600 opacity-90 dark:text-zinc-300">{row.project}</td>
                                    <td className="px-4 py-3 text-[13px] text-[#00a65a] font-medium uppercase dark:text-zinc-400">{row.company}</td>
                                    <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-zinc-300">{row.person}</td>
                                    <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-zinc-300">{row.dep}</td>
                                    <td className="px-4 py-3">{renderCircle(row.hod, "green")}</td>
                                    <td className="px-4 py-3">{renderCircle(row.vasDocs, "red")}</td>
                                    <td className="px-4 py-3">{renderCircle("N/A", "gray")}</td>
                                    <td className="px-4 py-3">{renderCircle("N/A", "gray")}</td>
                                    <td className="px-4 py-3">{renderCircle("N/A", "gray")}</td>
                                    <td className="px-4 py-3">{renderCircle("N/A", "gray")}</td>
                                    <td className="px-4 py-3">{renderCircle("N/A", "gray")}</td>
                                    <td className="px-4 py-3">{renderCircle("N/A", "gray")}</td>
                                    <td className="px-4 py-3">{renderCircle(0, "gray")}</td>
                                    <td className="px-4 py-3 text-[13px] text-gray-600 text-center font-medium dark:text-zinc-300">{row.days}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
