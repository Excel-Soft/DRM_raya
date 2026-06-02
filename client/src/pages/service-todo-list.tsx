import { useState } from "react";
import { ArrowRight, Trash2, Bold, Italic, Underline, Link, List, ListOrdered, RemoveFormatting } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ServiceTodoList() {
    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header Title */}
            <div className="mb-4 flex items-center gap-2 text-[#059669] dark:text-zinc-400">
                <ArrowRight className="w-5 h-5" />
                <h2 className="text-[17px] font-bold uppercase tracking-tight text-[#475569] dark:text-zinc-400">
                    TO DO LIST
                </h2>
            </div>
            {/* Form */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-4 mb-4 dark:bg-zinc-900 dark:border-zinc-800">
                <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Create To Do List</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <Label className="text-[13px] text-slate-600 mb-1.5 block dark:text-zinc-300">Task</Label>
                        <Input placeholder="enter banner title" className="text-[13px] h-9" />
                    </div>
                    <div>
                        <Label className="text-[13px] text-slate-600 mb-1.5 block dark:text-zinc-300">File</Label>
                        <Input type="file" className="text-[13px] h-9" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <Label className="text-[13px] text-slate-600 mb-1.5 block dark:text-zinc-300">Category</Label>
                        <Select>
                            <SelectTrigger className="text-[13px] h-9">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="dev">Development</SelectItem>
                                <SelectItem value="design">Design</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-[13px] text-slate-600 mb-1.5 block dark:text-zinc-300">Time</Label>
                                <Input type="time" className="text-[13px] h-9" />
                            </div>
                            <div>
                                <Label className="text-[13px] text-slate-600 mb-1.5 block dark:text-zinc-300">Date</Label>
                                <Input type="date" className="text-[13px] h-9" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <Label className="text-[13px] text-slate-600 mb-1.5 block dark:text-zinc-300">Participants</Label>
                        <Select>
                            <SelectTrigger className="text-[13px] h-9">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="self">Self</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-[13px] text-slate-600 dark:text-zinc-300">
                    <div>
                        <Label className="text-[13px] text-slate-600 mb-2.5 block dark:text-zinc-300">Priority</Label>
                        <RadioGroup defaultValue="high" className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="high" id="p-high" />
                                <Label htmlFor="p-high" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">High</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="medium" id="p-medium" />
                                <Label htmlFor="p-medium" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Medium</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="low" id="p-low" />
                                <Label htmlFor="p-low" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Low</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div>
                        <Label className="text-[13px] text-slate-600 mb-2.5 block dark:text-zinc-300">Repeat Task</Label>
                        <RadioGroup defaultValue="none" className="flex flex-wrap gap-x-4 gap-y-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="hour" id="rt-hour" />
                                <Label htmlFor="rt-hour" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Hour</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="daily" id="rt-daily" />
                                <Label htmlFor="rt-daily" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Daily</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="weekly" id="rt-weekly" />
                                <Label htmlFor="rt-weekly" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Weekly</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="monthly" id="rt-monthly" />
                                <Label htmlFor="rt-monthly" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Monthly</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yearly" id="rt-yearly" />
                                <Label htmlFor="rt-yearly" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Yearly</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div>
                        <Label className="text-[13px] text-slate-600 mb-2.5 block dark:text-zinc-300">Reminder</Label>
                        <RadioGroup defaultValue="none" className="flex flex-wrap gap-x-4 gap-y-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="same" id="rm-same" />
                                <Label htmlFor="rm-same" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">Same with due date</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="5m" id="rm-5m" />
                                <Label htmlFor="rm-5m" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">5 minutes before</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="10m" id="rm-10m" />
                                <Label htmlFor="rm-10m" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">10 minutes before</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="15m" id="rm-15m" />
                                <Label htmlFor="rm-15m" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">15 minutes before</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="1d" id="rm-1d" />
                                <Label htmlFor="rm-1d" className="text-[13px] font-normal cursor-pointer text-slate-600 dark:text-zinc-300">1 day before</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                        <Label className="text-[13px] text-slate-600 dark:text-zinc-300">Description</Label>
                        <button className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="border border-slate-200 rounded-[4px] overflow-hidden dark:border-zinc-800">
                        <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto dark:bg-zinc-900 dark:border-zinc-800">
                            <select className="text-[13px] text-slate-700 bg-transparent border-none outline-none mr-2 dark:text-zinc-400">
                                <option>Normal</option>
                                <option>Heading 1</option>
                                <option>Heading 2</option>
                            </select>
                            <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"><Bold className="w-4 h-4" /></button>
                            <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"><Italic className="w-4 h-4" /></button>
                            <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"><Underline className="w-4 h-4" /></button>
                            <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"><Link className="w-4 h-4" /></button>
                            <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"><List className="w-4 h-4" /></button>
                            <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"><ListOrdered className="w-4 h-4" /></button>
                            <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"><RemoveFormatting className="w-4 h-4" /></button>
                        </div>
                        <div className="min-h-[100px] w-full bg-white p-3 outline-none focus:outline-none dark:bg-zinc-900" contentEditable />
                    </div>
                </div>

                <div className="mb-4">
                    <Button className="bg-[#2eb886] hover:bg-[#259b6f] text-white text-[13px] h-9 px-4 rounded-[4px]">
                        Add Row
                    </Button>
                </div>

                <Button className="w-full bg-[#059669] hover:bg-[#047857] text-white text-[14px] h-10 rounded-[4px] font-medium">
                    Submit
                </Button>
            </div>

            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">To Do List Task</h3>
                <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px] bg-[#f1f5f9] rounded py-2.5 px-4 flex justify-between items-center text-[13px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        Assign To Do Task
                        <span className="text-blue-500">2</span>
                    </div>
                    <div className="flex-1 min-w-[200px] bg-[#f1f5f9] rounded py-2.5 px-4 flex justify-between items-center text-[13px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        Un-received
                        <span className="text-blue-500">0</span>
                    </div>
                    <div className="flex-1 min-w-[200px] bg-[#f1f5f9] rounded py-2.5 px-4 flex justify-between items-center text-[13px] font-medium text-[#10b981] dark:bg-zinc-800 dark:text-zinc-100">
                        Received
                        <span className="text-blue-500">0</span>
                    </div>
                    <div className="flex-1 min-w-[200px] bg-[#f1f5f9] rounded py-2.5 px-4 flex justify-between items-center text-[13px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        Pending
                        <span className="text-blue-500">10</span>
                    </div>
                    <div className="flex-1 min-w-[200px] bg-[#f1f5f9] rounded py-2.5 px-4 flex justify-between items-center text-[13px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        Finished
                        <span className="text-blue-500">5</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
