import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useModuleData } from "@/hooks/use-module-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Calendar,
  Target,
  TrendingUp,
  FileText,
  Users,
  Bell,
  Star,
  Bookmark,
  ExternalLink,
  Timer,
  Zap,
  BarChart3,
  ArrowRight,
} from "lucide-react";

interface QuickNote {
  id: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
}

interface PersonalTask {
  id: string;
  title: string;
  isCompleted: boolean;
  priority: "high" | "medium" | "low";
  dueDate?: string;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  category: string;
}

const priorityColors = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const mockQuickNotes: QuickNote[] = [
  { id: "1", content: "Follow up with ABC Corp on proposal", createdAt: "2024-01-15T10:00:00Z", isPinned: true },
  { id: "2", content: "Prepare Q1 sales report", createdAt: "2024-01-15T09:00:00Z", isPinned: false },
  { id: "3", content: "Review new product training materials", createdAt: "2024-01-14T14:00:00Z", isPinned: false },
];

const mockPersonalTasks: PersonalTask[] = [
  { id: "1", title: "Complete CRM training module", isCompleted: false, priority: "high", dueDate: "2024-01-20" },
  { id: "2", title: "Update customer contact list", isCompleted: false, priority: "medium", dueDate: "2024-01-18" },
  { id: "3", title: "Submit weekly activity report", isCompleted: true, priority: "high", dueDate: "2024-01-15" },
  { id: "4", title: "Prepare client presentation", isCompleted: false, priority: "low", dueDate: "2024-01-25" },
];

const mockBookmarks: Bookmark[] = [
  { id: "1", title: "Sales Dashboard", url: "/dashboard/sales-executive", category: "Internal" },
  { id: "2", title: "Customer Reports", url: "/reports", category: "Internal" },
  { id: "3", title: "Training Center", url: "/training", category: "Internal" },
  { id: "4", title: "Company Policies", url: "/policies", category: "Resources" },
];

const todayStats = {
  tasksCompleted: 5,
  tasksPending: 3,
  hoursLogged: 6.5,
  meetingsAttended: 2,
  callsMade: 12,
  emailsSent: 24,
};

