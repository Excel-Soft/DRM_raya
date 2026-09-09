import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, X, Search, SlidersHorizontal, ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AssignmentMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
}

interface AssignmentItem {
  projectId: string;
  projectName: string | null;
  status: string | null;
  startDate: string | null;
  dueDate: string | null;
  owner: { id: string; name: string | null; email: string | null } | null;
  members: AssignmentMember[];
  myRole: string | null;
  taskCounts: {
    total: number;
    todo: number;
    inProgress: number;
    blocked: number;
    completed: number;
    overdue: number;
  };
}

interface AssignmentsResponse {
  success: boolean;
  data: {
    items: AssignmentItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

interface ProjectTask {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  projectId: string | null;
  assigneeName: string | null;
  projectName: string | null;
  createdAt: string | null;
}

function useDDExecutives() {
  return useQuery({
    queryKey: ["dd-executives-only-v2"],
    queryFn: async () => {
      const data = await apiRequestJson<any>("GET", "/api/users?role=dd_executive");
      const users: any[] = data?.users || [];

      // Use rawRole (exact DB value) — NOT the normalized role which maps all *_executive to dd_executive
      const ddOnly = users.filter((u: any) =>
        u.isActive !== false &&
        (u.rawRole === "dd_executive" || u.rawRole === "d_d_executive")
      );

      const options: { label: string; isHeader?: boolean }[] = [
        { label: "Tasker", isHeader: true },
        { label: "To-Do List" },
        ...ddOnly.map((u: any) => ({ label: (u.fullName || u.email || "Unknown").trim() })),
      ];
      return options;
    },
    staleTime: 0,
  });
}


const taskTypeOptions = [
  { label: "Choose..." },
  { label: "Long Term" },
  { label: "Short Term" },
  { label: "Immediately" },
];

function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder 
}: { 
  options: { label: string, isHeader?: boolean }[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.isHeader || opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        className="flex h-10 w-full cursor-pointer items-center justify-between rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-[14px] text-[#44556d] dark:text-zinc-300"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{value || placeholder}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 dark:text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-gray-400 dark:text-zinc-500" />}
      </div>
      
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 max-h-[250px] w-full overflow-y-auto rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-400">
          <div className="sticky top-0 bg-white dark:bg-zinc-900 p-2 border-b border-gray-100 dark:border-zinc-800">
            <input 
              type="text" 
              className="w-full rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-[13px] text-[#44556d] dark:text-zinc-200 outline-none focus:border-[#35c78e]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="py-1">
            {filteredOptions.map((opt, i) => (
              opt.isHeader ? (
                <div key={i} className="px-3 py-2 text-[13px] font-bold text-[#44556d] dark:text-zinc-300">
                  {opt.label}
                </div>
              ) : (
                <div 
                  key={i}
                  className={`cursor-pointer px-3 py-2 text-[14px] transition-colors ${value === opt.label ? 'bg-[#f4f6f8] dark:bg-zinc-800 text-[#44556d] dark:text-zinc-300' : 'text-[#44556d] dark:text-zinc-300 hover:bg-[#0e9a55] hover:text-white'}`}
                  onClick={() => {
                    onChange(opt.label);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  {opt.label}
                </div>
              )
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-[13px] text-gray-500 dark:text-zinc-500">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RichTextEditor() {
  const editorRef = useRef<HTMLDivElement>(null);

  const handleCommand = (command: string, value: string = "") => {
    // Focus the editor first so execCommand applies to it
    editorRef.current?.focus();
    document.execCommand(command, false, value || undefined);
  };

  return (
    <div className="rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#cfd7e3] dark:border-zinc-700 bg-[#f8f9fa] dark:bg-zinc-800 px-3 py-2 text-[13px] text-[#44556d] dark:text-zinc-300">
        <select 
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => handleCommand('fontName', e.target.value)}
          className="bg-transparent outline-none cursor-pointer text-[#44556d] dark:text-zinc-300"
        >
          <option value="Arial">Sans Serif</option>
          <option value="Times New Roman">Serif</option>
          <option value="Courier New">Monospace</option>
        </select>
        
        <select 
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => handleCommand('fontSize', e.target.value)}
          className="bg-transparent outline-none cursor-pointer text-[#44556d] dark:text-zinc-300"
        >
          <option value="3">Normal</option>
          <option value="1">Small</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>

        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('bold'); }} 
          className="font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Bold"
        >B</button>
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('italic'); }} 
          className="italic hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Italic"
        >I</button>
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('underline'); }} 
          className="underline hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Underline"
        >U</button>
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('strikeThrough'); }} 
          className="line-through hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Strikethrough"
        >S</button>
        
        <div className="h-4 w-[1px] bg-gray-300 dark:bg-zinc-700"></div>
        
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('superscript'); }} 
          className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Superscript"
        >X²</button>
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('subscript'); }} 
          className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Subscript"
        >X₂</button>
        
        <div className="h-4 w-[1px] bg-gray-300 dark:bg-zinc-700"></div>
        
        <select 
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => handleCommand('formatBlock', e.target.value)}
          className="bg-transparent outline-none cursor-pointer text-[#44556d] dark:text-zinc-300"
        >
          <option value="p">Normal</option>
          <option value="H1">Heading 1</option>
          <option value="H2">Heading 2</option>
          <option value="BLOCKQUOTE">Quote</option>
        </select>

        <div className="h-4 w-[1px] bg-gray-300 dark:bg-zinc-700"></div>
        
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('justifyLeft'); }} 
          className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" 
          title="Align Left"
        >≡</button>
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('justifyCenter'); }} 
          className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" 
          title="Align Center"
        >=</button>
        <button 
          type="button" 
          onMouseDown={(e) => { e.preventDefault(); handleCommand('justifyRight'); }} 
          className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" 
          title="Align Right"
        >-</button>

        <div className="h-4 w-[1px] bg-gray-300 dark:bg-zinc-700"></div>

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleCommand('insertUnorderedList'); }}
          className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Bullet List"
        >• List</button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleCommand('insertOrderedList'); }}
          className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none"
          title="Numbered List"
        >1. List</button>
      </div>
      <div 
        ref={editorRef}
        contentEditable 
        suppressContentEditableWarning
        className="min-h-[200px] w-full resize-y p-4 text-[14px] outline-none focus:ring-0 overflow-auto bg-white dark:bg-zinc-900"
        style={{ cursor: "text" }}
        data-placeholder="Type description here..."
        onFocus={(e) => {
          if (!e.currentTarget.textContent?.trim()) {
            e.currentTarget.style.color = '#44556d';
          }
        }}
      ></div>
    </div>
  );
}

