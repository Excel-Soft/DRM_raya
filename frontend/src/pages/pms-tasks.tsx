import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, X, AlertCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskTemplate {
    id: string;
    name: string;
    time: number;
    detail: string | null;
    repeatDaily: number;
    department: string | null;
}

const TASK_TEMPLATES_KEY = "/api/pms/task-templates";

function formatTime(minutes: number): string {
    const safe = Number(minutes) || 0;
    return `${Math.floor(safe / 60)}:${safe % 60}`;
}

export default function PmsTasks() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const {
        data: tasks = [],
        isLoading,
        isError,
        error,
    } = useQuery<TaskTemplate[]>({
        queryKey: [TASK_TEMPLATES_KEY],
        queryFn: () => apiRequestJson<TaskTemplate[]>("GET", TASK_TEMPLATES_KEY),
    });

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

    // Form state
    const [newTaskName, setNewTaskName] = useState("");
    const [newGroup, setNewGroup] = useState("main");
    const [newDepartment, setNewDepartment] = useState("");
    const [newHours, setNewHours] = useState("00");
    const [newMin, setNewMin] = useState("00");
    const [newDetail, setNewDetail] = useState("");
    const [newRepeatDaily, setNewRepeatDaily] = useState(false);

    const createMutation = useMutation({
        mutationFn: (payload: {
            name: string;
            time: number;
            detail: string;
            repeatDaily: number;
            department: string | null;
        }) => apiRequestJson("POST", TASK_TEMPLATES_KEY, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TASK_TEMPLATES_KEY] });
            toast({ title: "Task created", description: "The task was created successfully." });
            setIsAddOpen(false);
            // reset fields
            setNewTaskName("");
            setNewGroup("main");
            setNewDepartment("");
            setNewHours("00");
            setNewMin("00");
            setNewDetail("");
            setNewRepeatDaily(false);
        },
        onError: (err: any) => {
            toast({
                title: "Failed to create task",
                description: err?.message || "An unexpected error occurred.",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("DELETE", `${TASK_TEMPLATES_KEY}/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TASK_TEMPLATES_KEY] });
            toast({ title: "Task deleted", description: "The task was deleted successfully." });
            setIsDeleteOpen(false);
            setTaskToDelete(null);
        },
        onError: (err: any) => {
            toast({
                title: "Failed to delete task",
                description: err?.message || "An unexpected error occurred.",
                variant: "destructive",
            });
        },
    });

    const handleDeleteClick = (id: string) => {
        setTaskToDelete(id);
        setIsDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (taskToDelete !== null) {
            deleteMutation.mutate(taskToDelete);
        }
    };

    const handleSaveTask = () => {
        const timeMinutes = (parseInt(newHours, 10) || 0) * 60 + (parseInt(newMin, 10) || 0);
        createMutation.mutate({
            name: newTaskName || "Untitled Task",
            time: timeMinutes,
            detail: newDetail,
            repeatDaily: newRepeatDaily ? 1 : 0,
            department: newDepartment || null,
        });
    };

    return (
        <div className="flex-1 bg-white min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <div className="p-6">
                {/* Header Title */}
                <h1 className="text-[16px] font-bold text-slate-500 uppercase mb-8 dark:text-zinc-400">TASK MANAMENT SYSTEM</h1>

                {/* Add task button */}
                <Button 
                    onClick={() => setIsAddOpen(true)}
                    className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium h-[35px] px-4 rounded text-[13px] shadow-none mb-8"
                >
                    Add new Task
                </Button>

                {/* Sub Title */}
                <div className="mb-4">
                    <h2 className="text-[14px] font-bold text-[#495057] dark:text-zinc-400">
                        Task details / <span className="text-[#00a65a] font-semibold dark:text-zinc-400">Software Department</span>
                    </h2>
                </div>

                {/* Data Table */}
                <div className="w-full">
                    <table className="w-full text-left border-collapse border border-gray-100 dark:border-zinc-800">
                        <thead>
                            <tr className="bg-[#e4fcde] text-[#495057] text-[13px] font-bold border-b border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">
                                <th className="px-4 py-3 border-r border-[#d3fad5] w-[50px] dark:border-zinc-800">#</th>
                                <th className="px-4 py-3 border-r border-[#d3fad5] text-center w-[350px] dark:border-zinc-800">Name</th>
                                <th className="px-4 py-3 border-r border-[#d3fad5] text-center w-[120px] dark:border-zinc-800">Time</th>
                                <th className="px-4 py-3 border-r border-[#d3fad5] text-center dark:border-zinc-800">Detail</th>
                                <th className="px-4 py-3 border-r border-[#d3fad5] text-center w-[120px] dark:border-zinc-800">Repeat Daily</th>
                                <th className="px-4 py-3 text-center w-[100px]">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-gray-400 dark:text-zinc-500">
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 size={16} className="animate-spin" />
                                            Loading tasks...
                                        </span>
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-red-500">
                                        Failed to load tasks{error instanceof Error ? `: ${error.message}` : ""}.
                                    </td>
                                </tr>
                            ) : tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-gray-400 dark:text-zinc-500">
                                        No tasks found.
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((task, index) => (
                                    <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <td className="px-4 py-4 text-[12px] font-bold text-[#495057] dark:text-zinc-400">{index + 1}</td>
                                        <td className="px-4 py-4 text-[13px] text-gray-500 text-center dark:text-zinc-400">{task.name}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="inline-block bg-[#f1f3f5] text-gray-600 rounded-[3px] px-3 py-1 text-[11px] font-medium border border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                                {formatTime(task.time)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-[13px] text-gray-500 text-center dark:text-zinc-400">{task.detail}</td>
                                        <td className="px-4 py-4 text-[13px] text-[#3b82f6] text-center hover:underline cursor-pointer dark:text-zinc-100">{task.repeatDaily ? "Yes" : "No"}</td>
                                        <td className="px-4 py-4 text-center">
                                            <button 
                                                onClick={() => handleDeleteClick(task.id)}
                                                className="text-[#fca5a5] hover:text-red-600 hover:scale-110 transition-transform flex items-center justify-center mx-auto"
                                            >
                                                <Trash2 size={16} fill="currentColor" strokeWidth={0} className="text-[#ff6b6b]" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Task Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-[550px] p-0 border-0 shadow-xl font-sans bg-white overflow-hidden [&>button]:hidden rounded-md dark:bg-zinc-900">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[18px] font-bold text-[#495057] m-0 p-0 dark:text-zinc-400">
                            ADD Task
                        </DialogTitle>
                        <button 
                            onClick={() => setIsAddOpen(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={20} strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-6 pb-2">
                        {/* Task Name */}
                        <div className="space-y-2 mb-5">
                            <label className="text-[13px] font-bold text-gray-700 dark:text-zinc-400">Task Name:</label>
                            <Input 
                                value={newTaskName}
                                onChange={(e) => setNewTaskName(e.target.value)}
                                placeholder="Create task name"
                                className="h-10 border-gray-200 shadow-none text-[13px] text-gray-600 focus-visible:ring-1 focus-visible:ring-[#00a65a] rounded-sm dark:text-zinc-300 dark:border-zinc-800"
                            />
                        </div>

                        {/* Group and Department */}
                        <div className="grid grid-cols-2 gap-5 mb-5">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-gray-700 dark:text-zinc-400">Group:</label>
                                <Select value={newGroup} onValueChange={setNewGroup}>
                                    <SelectTrigger className="h-10 border-gray-200 shadow-none text-[13px] text-gray-600 focus-visible:ring-1 focus-visible:ring-[#00a65a] rounded-sm bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                        <SelectValue placeholder="Main" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="main">Main</SelectItem>
                                        <SelectItem value="alibaba">Alibaba Initial Steps & Trainings</SelectItem>
                                        <SelectItem value="sales">Sales Daily Task</SelectItem>
                                        <SelectItem value="designer">designer</SelectItem>
                                        <SelectItem value="minisite">minisite</SelectItem>
                                        <SelectItem value="minisite-design">minisite design</SelectItem>
                                        <SelectItem value="data-feeding">Data Feeding</SelectItem>
                                        <SelectItem value="design-department">Design Department</SelectItem>
                                        <SelectItem value="online-store">online store</SelectItem>
                                        <SelectItem value="basic-website">BASIC WEBSITE</SelectItem>
                                        <SelectItem value="professional-website">PROFESSIONAL WEBSITE</SelectItem>
                                        <SelectItem value="enterprise-website">ENTERPRISE WEBSITE</SelectItem>
                                        <SelectItem value="ebay-store-design">EBAY STORE DESIGN</SelectItem>
                                        <SelectItem value="amazon-store-design">AMAZON STORE DESIGN</SelectItem>
                                        <SelectItem value="logo-design">LOGO DESIGN</SelectItem>
                                        <SelectItem value="catalogue-design">CATALOGUE DESIGN</SelectItem>
                                        <SelectItem value="website-banners">WEBSITE BANNERS</SelectItem>
                                        <SelectItem value="professional-website-banners">PROFESSIONAL WEBSITE BANNERS</SelectItem>
                                        <SelectItem value="enterprise-website-banners">ENTERPRISE WEBSITE BANNERS</SelectItem>
                                        <SelectItem value="data-feeding-basic-website">DATA FEEDING BASIC WEBSITE</SelectItem>
                                        <SelectItem value="data-feeding-professional-website">DATA FEEDING PROFESSIONAL WEBSITE</SelectItem>
                                        <SelectItem value="data-feeding-enterprise-website">DATA FEEDING ENTERPRISE WEBSITE</SelectItem>
                                        <SelectItem value="data-feeding-online-store-magento">DATA FEEDING ONLINE STORE MAGENTO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-gray-700 dark:text-zinc-400">Departmant:</label>
                                <Select value={newDepartment} onValueChange={setNewDepartment}>
                                    <SelectTrigger className="h-10 border-gray-200 shadow-none text-[13px] text-gray-500 focus-visible:ring-1 focus-visible:ring-[#00a65a] rounded-sm bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Admin">Admin</SelectItem>
                                        <SelectItem value="Super HOD">Super HOD</SelectItem>
                                        <SelectItem value="Head of Department">Head of Department</SelectItem>
                                        <SelectItem value="Sales Department">Sales Department</SelectItem>
                                        <SelectItem value="Lead Department">Lead Department</SelectItem>
                                        <SelectItem value="Accounts Department">Accounts Department</SelectItem>
                                        <SelectItem value="Service Department">Service Department</SelectItem>
                                        <SelectItem value="Reception Department">Reception Department</SelectItem>
                                        <SelectItem value="IT Department">IT Department</SelectItem>
                                        <SelectItem value="Software Department">Software Department</SelectItem>
                                        <SelectItem value="QA Department">QA Department</SelectItem>
                                        <SelectItem value="Verification Department">Verification Department</SelectItem>
                                        <SelectItem value="Complaint Department">Complaint Department</SelectItem>
                                        <SelectItem value="Marketing Department">Marketing Department</SelectItem>
                                        <SelectItem value="Media Department">Media Department</SelectItem>
                                        <SelectItem value="D&D Department">D&D Department</SelectItem>
                                        <SelectItem value="SEO/SMM Department">SEO/SMM Department</SelectItem>
                                        <SelectItem value="Product Posting">Product Posting</SelectItem>
                                        <SelectItem value="Project Department">Project Department</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Hours and Minutes */}
                        <div className="grid grid-cols-2 gap-5 mb-5">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-gray-700 dark:text-zinc-400">Hours:</label>
                                <Input
                                    value={newHours}
                                    onChange={(e) => setNewHours(e.target.value)}
                                    placeholder="00"
                                    className="h-10 border-gray-200 shadow-none text-[13px] text-gray-600 focus-visible:ring-1 focus-visible:ring-[#00a65a] rounded-sm dark:text-zinc-300 dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-gray-700 dark:text-zinc-400">Min:</label>
                                <Select value={newMin} onValueChange={setNewMin}>
                                    <SelectTrigger className="h-10 border-gray-200 shadow-none text-[13px] text-gray-600 focus-visible:ring-1 focus-visible:ring-[#00a65a] rounded-sm bg-white font-medium dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                        <SelectValue placeholder="00" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="00">00</SelectItem>
                                        <SelectItem value="15">15</SelectItem>
                                        <SelectItem value="30">30</SelectItem>
                                        <SelectItem value="45">45</SelectItem>
                                        <SelectItem value="60">60</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Detail Textarea */}
                        <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 mb-1">
                                <label className="text-[14px] font-bold text-gray-700 dark:text-zinc-400">Detail:</label>
                                <div className="flex items-center gap-1.5 ml-1">
                                    <Checkbox 
                                        id="repeat-daily" 
                                        checked={newRepeatDaily}
                                        onCheckedChange={(checked) => setNewRepeatDaily(checked === true)}
                                        className="w-4 h-4 rounded-sm border-gray-300 data-[state=checked]:bg-[#00a65a] data-[state=checked]:border-[#00a65a] dark:border-zinc-800" 
                                    />
                                    <label htmlFor="repeat-daily" className="text-[13px] font-bold text-[#495057] cursor-pointer dark:text-zinc-400">
                                        Repeat Daily
                                    </label>
                                </div>
                            </div>
                            <Textarea 
                                value={newDetail}
                                onChange={(e) => setNewDetail(e.target.value)}
                                className="min-h-[90px] w-full border-gray-200 shadow-none text-[13px] text-gray-600 focus-visible:ring-1 focus-visible:ring-[#00a65a] resize-y rounded-sm bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" 
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsAddOpen(false)}
                            className="bg-[#f1f4f9] hover:bg-[#e2e8f0] text-slate-700 font-medium h-[38px] px-6 text-[14px] shadow-none rounded-[4px] dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400"
                        >
                            Close
                        </Button>
                        <Button 
                            onClick={handleSaveTask}
                            disabled={createMutation.isPending}
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium h-[38px] px-6 text-[14px] shadow-none rounded-[4px]"
                        >
                            {createMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="max-w-[450px] p-8 border-0 shadow-2xl font-sans bg-white overflow-hidden rounded-xl [&>button]:hidden flex flex-col items-center text-center dark:bg-zinc-900">
                    <div className="w-20 h-20 rounded-full border-[3px] border-[#f8d79b] flex items-center justify-center mb-6 dark:border-zinc-800">
                        <AlertCircle size={40} strokeWidth={2.5} className="text-[#f8b85b]" />
                    </div>
                    
                    <h2 className="text-[26px] font-bold text-[#555] mb-8 dark:text-zinc-100">Are you sure to Delete Task?</h2>
                    
                    <div className="flex items-center justify-center gap-4 w-full">
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsDeleteOpen(false)}
                            className="bg-[#f1f3f5] hover:bg-[#e9ecef] border border-[#dee2e6] text-[#495057] font-bold h-[42px] px-6 text-[15px] shadow-none rounded w-[110px] dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-800"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={confirmDelete}
                            disabled={deleteMutation.isPending}
                            className="bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold h-[42px] px-6 text-[15px] shadow-none rounded w-[110px] dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                            {deleteMutation.isPending ? "..." : "OK"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