function StatCard({ icon: Icon, label, value, trend }: { icon: any; label: string; value: string | number; trend?: string }) {
  return (
    <Card className="hover-elevate" data-testid={`card-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold" data-testid={`text-stat-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            </div>
          </div>
          {trend && (
            <Badge variant="outline" className="text-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              {trend}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickNotesCard({ notes }: { notes: QuickNote[] }) {
  const [newNote, setNewNote] = useState("");

  const handleAddNote = () => {
    if (newNote.trim()) {
      setNewNote("");
    }
  };

  return (
    <Card data-testid="card-quick-notes">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quick Notes
          </CardTitle>
          <Badge variant="secondary">{notes.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add a quick note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            data-testid="input-quick-note"
          />
          <Button size="icon" onClick={handleAddNote} data-testid="button-add-note">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-lg bg-muted/50 hover-elevate"
                data-testid={`note-item-${note.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">{note.content}</p>
                  {note.isPinned && <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(note.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PersonalTasksCard({ tasks }: { tasks: PersonalTask[] }) {
  const [localTasks, setLocalTasks] = useState(tasks);

  const toggleTask = (taskId: string) => {
    setLocalTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
      )
    );
  };

  const completedCount = localTasks.filter((t) => t.isCompleted).length;
  const progressPercent = Math.round((completedCount / localTasks.length) * 100);

  return (
    <Card data-testid="card-personal-tasks">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            My Tasks
          </CardTitle>
          <Badge variant="outline">
            {completedCount}/{localTasks.length}
          </Badge>
        </div>
        <Progress value={progressPercent} className="h-2" data-testid="progress-personal-tasks" />
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          <div className="space-y-2">
            {localTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg hover-elevate ${
                  task.isCompleted ? "bg-muted/30 opacity-60" : "bg-muted/50"
                }`}
                data-testid={`task-item-${task.id}`}
              >
                <Checkbox
                  checked={task.isCompleted}
                  onCheckedChange={() => toggleTask(task.id)}
                  data-testid={`checkbox-task-${task.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </p>
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge className={priorityColors[task.priority]} variant="secondary">
                  {task.priority}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function QuickLinksCard({ bookmarks }: { bookmarks: Bookmark[] }) {
  return (
    <Card data-testid="card-quick-links">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bookmark className="w-5 h-5" />
          Quick Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {bookmarks.map((bookmark) => (
            <Button
              key={bookmark.id}
              variant="outline"
              className="justify-start h-auto py-3 px-4"
              onClick={() => window.location.href = bookmark.url}
              data-testid={`link-bookmark-${bookmark.id}`}
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">{bookmark.title}</p>
                  <p className="text-xs text-muted-foreground">{bookmark.category}</p>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FocusTimerCard() {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card data-testid="card-focus-timer">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Timer className="w-5 h-5" />
          Focus Timer
        </CardTitle>
        <CardDescription>Stay productive with timed focus sessions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-5xl font-mono font-bold mb-4" data-testid="text-timer-display">
            {formatTime(timeLeft)}
          </p>
          <div className="flex justify-center gap-2">
            <Button
              variant={isRunning ? "destructive" : "default"}
              onClick={() => setIsRunning(!isRunning)}
              data-testid="button-timer-toggle"
            >
              {isRunning ? "Pause" : "Start Focus"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsRunning(false);
                setTimeLeft(25 * 60);
              }}
              data-testid="button-timer-reset"
            >
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingRemindersCard() {
  const reminders = [
    { id: "1", title: "Team standup meeting", time: "10:00 AM", type: "meeting" },
    { id: "2", title: "Client call - XYZ Corp", time: "2:00 PM", type: "call" },
    { id: "3", title: "Submit weekly report", time: "5:00 PM", type: "deadline" },
  ];

  return (
    <Card data-testid="card-reminders">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Today's Schedule
          </CardTitle>
          <Badge variant="secondary">{reminders.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover-elevate"
              data-testid={`reminder-item-${reminder.id}`}
            >
              <div className="p-2 rounded-full bg-primary/10">
                {reminder.type === "meeting" && <Users className="w-4 h-4 text-primary" />}
                {reminder.type === "call" && <Bell className="w-4 h-4 text-primary" />}
                {reminder.type === "deadline" && <Target className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{reminder.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {reminder.time}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Workspace() {
  useModuleData("/workspace");

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6" data-testid="page-workspace">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <Briefcase className="w-8 h-8" />
              My Workspace
            </h1>
            <p className="text-muted-foreground mt-1">
              Your personal productivity hub
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Calendar className="w-4 h-4 mr-2" />
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={CheckCircle2} label="Tasks Done" value={todayStats.tasksCompleted} trend="+2" />
          <StatCard icon={Circle} label="Pending" value={todayStats.tasksPending} />
          <StatCard icon={Clock} label="Hours Logged" value={todayStats.hoursLogged} />
          <StatCard icon={Users} label="Meetings" value={todayStats.meetingsAttended} />
          <StatCard icon={Zap} label="Calls Made" value={todayStats.callsMade} trend="+5" />
          <StatCard icon={BarChart3} label="Emails Sent" value={todayStats.emailsSent} />
        </div>

        <Tabs defaultValue="overview" className="w-full" data-testid="tabs-workspace">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
            <TabsTrigger value="focus" data-testid="tab-focus">Focus</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <UpcomingRemindersCard />
                <QuickLinksCard bookmarks={mockBookmarks} />
              </div>
              <div className="space-y-6">
                <QuickNotesCard notes={mockQuickNotes} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PersonalTasksCard tasks={mockPersonalTasks} />
              <QuickNotesCard notes={mockQuickNotes} />
            </div>
          </TabsContent>

          <TabsContent value="focus" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FocusTimerCard />
              <UpcomingRemindersCard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
