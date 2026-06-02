import { useMemo, useState, useEffect } from "react";
import {
  ArrowRightCircle, ArrowRightLeft, ChevronDown, ChevronLeft, ChevronRight,
  Link2, Loader2, MapPin, Settings, Users,
  CheckCircle2, Clock, CalendarDays, Activity, Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import ServicePrivatePool from "@/pages/service-private-pool";


type AssignedTab = "today" | "waiting";
type ViewMode =
  | "dashboard"
  | "running-projects"
  | "pending-projects"
  | "project-task"
  | "overtime"
  | "private-pool"
  | "todo-list"
  | "attendance"
  | "leave-application"
  | "add-uae-customer";

const topCards = [
  { label: "Total Task", value: "5", icon: Users },
  { label: "Pending", value: "5", icon: ArrowRightLeft },
  { label: "Running", value: "0", icon: MapPin },
  { label: "Complete", value: "0", icon: Settings },
];

const projectOverview = [
  ["Running Project", "Pending Project"],
  ["Project Task", "Over Time"],
  ["Leave Application", "Attendance"],
  ["Add Uae Customer", "Private Pool"],
];

const importantRows = [
  ["Notice", "0"],
  ["Portfolio", "30(5800)"],
  ["Add Portfolio", "38"],
  ["Login Time", "05:29 PM"],
  ["To Do List", ""],
];

const activityLabels: Record<string, string> = {
  mobile: "Mobile",
  whatsapp: "Whatsapp",
  wh_call: "WH-Call",
  in_meeting: "In-meeting",
  out_meeting: "Out-meeting",
  email: "E-mail",
  appointment: "Appointment",
  seminar: "Seminar",
};

export default function SoftwareExecutiveDashboard() {
  const [assignedTab, setAssignedTab] = useState<AssignedTab>("today");
  const [softwareTasks, setSoftwareTasks] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [showAddOvertime, setShowAddOvertime] = useState(false);

  // Fetch summary stats using the same executive endpoint to guarantee data parity
  const { data: summaryStats } = useQuery({ queryKey: ["/api/dd-executive/summary"] });
  const { data: dailyReportData } = useQuery({ queryKey: ["/api/dd-executive/daily-report"] });
  const { data: monthlyCompleteData } = useQuery({ queryKey: ["/api/dd-executive/monthly-complete"] });
  const { data: taskListData } = useQuery({ queryKey: [`/api/dd-executive/tasks/${assignedTab}`] });

  const [topSellingFilter, setTopSellingFilter] = useState("LD");
  const [dailyReportFilter, setDailyReportFilter] = useState("daily");
  const [monthlyCompleteFilter, setMonthlyCompleteFilter] = useState("WK");
  const [activitiesFilter, setActivitiesFilter] = useState("TD");

  const { data: activityPlanData } = useQuery({
    queryKey: [`/api/sales/activity-plan?period=${activitiesFilter}`]
  });

  const [todoForm, setTodoForm] = useState({
    task: "",
    fileName: "",
    category: "Choose...",
    time: "",
    date: "",
    participants: "Choose ...",
    priority: "High",
    repeatTask: "",
    reminder: "",
    description: "",
  });
  const [todoDraftRows, setTodoDraftRows] = useState<Array<{ id: number; task: string; category: string; priority: string }>>([]);
  const [todoStats, setTodoStats] = useState({
    assign: 2,
    unreceived: 0,
    received: 0,
    pending: 10,
    finished: 5,
  });
  const [todoMessage, setTodoMessage] = useState("");
  const [customerForm, setCustomerForm] = useState({
    companyName: "",
    countryRegion: "UAE",
    companyType: "Choose...",
    city: "Choose...",
    landlineNo: "",
    mobileNo: "",
    title: "Choose...",
    personFullName: "",
    personalMobileNo: "123456789",
    website: "",
    email: "",
    address: "",
    googleMap: "",
    tagSearch: "",
    selectedTags: [] as string[],
  });
  const [customerMessage, setCustomerMessage] = useState<string>("");
  const [companyTypeOptions, setCompanyTypeOptions] = useState([
    "Choose...",
    "Manufacturer",
    "Trading",
    "Wholesaler",
  ]);
  const [pendingCompanyType, setPendingCompanyType] = useState("");
  const [showCompanyTypeInput, setShowCompanyTypeInput] = useState(false);
  const [tagItems, setTagItems] = useState([
    "Expansion bolts",
    "Expansion anchors",
    "Drop in anchor & cut anchor",
    "Drop in anchor",
    "Curtain walling Contract manufacturing",
    "Continuity systems",
    "Channel",
    "Cast in channels",
    "Build forming parts",
    "Brickwork ties",
    "Brickwork supports",
    "Brickwork restraints",
    "Binu mathew",
    "Anker Anchoring systems Anchoring",
    "Sockets",
    "Fixing",
    "Fasteners",
    "Channels",
    "Angles",
    "Anchors",
    "Nails",
    "Bolts",
    "Manufacturer",
    "Ties",
    "Chair",
  ]);

  const visibleTags = useMemo(() => {
    const query = customerForm.tagSearch.trim().toLowerCase();
    if (!query) return tagItems;
    return tagItems.filter((tag) => tag.toLowerCase().includes(query));
  }, [customerForm.tagSearch, tagItems]);

  useEffect(() => {
    const loadTasks = () => {
      const loadedTasks = JSON.parse(localStorage.getItem("software_tasks") || "[]");
      setSoftwareTasks(loadedTasks);
    };

    loadTasks();
    
    // Listen for storage events (cross-tab)
    window.addEventListener("storage", loadTasks);
    // Listen for custom events (same-tab)
    window.addEventListener("local-storage-update", loadTasks);

    return () => {
      window.removeEventListener("storage", loadTasks);
      window.removeEventListener("local-storage-update", loadTasks);
    };
  }, []);

  const handleMoveToWaiting = (taskId: string) => {
    const updatedTasks = softwareTasks.map((t) =>
      t.id === taskId ? { ...t, status: "waiting" } : t
    );
    setSoftwareTasks(updatedTasks);
    localStorage.setItem("software_tasks", JSON.stringify(updatedTasks));
    window.dispatchEvent(new Event("local-storage-update"));
    setAssignedTab("waiting");
  };

  if (viewMode === "private-pool") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] dark:bg-zinc-950">
        <div className="px-6 pt-6 pb-2">
          <button
            type="button"
            onClick={() => setViewMode("dashboard")}
            className="text-slate-400 hover:text-[#059669] flex items-center gap-1 text-[13px] font-bold transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
        <div className="-mt-4">
          <ServicePrivatePool />
        </div>
      </div>
    );
  }

  if (viewMode === "attendance" || viewMode === "leave-application") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] dark:bg-zinc-950 flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-zinc-100 uppercase tracking-widest">{viewMode.replace("-", " ")}</h2>
          <p className="text-slate-500 dark:text-zinc-400">This module is being integrated.</p>
          <button
            type="button"
            onClick={() => setViewMode("dashboard")}
            className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === "todo-list") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] px-6 py-5 dark:bg-zinc-950">
        <div className="space-y-3">
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className="mb-4 text-[14px] font-medium text-[#6b7a90] hover:text-[#2f4058]"
            >
              Back
            </button>
            <h1 className="text-[21px] font-bold uppercase tracking-tight text-[#2f4058] dark:text-zinc-100">To Do List</h1>
          </div>

          <section className="rounded-md bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(226,232,240,0.55)] dark:bg-zinc-900">
            <h2 className="mb-5 text-[17px] font-semibold text-[#31435d] dark:text-zinc-100">Create To Do List</h2>

            {todoMessage ? (
              <div className="mb-4 rounded-md border border-[#b8e4cf] bg-[#edf9f2] px-4 py-3 text-[15px] text-[#0e9a55] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {todoMessage}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Task">
                <input
                  type="text"
                  value={todoForm.task}
                  onChange={(event) => setTodoForm((current) => ({ ...current, task: event.target.value }))}
                  placeholder="enter banner title"
                  className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                />
              </Field>
              <Field label="File">
                <div className="flex h-[42px] overflow-hidden rounded-[4px] border border-[#cfd7e3] dark:border-zinc-800">
                  <label className="flex cursor-pointer items-center border-r border-[#cfd7e3] bg-[#f8fafc] px-4 text-[15px] text-[#31435d] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const fileName = event.target.files?.[0]?.name || "";
                        setTodoForm((current) => ({ ...current, fileName }));
                      }}
                    />
                  </label>
                  <div className="flex flex-1 items-center px-4 text-[15px] text-[#6b7a90]">
                    {todoForm.fileName || "No file chosen"}
                  </div>
                </div>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
              <Field label="Category">
                <FakeSelect
                  value={todoForm.category}
                  options={["Choose...", "Office", "Personal", "Urgent", "Follow Up"]}
                  onSelect={(value) => setTodoForm((current) => ({ ...current, category: value }))}
                />
              </Field>
              <Field label="Time">
                <div className="relative">
                  <input
                    type="time"
                    value={todoForm.time}
                    onChange={(event) => setTodoForm((current) => ({ ...current, time: event.target.value }))}
                    className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                  />
                </div>
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={todoForm.date}
                  onChange={(event) => setTodoForm((current) => ({ ...current, date: event.target.value }))}
                  className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                />
              </Field>
              <Field label="Participants">
                <FakeSelect
                  value={todoForm.participants}
                  options={["Choose ...", "Manager", "Team Lead", "Designer", "Developer"]}
                  onSelect={(value) => setTodoForm((current) => ({ ...current, participants: value }))}
                />
              </Field>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
              <OptionGroup
                label="Priority"
                options={["High", "Medium", "Low"]}
                selected={todoForm.priority}
                onSelect={(value) => setTodoForm((current) => ({ ...current, priority: value }))}
              />
              <OptionGroup
                label="Repeat Task"
                options={["Hour", "Daily", "Weekly", "Monthly", "Yearly"]}
                selected={todoForm.repeatTask}
                onSelect={(value) => setTodoForm((current) => ({ ...current, repeatTask: value }))}
              />
              <OptionGroup
                label="Reminder"
                options={["Same with due date", "5 minutes before", "10 minutes before", "15 minutes before", "1 day before"]}
                selected={todoForm.reminder}
                onSelect={(value) => setTodoForm((current) => ({ ...current, reminder: value }))}
              />
            </div>

            <div className="mt-5">
              <Field label="Description">
                <div className="rounded-[4px] border border-[#cfd7e3] dark:border-zinc-800">
                  <div className="flex items-center gap-5 border-b border-[#cfd7e3] px-5 py-3 text-[16px] text-[#3d4a5d] dark:border-zinc-800 dark:text-zinc-100">
                    <span>Normal</span>
                    <span className="font-bold">B</span>
                    <span className="italic">I</span>
                    <span className="underline">U</span>
                    <span>🔗</span>
                    <span>≣</span>
                    <span>☰</span>
                    <span>Tx</span>
                    <button
                      type="button"
                      className="ml-auto text-[#ff6b6b]"
                      onClick={() => setTodoForm((current) => ({ ...current, description: "" }))}
                    >
                      🗑
                    </button>
                  </div>
                  <textarea
                    value={todoForm.description}
                    onChange={(event) => setTodoForm((current) => ({ ...current, description: event.target.value }))}
                    className="h-[90px] w-full resize-none px-4 py-3 text-[15px] text-[#31435d] outline-none dark:text-zinc-100"
                  />
                </div>
              </Field>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  if (!todoForm.task.trim()) {
                    setTodoMessage("Enter a task title before adding a row.");
                    return;
                  }
                  setTodoDraftRows((current) => [
                    ...current,
                    {
                      id: Date.now(),
                      task: todoForm.task,
                      category: todoForm.category,
                      priority: todoForm.priority,
                    },
                  ]);
                  setTodoMessage(`Added "${todoForm.task}" to the draft list.`);
                }}
                className="rounded-[4px] bg-[#35c78e] px-5 py-3 text-[16px] font-semibold text-white"
              >
                Add Row
              </button>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  const addedCount = Math.max(1, todoDraftRows.length);
                  setTodoStats((current) => ({
                    ...current,
                    assign: current.assign + addedCount,
                    pending: current.pending + addedCount,
                  }));
                  setTodoMessage(`Submitted ${addedCount} to do task${addedCount > 1 ? "s" : ""}.`);
                  setTodoDraftRows([]);
                  setTodoForm({
                    task: "",
                    fileName: "",
                    category: "Choose...",
                    time: "",
                    date: "",
                    participants: "Choose ...",
                    priority: "High",
                    repeatTask: "",
                    reminder: "",
                    description: "",
                  });
                }}
                className="w-full rounded-[4px] bg-[#0e9a55] px-4 py-3 text-[18px] font-semibold text-white"
              >
                Submit
              </button>
            </div>
          </section>

          <section className="rounded-md bg-white px-4 py-6 shadow-[0_0_0_1px_rgba(226,232,240,0.55)] dark:bg-zinc-900">
            <h2 className="mb-5 text-[17px] font-semibold text-[#31435d] dark:text-zinc-100">To Do List Task</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              {[
                ["Assign To Do Task", todoStats.assign],
                ["Un-received", todoStats.unreceived],
                ["Received", todoStats.received],
                ["Pending", todoStats.pending],
                ["Finished", todoStats.finished],
              ].map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTodoMessage(`${label}: ${value}`)}
                  className="flex items-center justify-between rounded-[6px] bg-[#edf1f6] px-5 py-4 text-left text-[15px] text-[#31435d] dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <span>{label}</span>
                  <span className="text-[#5183ff] dark:text-zinc-400">{value}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (viewMode === "running-projects") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] px-6 py-5 dark:bg-zinc-950">
        <div className="space-y-6">
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className="mb-4 text-[14px] font-medium text-[#6b7a90] hover:text-[#2f4058]"
            >
              Back
            </button>
            <h1 className="text-[21px] font-bold uppercase tracking-tight text-[#2f4058] dark:text-zinc-100">
              Running Project
            </h1>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white text-left text-[15px] font-semibold text-[#334761] dark:bg-zinc-900 dark:text-zinc-100">
                  {["#P-ID", "Projects", "Date", "Status", "Total", "Pay", "Due", "Team"].map((item) => (
                    <th key={item} className="px-4 py-4 first:w-[7%]">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="h-4" />
                <tr className="bg-white dark:bg-zinc-900">
                  <td className="px-4 py-5 align-middle">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#35c78e] text-[18px] font-bold text-white">
                      703
                    </div>
                  </td>
                  <td className="px-4 py-5 align-middle">
                    <div className="text-[18px] font-medium text-[#2f4058] dark:text-zinc-100">Domain Registration</div>
                    <div className="mt-2 text-[15px] text-[#7d8ba1]">DADDY D PRO</div>
                  </td>
                  <td className="px-4 py-5 align-middle text-[15px] text-[#44556d] dark:text-zinc-400">15 Jul 2024</td>
                  <td className="px-4 py-5 align-middle">
                    <span className="inline-flex rounded bg-[#35c78e] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white">
                      verify Data
                    </span>
                  </td>
                  <td className="px-4 py-5 align-middle">
                    <span className="inline-flex rounded bg-[#0aa15f] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white">
                      2540.2
                    </span>
                  </td>
                  <td className="px-4 py-5 align-middle text-[15px] text-[#44556d] dark:text-zinc-400" />
                  <td className="px-4 py-5 align-middle">
                    <span className="inline-flex rounded bg-[#f36b6b] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white dark:bg-zinc-900">
                      2540
                    </span>
                  </td>
                  <td className="px-4 py-5 align-middle text-[15px] text-[#44556d] dark:text-zinc-400" />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2 pt-10 text-[16px] text-[#34c79a] dark:text-zinc-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Load more</span>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === "pending-projects") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] px-6 py-5 dark:bg-zinc-950">
        <div className="space-y-6">
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className="mb-4 text-[14px] font-medium text-[#6b7a90] hover:text-[#2f4058]"
            >
              Back
            </button>
            <h1 className="text-[21px] font-bold uppercase tracking-tight text-[#2f4058] dark:text-zinc-100">
              List Of Project Activity
            </h1>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white text-left text-[15px] font-semibold text-[#334761] dark:bg-zinc-900 dark:text-zinc-100">
                  {["#P-ID", "Projects", "Status", "Hod", "Dep", "Date", "Action"].map((item) => (
                    <th key={item} className="px-4 py-4 first:w-[7%]">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="h-4" />
                {[
                  {
                    id: "9399",
                    project: "Alibaba Minisite",
                    company: "MOZLAN SPORTS",
                    status: "Start Work",
                    hod: "Approved",
                    dep: "Approved",
                    date: "01 Jan 2026",
                    depMuted: false,
                  },
                  {
                    id: "3618",
                    project: "Alibaba Minisite",
                    company: "SANZAF ENTERPRISES",
                    status: "Start Work",
                    hod: "Approved",
                    dep: "Approved",
                    date: "25 Apr 2024",
                    depMuted: false,
                  },
                  {
                    id: "703",
                    project: "Domain Registration",
                    company: "DADDY D PRO",
                    status: "verify Data",
                    hod: "Approved",
                    dep: "Waiting",
                    date: "15 Jul 2024",
                    depMuted: true,
                  },
                ].map((row) => (
                  <tr key={row.id} className="border-t-[18px] border-t-[#f5f6fb] bg-white dark:bg-zinc-900">
                    <td className="px-4 py-5 align-middle">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#35c78e] text-[18px] font-bold text-white">
                        {row.id}
                      </div>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <div className="text-[18px] font-medium text-[#2f4058] dark:text-zinc-100">{row.project}</div>
                      <div className="mt-2 text-[15px] text-[#7d8ba1]">{row.company}</div>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <span className="inline-flex rounded bg-[#35c78e] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <span className="inline-flex rounded-full bg-[#dfe5fb] px-2.5 py-0.5 text-[13px] font-medium text-[#00a26e] dark:bg-zinc-900 dark:text-zinc-400">
                        {row.hod}
                      </span>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-medium",
                          row.depMuted ? "bg-[#ececec] text-[#6c7790]" : "bg-[#dfe5fb] text-[#00a26e]",
                        )}
                      >
                        {row.dep}
                      </span>
                    </td>
                    <td className="px-4 py-5 align-middle text-[15px] text-[#44556d] dark:text-zinc-400">{row.date}</td>
                    <td className="px-4 py-5 align-middle text-[15px] text-[#44556d] dark:text-zinc-400" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2 pt-10 text-[16px] text-[#34c79a] dark:text-zinc-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Load more</span>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === "project-task") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] px-6 py-5 dark:bg-zinc-950">
        <div className="space-y-6">
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className="mb-4 text-[14px] font-medium text-[#6b7a90] hover:text-[#2f4058]"
            >
              Back
            </button>
            <h1 className="text-[21px] font-bold uppercase tracking-tight text-[#2f4058] dark:text-zinc-100">
              Project History
            </h1>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white text-left text-[15px] font-semibold text-[#334761] dark:bg-zinc-900 dark:text-zinc-100">
                  {["#P-ID", "Projects", "Date", "Status", "Task Time", "Spent Time", "Link"].map((item) => (
                    <th key={item} className="px-4 py-4 first:w-[7%]">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="h-4" />
                {[
                  { id: "9911", project: "Alibaba Minisite", company: "MELSFIT SPORTS", date: "12 Mar 2026", taskTime: "2:0", spentTime: "0:0:0" },
                  { id: "9586", project: "Alibaba Minisite", company: "BRONO SPORTS WEARS", date: "16 Mar 2026", taskTime: "2:0", spentTime: "0:0:0" },
                  { id: "9939", project: "Dynamic Website", company: "SOCKER TEAMSPORT", date: "09 Mar 2026", taskTime: "8:0", spentTime: "0:0:0" },
                  { id: "9939", project: "Dynamic Website", company: "SOCKER TEAMSPORT", date: "09 Mar 2026", taskTime: "8:0", spentTime: "0:0:0" },
                  { id: "9399", project: "Alibaba Minisite", company: "MOZLAN SPORTS", date: "03 Apr 2026", taskTime: "8:0", spentTime: "0:0:0" },
                ].map((row, index) => (
                  <tr key={`${row.id}-${index}`} className="border-t-[18px] border-t-[#f5f6fb] bg-white dark:bg-zinc-900">
                    <td className="px-4 py-5 align-middle">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#35c78e] text-[18px] font-bold text-white">
                        {row.id}
                      </div>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <div className="text-[18px] font-medium text-[#2f4058] dark:text-zinc-100">{row.project}</div>
                      <div className="mt-2 text-[15px] text-[#7d8ba1]">{row.company}</div>
                    </td>
                    <td className="px-4 py-5 align-middle text-[15px] text-[#44556d] dark:text-zinc-400">{row.date}</td>
                    <td className="px-4 py-5 align-middle">
                      <span className="inline-flex rounded bg-[#35c78e] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white">
                        Pending
                      </span>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <span className="inline-flex rounded bg-[#08a362] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white">
                        {row.taskTime}
                      </span>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <span className="inline-flex rounded bg-[#7b809f] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white">
                        {row.spentTime}
                      </span>
                    </td>
                    <td className="px-4 py-5 align-middle">
                      <Link2 className="h-5 w-5 text-[#394a63] dark:text-zinc-100" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2 pt-10 text-[16px] text-[#34c79a] dark:text-zinc-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Load more</span>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === "overtime") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] px-6 py-5 dark:bg-zinc-950">
        <div className="space-y-4">
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setViewMode("dashboard");
                setShowAddOvertime(false);
              }}
              className="mb-4 text-[14px] font-medium text-[#6b7a90] hover:text-[#2f4058]"
            >
              Back
            </button>
            <div className="flex items-center gap-2 text-[20px] font-bold uppercase tracking-tight">
              <span className="text-[#2f4058] dark:text-zinc-100">Overtime</span>
              <span className="text-[#2f4058] dark:text-zinc-100">/</span>
              <button
                type="button"
                onClick={() => setShowAddOvertime(true)}
                className="text-[#0e9a55] dark:text-zinc-400"
              >
                Add Overtime
              </button>
            </div>
          </div>

          {showAddOvertime ? (
            <section className="rounded-md bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(226,232,240,0.55)] dark:bg-zinc-900">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[15px] font-medium text-[#2f4058] dark:text-zinc-100">Task</label>
                  <input
                    type="text"
                    placeholder="purpose"
                    className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[15px] font-medium text-[#2f4058] dark:text-zinc-100">Time In Mint</label>
                  <input
                    type="text"
                    placeholder="time in mint"
                    className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[15px] font-medium text-[#2f4058] dark:text-zinc-100">Task Detail</label>
                  <textarea
                    placeholder="add detail"
                    className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-4 py-2 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                  />
                </div>
              </div>
              <div className="pt-8">
                <button
                  type="button"
                  className="rounded-[4px] bg-[#5cb58f] px-10 py-3 text-[18px] font-semibold text-white"
                >
                  Submit
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-md bg-white px-4 py-6 shadow-[0_0_0_1px_rgba(226,232,240,0.55)] dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div className="text-[16px] text-[#2f4058] dark:text-zinc-100">
                <div>Show</div>
                <div className="mt-1">
                  <Selector label="10" compact />
                </div>
                <div className="mt-1">entries</div>
              </div>
              <div className="w-[240px]">
                <label className="mb-1 block text-right text-[16px] text-[#2f4058] dark:text-zinc-100">Search:</label>
                <input
                  type="text"
                  className="h-[34px] w-full rounded-[4px] border border-[#cfd7e3] px-3 outline-none dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#edf1f6] text-left text-[15px] font-semibold text-[#334761] dark:bg-zinc-900 dark:text-zinc-100">
                    {["#", "Name", "Task", "Time", "Task Detail", "Manager", "Create", "Action"].map((item) => (
                      <th key={item} className="px-4 py-4">
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={8} className="border border-[#e6ebf2] px-4 py-4 text-[16px] text-[#2f4058] dark:border-zinc-800 dark:text-zinc-100">
                      No data available in table
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-5">
              <div className="text-[16px] text-[#2f4058] dark:text-zinc-100">Showing 0 to 0 of 0 entries</div>
              <div className="flex overflow-hidden rounded-[4px] border border-[#cfd7e3] dark:border-zinc-800">
                <button type="button" className="bg-white px-4 py-3 text-[16px] text-[#c5cfdd] dark:bg-zinc-900">
                  Previous
                </button>
                <button type="button" className="border-l border-[#cfd7e3] bg-white px-4 py-3 text-[16px] text-[#c5cfdd] dark:bg-zinc-900 dark:border-zinc-800">
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (viewMode === "add-uae-customer") {
    return (
      <div className="min-h-screen bg-[#f5f6fb] px-3 py-5 dark:bg-zinc-950">
        <div className="space-y-4">
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className="mb-4 text-[14px] font-medium text-[#6b7a90] hover:text-[#2f4058]"
            >
              Back
            </button>
            <h1 className="text-[22px] font-bold uppercase tracking-tight text-[#2f4058] dark:text-zinc-100">
              Add Customer
            </h1>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCustomerForm((current) => ({
                  ...current,
                  companyName: "Anchor Fix Technical LLC",
                  companyType: "Manufacturer",
                  city: "Dubai",
                  landlineNo: "+971-4-1234567",
                  mobileNo: "+971-55-1234567",
                  title: "Mr.",
                  personFullName: "Binu Mathew",
                  website: "www.anchorfix.ae",
                  email: "sales@anchorfix.ae",
                  address: "Al Quoz Industrial Area, Dubai",
                  googleMap: "https://maps.google.com/?q=Al+Quoz+Industrial+Area+Dubai",
                  selectedTags: ["Expansion bolts", "Anker Anchoring systems Anchoring", "Sockets"],
                }));
                setCustomerMessage("Imported sample UAE customer data into the form.");
              }}
              className="rounded-[4px] bg-[#0e9a55] px-4 py-2.5 text-[16px] font-medium text-white"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => {
                const csv = [
                  "company_name,country_region,company_type,city,landline_no,mobile_no,title,person_full_name,personal_mobile_no,website,email,address,google_map,tags",
                  '"Example Company","UAE","Manufacturer","Dubai","+971-4-1234567","+971-55-1234567","Mr.","John Doe","123456789","www.name.com","name@example.com","Dubai, UAE","https://maps.google.com","Expansion bolts|Sockets"',
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "uae-customer-template.csv";
                link.click();
                URL.revokeObjectURL(url);
                setCustomerMessage("Template CSV downloaded.");
              }}
              className="rounded-[4px] bg-[#0e9a55] px-4 py-2.5 text-[16px] font-medium text-white"
            >
              Template ⬇
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCompanyTypeInput((value) => !value);
                setCustomerMessage("Add a new company type below, then save it.");
              }}
              className="rounded-[4px] bg-[#0e9a55] px-4 py-2.5 text-[16px] font-medium text-white"
            >
              Add Company Type
            </button>
            <button
              type="button"
              onClick={() => {
                const importedTags = ["Chemical anchors", "Wall plugs", "Stud bolts"];
                setTagItems((current) => Array.from(new Set([...current, ...importedTags])));
                setCustomerMessage("Imported 3 additional tags into the tag list.");
              }}
              className="rounded-[4px] bg-[#0e9a55] px-4 py-2.5 text-[16px] font-medium text-white"
            >
              Import Tag List
            </button>
          </div>

          {customerMessage ? (
            <div className="rounded-md border border-[#b8e4cf] bg-[#edf9f2] px-4 py-3 text-[15px] text-[#0e9a55] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              {customerMessage}
            </div>
          ) : null}

          <section className="rounded-md bg-white px-3 py-3 shadow-[0_0_0_1px_rgba(226,232,240,0.55)] dark:bg-zinc-900">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_405px]">
              <div className="space-y-8">
                <div>
                  <h2 className="mb-2 text-[17px] font-semibold text-[#31435d] dark:text-zinc-100">Company Detail</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Company name *">
                      <input
                        type="text"
                        value={customerForm.companyName}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, companyName: event.target.value }))}
                        placeholder="Enter Company name"
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                    <Field label="Country / Region *">
                      <FakeSelect
                        value={customerForm.countryRegion}
                        options={["UAE", "Saudi Arabia", "Qatar", "Oman"]}
                        onSelect={(value) => setCustomerForm((current) => ({ ...current, countryRegion: value }))}
                      />
                    </Field>
                    <Field label="Company type">
                      <FakeSelect
                        value={customerForm.companyType}
                        options={companyTypeOptions}
                        onSelect={(value) => setCustomerForm((current) => ({ ...current, companyType: value }))}
                      />
                    </Field>
                    <Field label="City *">
                      <FakeSelect
                        value={customerForm.city}
                        options={["Choose...", "Dubai", "Abu Dhabi", "Sharjah", "Ajman"]}
                        onSelect={(value) => setCustomerForm((current) => ({ ...current, city: value }))}
                      />
                    </Field>
                    <Field label="Landline No * (+971-X-XXXXXXX)">
                      <input
                        type="text"
                        value={customerForm.landlineNo}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, landlineNo: event.target.value }))}
                        placeholder="Enter landline number"
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                    <Field label="Mobile No * (+971-xx-1234567)">
                      <input
                        type="text"
                        value={customerForm.mobileNo}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, mobileNo: event.target.value }))}
                        placeholder="Enter company mobile no"
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <h2 className="mb-2 text-[17px] font-semibold text-[#31435d] dark:text-zinc-100">Primary Detail</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Title">
                      <FakeSelect
                        value={customerForm.title}
                        options={["Choose...", "Mr.", "Ms.", "Mrs.", "Dr."]}
                        onSelect={(value) => setCustomerForm((current) => ({ ...current, title: value }))}
                      />
                    </Field>
                    <Field label="Person Full Name">
                      <input
                        type="text"
                        value={customerForm.personFullName}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, personFullName: event.target.value }))}
                        placeholder="Enter Person name"
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                    <Field label="Personal Mobile No">
                      <input
                        type="text"
                        value={customerForm.personalMobileNo}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, personalMobileNo: event.target.value }))}
                        placeholder="123456789"
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                    <Field label="Website">
                      <input
                        type="text"
                        value={customerForm.website}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, website: event.target.value }))}
                        placeholder="www.name.com"
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                    <Field label="Email *">
                      <input
                        type="text"
                        value={customerForm.email}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="Enter Company E-mail"
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                    <Field label="Address">
                      <textarea
                        value={customerForm.address}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))}
                        className="h-[44px] w-full rounded-[4px] border border-[#cfd7e3] px-4 py-2 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <Field label="Google Map">
                    <textarea
                      value={customerForm.googleMap}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, googleMap: event.target.value }))}
                      className="h-[62px] w-full rounded-[4px] border border-[#cfd7e3] px-4 py-2 text-[15px] text-[#6b7a90] outline-none dark:border-zinc-800"
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const summary = [
                      customerForm.companyName || "Unnamed company",
                      customerForm.personFullName || "No contact name",
                      customerForm.selectedTags.length ? `${customerForm.selectedTags.length} tags selected` : "No tags selected",
                    ].join(" | ");
                    setCustomerMessage(`Form submitted locally: ${summary}.`);
                  }}
                  className="rounded-[4px] bg-[#0e9a55] px-4 py-2.5 text-[16px] font-semibold text-white"
                >
                  Submit form
                </button>
              </div>

              <div className="border border-[#e2e7ef] bg-white p-3 dark:bg-zinc-900 dark:border-zinc-800">
                <h3 className="mb-3 text-[17px] font-semibold text-[#31435d] dark:text-zinc-100">Tags</h3>
                <input
                  type="text"
                  value={customerForm.tagSearch}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, tagSearch: event.target.value }))}
                  className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-3 outline-none dark:border-zinc-800"
                />
                <div className="mt-3 h-[370px] overflow-y-auto border border-[#eef2f7] px-3 py-2 dark:border-zinc-800">
                  <div className="mb-2 text-[16px] text-[#31435d] dark:text-zinc-100">Search</div>
                  <div className="space-y-2">
                    {visibleTags.map((tag) => (
                      <label key={tag} className="flex items-start gap-2 text-[15px] text-[#31435d] dark:text-zinc-100">
                        <input
                          type="checkbox"
                          checked={customerForm.selectedTags.includes(tag)}
                          onChange={(event) => {
                            setCustomerForm((current) => ({
                              ...current,
                              selectedTags: event.target.checked
                                ? [...current.selectedTags, tag]
                                : current.selectedTags.filter((item) => item !== tag),
                            }));
                          }}
                          className="mt-1 h-4 w-4 rounded border-[#cfd7e3] dark:border-zinc-800"
                        />
                        <span>{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {showCompanyTypeInput ? (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-6">
              <div className="w-full max-w-[640px] overflow-hidden rounded-[8px] bg-white shadow-2xl dark:bg-zinc-900">
                <div className="flex items-center justify-between border-b border-[#e7ebf2] px-6 py-4 dark:border-zinc-800">
                  <h2 className="text-[20px] font-semibold text-[#4b5563] dark:text-zinc-400">Add Busines Type</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompanyTypeInput(false);
                      setPendingCompanyType("");
                    }}
                    className="text-[32px] leading-none text-[#888] hover:text-[#555]"
                  >
                    ×
                  </button>
                </div>

                <div className="px-6 py-5">
                  <label className="mb-3 block text-[16px] font-medium text-[#4b5563] dark:text-zinc-400">Company Type:</label>
                  <input
                    type="text"
                    value={pendingCompanyType}
                    onChange={(event) => setPendingCompanyType(event.target.value)}
                    className="h-[42px] w-full rounded-[4px] border border-[#cfd7e3] px-3 text-[15px] outline-none dark:border-zinc-800"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-[#e7ebf2] px-6 py-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompanyTypeInput(false);
                      setPendingCompanyType("");
                    }}
                    className="rounded-[4px] bg-[#eef2f7] px-6 py-3 text-[16px] text-[#3d4a5d] dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextType = pendingCompanyType.trim();
                      if (!nextType) {
                        setCustomerMessage("Enter a company type before saving.");
                        return;
                      }
                      setCompanyTypeOptions((current) => (current.includes(nextType) ? current : [...current, nextType]));
                      setCustomerForm((current) => ({ ...current, companyType: nextType }));
                      setPendingCompanyType("");
                      setShowCompanyTypeInput(false);
                      setCustomerMessage(`Added "${nextType}" as a company type.`);
                    }}
                    className="rounded-[4px] bg-[#0e9a55] px-6 py-3 text-[16px] font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-6 py-6 font-sans">
      <div className="mx-auto max-w-full space-y-6">
        
        {/* Header Section */}
        <div className="flex items-center gap-2 text-[15px] font-bold tracking-wide">
          <span className="text-slate-800 uppercase">Dashboard</span>
          <span className="text-emerald-500">/</span>
          <span className="text-emerald-500 uppercase">Software Department</span>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-[2.4fr_1fr] gap-6">
          
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* Top Stats Cards Container */}
            <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[17px] font-bold text-slate-800">Top Selling</h2>
                <Select value={topSellingFilter} onValueChange={setTopSellingFilter}>
                  <SelectTrigger className="w-[86px] h-[34px] bg-slate-50 border-slate-100 rounded-lg text-slate-600 text-[13px] font-medium shadow-none outline-none focus:ring-0">
                    <SelectValue placeholder="MH" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LD">LD</SelectItem>
                    <SelectItem value="WK">WK</SelectItem>
                    <SelectItem value="MH">MH</SelectItem>
                    <SelectItem value="QU">QU</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Task", value: (summaryStats as any)?.totalTasks?.toString() || "0", icon: Users, color: "bg-[#4f46e5]" },
                  { label: "Pending", value: (summaryStats as any)?.pendingTasks?.toString() || "0", icon: ArrowRightLeft, color: "bg-[#f97316]" },
                  { label: "Running", value: (summaryStats as any)?.runningTasks?.toString() || "0", icon: MapPin, color: "bg-[#14b8a6]" },
                  { label: "Complete", value: (summaryStats as any)?.completeTasks?.toString() || "0", icon: Settings, color: "bg-[#d946ef]" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white border border-slate-50 rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col items-start hover:-translate-y-0.5 transition-transform">
                    <div className={cn("w-11 h-11 rounded-[14px] flex items-center justify-center text-white mb-4", color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-[32px] font-bold text-slate-800 leading-none mb-2">{value}</div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assigned Project */}
            <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-[17px] font-bold text-slate-800">Assigned Project</h2>
                <div className="flex bg-slate-50 p-1 rounded-full border border-slate-100">
                  <button
                    onClick={() => setAssignedTab("today")}
                    className={cn(
                      "px-6 py-2 rounded-full text-[13px] font-bold transition-colors",
                      assignedTab === "today" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setAssignedTab("waiting")}
                    className={cn(
                      "px-6 py-2 rounded-full text-[13px] font-bold transition-colors",
                      assignedTab === "waiting" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Waiting
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80">
                      {["NO#", "COMPANY", "TASK", "STATUS", "PRIORITY", "ASSIGN DATE", "ACTION"].map((h, i) => (
                        <th key={h} className={cn(
                          "py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider",
                          i === 0 && "rounded-tl-lg rounded-bl-lg",
                          i === 6 && "rounded-tr-lg rounded-br-lg"
                        )}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(taskListData as any[])?.length > 0 ? (
                      (taskListData as any[]).map((task, index) => (
                        <tr key={task.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="py-4 px-4 text-[13px] font-bold text-slate-500">{index + 1}</td>
                          <td className="py-4 px-4 text-[13px] font-bold text-slate-600">{task.company}</td>
                          <td className="py-4 px-4 text-[13px] font-medium text-slate-500">{task.task}</td>
                          <td className="py-4 px-4">
                            <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">
                              {task.status}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold text-white",
                              task.priority === "Urgent" ? "bg-red-500" : task.priority === "High" ? "bg-amber-500" : "bg-emerald-400"
                            )}>
                              {task.priority || "Normal"}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-[13px] font-medium text-slate-500">{task.dueDate || "-"}</td>
                          <td className="py-4 px-4">
                            {assignedTab === "today" ? (
                              <button 
                                onClick={() => handleMoveToWaiting(task.id)}
                                className="text-[12px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Move to Waiting
                              </button>
                            ) : (
                              <span className="text-[12px] text-slate-400 italic font-medium">Waiting...</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-[13px] font-medium text-slate-400">
                          No tasks found in {assignedTab}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Report */}
            <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[17px] font-bold text-slate-800">Daily Report</h2>
                <Select value={dailyReportFilter} onValueChange={setDailyReportFilter}>
                  <SelectTrigger className="w-[140px] h-[34px] bg-slate-50 border-slate-100 rounded-lg text-slate-600 text-[13px] font-medium shadow-none outline-none focus:ring-0">
                    <SelectValue placeholder="Daily Report" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Report</SelectItem>
                    <SelectItem value="weekly">Weekly Report</SelectItem>
                    <SelectItem value="monthly">Monthly Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DashboardTable headers={["NAME", "COMPANY", "PROJECT", "FREE", "TASK", "STATUS", "RUN", "SPENT"]} data={dailyReportData as any[]} />
            </div>

            {/* Monthly Complete Project */}
            <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[17px] font-bold text-slate-800">Monthly Complete Project</h2>
                <Select value={monthlyCompleteFilter} onValueChange={setMonthlyCompleteFilter}>
                  <SelectTrigger className="w-[86px] h-[34px] bg-slate-50 border-slate-100 rounded-lg text-slate-600 text-[13px] font-medium shadow-none outline-none focus:ring-0">
                    <SelectValue placeholder="WK" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TD">TD</SelectItem>
                    <SelectItem value="WK">WK</SelectItem>
                    <SelectItem value="MO">MO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DashboardTable headers={["NAME", "COMPANY", "PROJECT", "FREE", "TASK", "STATUS", "RUN", "SPENT"]} data={monthlyCompleteData as any[]} />
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Banner */}
            <div className="bg-[#517a68] rounded-[24px] p-8 text-white relative overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.05)] h-[200px] flex flex-col justify-center">
              <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
              <div className="text-[11px] font-bold text-emerald-100 tracking-wider uppercase mb-2 relative z-10">Software Dept</div>
              <h3 className="text-[28px] font-bold leading-[1.15] relative z-10">Accelerate Your<br/>Development Cycle</h3>
            </div>

            {/* Activities */}
            <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[16px] font-bold text-slate-800">Activities</h2>
                <Select value={activitiesFilter} onValueChange={setActivitiesFilter}>
                  <SelectTrigger className="w-[72px] h-[32px] bg-slate-50 border-slate-100 rounded-lg text-slate-600 text-[12px] font-medium shadow-none outline-none focus:ring-0">
                    <SelectValue placeholder="TD" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TD">TD</SelectItem>
                    <SelectItem value="WK">WK</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[1fr_1.3fr_0.7fr] gap-2 mb-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Time</div>
              </div>

              <div className="space-y-4 mb-6">
                {(activityPlanData as any)?.rows?.length > 0 ? (
                  (activityPlanData as any).rows.map((row: any) => (
                    <div key={row.method} className="grid grid-cols-[1fr_1.3fr_0.7fr] gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <ArrowRightCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-[13px] font-bold text-slate-700">{activityLabels[row.method] || row.method}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[12px]">
                        <span className="font-bold text-slate-800">{row.target}</span>
                        <span className="text-slate-400 font-medium">({row.actualCount ?? 0})</span>
                        <span className="bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1">{row.targetPercent}%</span>
                      </div>
                      <div className="text-right text-[13px] font-bold text-slate-700">{row.actual}m</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-[13px] font-medium text-slate-400 py-4">No activities found</div>
                )}
              </div>

              <div className="text-center text-[13px] text-slate-500 pt-4 border-t border-slate-50 font-medium">
                Attendance Status: <span className={cn("font-bold ml-1 uppercase", (summaryStats as any)?.attendanceStatus === "Present" ? "text-emerald-500" : "text-amber-500")}>{(summaryStats as any)?.attendanceStatus || "NOT MARKED"}</span>
              </div>
            </div>

            {/* Projects Overview */}
            <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <h2 className="text-[16px] font-bold text-slate-800 mb-4">Projects Overview</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Running Project", id: "running-projects" },
                  { name: "Pending Project", id: "pending-projects" },
                  { name: "Project Task", id: "project-task" },
                  { name: "Over Time", id: "overtime" },
                  { name: "Leave Application", id: "leave-application" },
                  { name: "Attendance", id: "attendance" },
                  { name: "Add Uae Customer", id: "add-uae-customer" },
                  { name: "Private Pool", id: "private-pool" },
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      if (item.id === "overtime") setShowAddOvertime(false);
                      setViewMode(item.id as ViewMode);
                    }}
                    className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl px-4 py-3 text-[12px] font-bold text-slate-600"
                  >
                    <span>{item.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Important */}
            <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <h2 className="text-[16px] font-bold text-slate-800 mb-4">Important</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 text-[12px]">
                  <span className="font-bold text-slate-600">Notice</span>
                  <span className="font-bold text-emerald-600">{(summaryStats as any)?.important?.notice?.toString() || "0"}</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 text-[12px]">
                  <span className="font-bold text-slate-600">Portfolio</span>
                  <span className="font-bold text-emerald-600">{(summaryStats as any)?.important?.portfolio?.toString() || "0(0)"}</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 text-[12px]">
                  <span className="font-bold text-slate-600">Add Portfolio</span>
                  <span className="font-bold text-emerald-600">{(summaryStats as any)?.important?.addPortfolio?.toString() || "0"}</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 text-[12px]">
                  <span className="font-bold text-slate-600">Login Time</span>
                  <span className="font-bold text-emerald-600">{(summaryStats as any)?.important?.loginTime || "Not Marked"}</span>
                </div>
                <button 
                  onClick={() => setViewMode("todo-list")}
                  className="col-span-2 flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-xl px-4 py-3 text-[12px]"
                >
                  <span className="font-bold text-emerald-600">To Do List</span>
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function Selector({
  label,
  wide = false,
  compact = false,
}: {
  label: string;
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center rounded-[4px] border border-[#cfd7e3] bg-white dark:bg-zinc-900 px-4 pr-10 text-[#405269]",
        compact ? "h-[34px] min-w-[80px] text-[15px]" : "h-[36px] min-w-[86px] text-[15px]",
        wide && "min-w-[170px]",
      )}
    >
      <span>{label}</span>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#405269] dark:text-zinc-400" />
    </div>
  );
}

function DashboardTable({ headers, data }: { headers: string[], data?: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center border-collapse">
        <thead>
          <tr className="bg-slate-50/80">
            {headers.map((header, i) => (
              <th key={header} className={cn(
                "py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider",
                i === 0 && "rounded-tl-lg rounded-bl-lg",
                i === headers.length - 1 && "rounded-tr-lg rounded-br-lg"
              )}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 last:border-0">
                <td className="py-3 px-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center text-[14px] uppercase mx-auto">
                    {row.name?.charAt(0) || "N"}
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] font-medium text-slate-600">{row.company}</td>
                <td className="py-3 px-4 text-[13px] font-medium text-slate-500">{row.project}</td>
                <td className="py-3 px-4 text-[13px] font-medium text-slate-500">Free</td>
                <td className="py-3 px-4 text-[13px] font-medium text-slate-500">Task</td>
                <td className="py-3 px-4">
                  <span className={cn(
                    "inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border",
                    row.status?.toLowerCase() === "blocked" ? "bg-blue-500 text-white border-blue-600" :
                    row.status?.toLowerCase() === "todo" ? "bg-white text-blue-500 border-blue-200" :
                    "bg-blue-50 text-blue-500 border-blue-200"
                  )}>
                    {row.status || "InProgress"}
                  </span>
                </td>
                <td className="py-3 px-4 text-[13px] font-medium text-slate-500">Run</td>
                <td className="py-3 px-4 text-[13px] font-bold text-slate-800">{row.spent}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="py-12 text-center text-[13px] font-medium text-slate-400">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[15px] font-semibold text-[#31435d] dark:text-zinc-100">{label}</label>
      {children}
    </div>
  );
}

function OptionGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[15px] font-medium text-[#31435d] dark:text-zinc-100">{label}</div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-[15px] text-[#31435d] dark:text-zinc-100">
            <input
              type="radio"
              name={label}
              checked={selected === option}
              onChange={() => onSelect(option)}
              className="h-4 w-4"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FakeSelect({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onSelect(event.target.value)}
        className="h-[44px] w-full appearance-none rounded-[4px] border border-[#cfd7e3] bg-white px-4 text-[15px] text-[#31435d] outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#b0b9c8]" />
    </div>
  );
}

function RightBox({
  title,
  children,
  control,
}: {
  title: string;
  children: React.ReactNode;
  control?: React.ReactNode;
}) {
  return (
    <section className="rounded-md bg-white shadow-[0_0_0_1px_rgba(226,232,240,0.55)] dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-[17px] font-semibold text-[#4a5667] dark:text-zinc-400">{title}</h2>
        {control}
      </div>
      {children}
    </section>
  );
}