interface WorkspaceChannel {
  name: string;
  projectId: string;
  count?: number;
}

interface WorkspaceGroup {
  id: string;
  name: string;
  subItems: WorkspaceChannel[];
}

export default function PmsTeamWorkspace() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch D&D Executives dynamically from DB
  const { data: ddExecOptions } = useDDExecutives();
  const personOptions = ddExecOptions ?? [];

  // Real team-workspace assignments (scoped to the current user on the server)
  const {
    data: assignmentsResp,
    isLoading: workspacesLoading,
    isError: workspacesError,
  } = useQuery<AssignmentsResponse>({
    queryKey: ["/api/pms/team-workspace/assignments"],
    queryFn: () =>
      apiRequestJson<AssignmentsResponse>(
        "GET",
        "/api/pms/team-workspace/assignments?page=1&pageSize=100",
      ),
  });

  // Group the real project assignments by owner into workspaces with project "channels"
  const workspaces = useMemo<WorkspaceGroup[]>(() => {
    const items = assignmentsResp?.data?.items ?? [];
    const map = new Map<string, WorkspaceGroup>();
    for (const item of items) {
      const ownerName = item.owner?.name?.trim() || "Unassigned";
      if (!map.has(ownerName)) {
        map.set(ownerName, { id: ownerName, name: `${ownerName} Tasks`, subItems: [] });
      }
      map.get(ownerName)!.subItems.push({
        name: item.projectName || "Untitled Project",
        projectId: item.projectId,
        count: item.taskCounts?.total ? item.taskCounts.total : undefined,
      });
    }
    return Array.from(map.values());
  }, [assignmentsResp]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newWorkspaceTitle, setNewWorkspaceTitle] = useState("");

  // New state for adding channels (sub-items)
  const [channelModalWorkspace, setChannelModalWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [newChannelTitle, setNewChannelTitle] = useState("");

  // New state for viewing a specific channel's details
  const [selectedChannel, setSelectedChannel] = useState<WorkspaceChannel | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // State for Create New Task filters
  const [taskPerson, setTaskPerson] = useState("To-Do List");
  const [taskTypeState, setTaskTypeState] = useState("Choose...");
  const [taskName, setTaskName] = useState("");
  const [taskPriority, setTaskPriority] = useState("Normal");

  // Real tasks for the currently selected channel (project)
  const {
    data: channelTasksData,
    isLoading: tasksLoading,
    isError: tasksError,
  } = useQuery<ProjectTask[]>({
    queryKey: ["/api/pms/project-tasks", selectedChannel?.projectId],
    queryFn: () =>
      apiRequestJson<ProjectTask[]>(
        "GET",
        `/api/pms/project-tasks/${selectedChannel!.projectId}`,
      ),
    enabled: !!selectedChannel?.projectId,
  });
  const currentChannelTasks = channelTasksData ?? [];

  const createTaskMutation = useMutation({
    mutationFn: (payload: {
      channelName: string;
      taskName: string;
      personName: string;
      priority: string;
      taskType: string;
    }) => apiRequestJson("POST", "/api/pms/workspace-tasks", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pms/project-tasks", selectedChannel?.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pms/team-workspace/assignments"] });
      toast({ title: "Task created", description: "The task was added successfully." });
      setShowCreateTaskModal(false);
      setTaskName("");
      setTaskPriority("Normal");
      setTaskPerson("To-Do List");
      setTaskTypeState("Choose...");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create task",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const handleSaveNewTask = () => {
    if (!taskName.trim()) {
      toast({
        title: "Task name required",
        description: "Please enter a task name.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedChannel) return;

    createTaskMutation.mutate({
      channelName: selectedChannel.name,
      taskName: taskName.trim(),
      personName: taskPerson,
      priority: taskPriority,
      taskType: taskTypeState,
    });
  };

  const handleAddWorkspace = () => {
    if (newWorkspaceTitle.trim() === "") return;
    toast({
      title: "Workspaces are managed automatically",
      description: "Workspaces are derived from your project assignments and cannot be created here.",
    });
    setNewWorkspaceTitle("");
    setShowAddModal(false);
  };

  const handleAddChannel = () => {
    if (!channelModalWorkspace || newChannelTitle.trim() === "") return;
    toast({
      title: "Channels are managed automatically",
      description: "Channels reflect the projects you are assigned to and cannot be created here.",
    });
    setNewChannelTitle("");
    setChannelModalWorkspace(null);
  };

  if (selectedChannel) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-zinc-950 p-4 lg:p-6">
        <div className="mb-4 flex items-center gap-3">
          <button 
            onClick={() => setSelectedChannel(null)}
            className="text-[#44556d] dark:text-zinc-300 hover:text-[#2f4058] dark:hover:text-zinc-200"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-[18px] font-bold uppercase tracking-tight text-[#3d4a5d] dark:text-zinc-100">
            {selectedChannel.name}
          </h1>
        </div>

        <div className="rounded-md bg-white dark:bg-zinc-900 p-6 shadow-[0_0_0_1px_rgba(226,232,240,0.55)]">
          <div className="mb-4 flex gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 text-[#44556d] dark:text-zinc-300 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800">
              <Search className="h-4 w-4" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 text-[#44556d] dark:text-zinc-300 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setShowCreateTaskModal(true)}
              className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 text-[#44556d] dark:text-zinc-300 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto border-b-2 border-gray-400 dark:border-zinc-700">
            <table className="w-full whitespace-nowrap text-left text-[14px]">
              <thead className="bg-[#d9f3ec] dark:bg-zinc-800 text-[#2f4058] dark:text-zinc-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">S.No</th>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Created At</th>
                  <th className="px-4 py-3 font-semibold">Task Assigned To ⇋</th>
                  <th className="px-4 py-3 font-semibold">Status ⇋</th>
                  <th className="px-4 py-3 font-semibold">Priority ⇋</th>
                  <th className="px-4 py-3 font-semibold">Task Type ⇋</th>
                </tr>
              </thead>
              <tbody>
                {tasksLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[#9aabb8] dark:text-zinc-500">
                      Loading tasks…
                    </td>
                  </tr>
                ) : tasksError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[#dc2626]">
                      Failed to load tasks. Please try again.
                    </td>
                  </tr>
                ) : currentChannelTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[#9aabb8] dark:text-zinc-500">
                      No tasks yet — click + to add a task
                    </td>
                  </tr>
                ) : (
                  currentChannelTasks.map((t: ProjectTask, idx: number) => (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-3 text-[#44556d] dark:text-zinc-300">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-[#0e9a55]">{t.projectName || "-"}</td>
                      <td className="px-4 py-3 font-semibold text-[#2f4058] dark:text-zinc-200">{t.title}</td>
                      <td className="px-4 py-3 text-[#6b7a90] dark:text-zinc-400">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-[#44556d] dark:text-zinc-300">{t.assigneeName || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {t.status || "ToDo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          t.priority === "Urgent" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                          t.priority === "High" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}>{t.priority || "Normal"}</span>
                      </td>
                      <td className="px-4 py-3 text-[#6b7a90] dark:text-zinc-400">{t.description || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="text-[13px] text-[#6b7a90] dark:text-zinc-400">
              Showing {currentChannelTasks.length} of {currentChannelTasks.length} entries
            </div>
            <div className="flex items-center gap-1">
              <button className="flex h-8 w-8 items-center justify-center rounded-[4px] text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800">
                &lt;
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#0e9a55] text-white">
                1
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-[4px] text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800">
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Create New Task Modal */}
        {showCreateTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 py-10">
            <div className="flex h-full max-h-[90vh] w-[800px] flex-col overflow-hidden rounded-[8px] bg-white dark:bg-zinc-900 shadow-lg">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[20px] font-semibold text-[#44556d] dark:text-zinc-300">Create New Task</h2>
                  <span className="text-[14px] font-medium text-[#0e9a55]">04-05-2026 07:18 PM</span>
                </div>
                <button 
                  onClick={() => setShowCreateTaskModal(false)}
                  className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Company</label>
                    <div className="w-full rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 bg-[#f4f6f8] dark:bg-zinc-800 px-3 py-2 text-[14px] text-[#44556d] dark:text-zinc-300">
                      {selectedChannel.name}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Task Name</label>
                    <Input 
                      placeholder="Enter Task Name" 
                      className="w-full rounded-[4px] border-[#cfd7e3] dark:border-zinc-700"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Person</label>
                    <SearchableSelect 
                      options={personOptions} 
                      value={taskPerson} 
                      onChange={setTaskPerson}
                      placeholder="Choose..."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Task Type</label>
                    <SearchableSelect 
                      options={taskTypeOptions} 
                      value={taskTypeState} 
                      onChange={setTaskTypeState} 
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Days</label>
                    <Input placeholder="Working Days" className="w-full rounded-[4px] border-[#cfd7e3] dark:border-zinc-700" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Links</label>
                    <Input placeholder="Working Links" className="w-full rounded-[4px] border-[#cfd7e3] dark:border-zinc-700" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Task Show Date</label>
                    <Input type="date" className="w-full rounded-[4px] border-[#cfd7e3] dark:border-zinc-700 text-[#44556d] dark:text-zinc-300" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Priority</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[14px] text-[#44556d] dark:text-zinc-300">
                      <input 
                        type="radio" 
                        name="priority" 
                        checked={taskPriority === "Urgent"}
                        onChange={() => setTaskPriority("Urgent")}
                        className="h-4 w-4 accent-[#0e9a55]" 
                      /> Urgent
                    </label>
                    <label className="flex items-center gap-2 text-[14px] text-[#44556d] dark:text-zinc-300">
                      <input 
                        type="radio" 
                        name="priority" 
                        checked={taskPriority === "High"}
                        onChange={() => setTaskPriority("High")}
                        className="h-4 w-4 accent-[#0e9a55]" 
                      /> High
                    </label>
                    <label className="flex items-center gap-2 text-[14px] text-[#44556d] dark:text-zinc-300">
                      <input 
                        type="radio" 
                        name="priority" 
                        checked={taskPriority === "Normal"}
                        onChange={() => setTaskPriority("Normal")}
                        className="h-4 w-4 accent-[#0e9a55]" 
                      /> Normal
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-[14px] font-medium text-[#44556d] dark:text-zinc-300">Detail</label>
                  <RichTextEditor />
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 border-t bg-[#fdfdfd] dark:bg-zinc-900 px-6 py-4">
                <button
                  onClick={() => setShowCreateTaskModal(false)}
                  className="rounded-[4px] bg-[#f1f5f9] dark:bg-zinc-800 px-5 py-2.5 text-[15px] font-medium text-[#475569] dark:text-zinc-300 transition-colors hover:bg-[#e2e8f0] dark:hover:bg-zinc-700"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveNewTask}
                  disabled={createTaskMutation.isPending}
                  className="rounded-[4px] bg-[#0e9a55] px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#0b7a43] disabled:opacity-60"
                >
                  {createTaskMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-zinc-950 p-4 lg:p-6">
      <div className="rounded-md bg-white dark:bg-zinc-900 p-6 shadow-[0_0_0_1px_rgba(226,232,240,0.55)]">
        <h1 className="mb-5 text-[18px] font-bold uppercase tracking-tight text-[#3d4a5d] dark:text-zinc-100">
          WORK SPACE
        </h1>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="mb-4 rounded-[4px] bg-[#0e9a55] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#0b7a43]"
        >
          Add New Work Space
        </button>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-[#d9f3ec] dark:bg-zinc-800 text-[#2f4058] dark:text-zinc-200">
              <tr>
                <th className="w-16 px-4 py-3 font-semibold">S.No</th>
                <th className="px-4 py-3 font-semibold">Work Space</th>
                <th className="w-24 px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {workspacesLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-[13px] text-[#9aabb8] dark:text-zinc-500">
                    Loading workspaces…
                  </td>
                </tr>
              ) : workspacesError ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-[13px] text-[#dc2626]">
                    Failed to load workspaces. Please try again.
                  </td>
                </tr>
              ) : workspaces.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-[13px] text-[#9aabb8] dark:text-zinc-500">
                    No workspaces found.
                  </td>
                </tr>
              ) : (
                workspaces.map((workspace, index) => (
                <tr key={workspace.id} className="border-b border-gray-100 dark:border-zinc-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-4 align-top text-[#44556d] dark:text-zinc-300">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4">
                    <div className="mb-1 text-[14px] text-[#44556d] dark:text-zinc-300">{workspace.name}</div>
                    {workspace.subItems && workspace.subItems.length > 0 && (
                      <div className="pl-6 space-y-1 mt-1">
                        {workspace.subItems.map((sub, i) => (
                          <div 
                            key={i} 
                            onClick={() => setSelectedChannel(sub)}
                            className="flex cursor-pointer items-center text-[13px] text-[#35c78e] hover:underline"
                          >
                            {sub.name}
                            {sub.count !== undefined && (
                              <span className="ml-2 flex items-center text-[#6b7a90] dark:text-zinc-400">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                  <line x1="16" y1="13" x2="8" y2="13"></line>
                                  <line x1="16" y1="17" x2="8" y2="17"></line>
                                  <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                                {sub.count}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setChannelModalWorkspace({ id: workspace.id, name: workspace.name })}
                        className="rounded-full p-1 text-[#35c78e] transition-colors hover:bg-[#35c78e]/10"
                      >
                        <Plus className="h-[18px] w-[18px]" />
                      </button>
                      <button className="rounded-full p-1 text-[#ff6b6b] transition-colors hover:bg-[#ff6b6b]/10">
                        <Trash2 className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[500px] overflow-hidden rounded-[8px] bg-white dark:bg-zinc-900 shadow-lg">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-[20px] font-semibold text-[#44556d] dark:text-zinc-300">Add New Work Space</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="mb-2 block text-[15px] font-medium text-[#44556d] dark:text-zinc-300">
                Work Space Title:
              </label>
              <Input
                value={newWorkspaceTitle}
                onChange={(e) => setNewWorkspaceTitle(e.target.value)}
                className="w-full rounded-[4px] border-[#cfd7e3] dark:border-zinc-700 focus-visible:ring-1 focus-visible:ring-[#35c78e] focus-visible:ring-offset-0"
              />
            </div>
            
            <div className="flex items-center justify-end gap-3 border-t bg-[#fdfdfd] dark:bg-zinc-900 px-6 py-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-[4px] bg-[#f1f5f9] dark:bg-zinc-800 px-5 py-2.5 text-[15px] font-medium text-[#475569] dark:text-zinc-300 transition-colors hover:bg-[#e2e8f0] dark:hover:bg-zinc-700"
              >
                Close
              </button>
              <button
                onClick={handleAddWorkspace}
                className="rounded-[4px] bg-[#0e9a55] px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#0b7a43]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Channel Modal */}
      {channelModalWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[500px] overflow-hidden rounded-[8px] bg-white dark:bg-zinc-900 shadow-lg">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-[20px] font-semibold text-[#44556d] dark:text-zinc-300">Add New Channel</h2>
              <button 
                onClick={() => setChannelModalWorkspace(null)}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="mb-2 block text-[15px] font-medium text-[#44556d] dark:text-zinc-300">
                  Work Space:
                </label>
                <div className="w-full rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700 bg-[#f4f6f8] dark:bg-zinc-800 px-3 py-2 text-[15px] text-[#44556d] dark:text-zinc-300">
                  {channelModalWorkspace.name}
                </div>
              </div>
              
              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#44556d] dark:text-zinc-300">
                  Channel Title:
                </label>
                <Input
                  value={newChannelTitle}
                  onChange={(e) => setNewChannelTitle(e.target.value)}
                  className="w-full rounded-[4px] border-[#cfd7e3] dark:border-zinc-700 focus-visible:ring-1 focus-visible:ring-[#35c78e] focus-visible:ring-offset-0"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 border-t bg-[#fdfdfd] dark:bg-zinc-900 px-6 py-4">
              <button
                onClick={() => setChannelModalWorkspace(null)}
                className="rounded-[4px] bg-[#f1f5f9] dark:bg-zinc-800 px-5 py-2.5 text-[15px] font-medium text-[#475569] dark:text-zinc-300 transition-colors hover:bg-[#e2e8f0] dark:hover:bg-zinc-700"
              >
                Close
              </button>
              <button
                onClick={handleAddChannel}
                className="rounded-[4px] bg-[#0e9a55] px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#0b7a43]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
