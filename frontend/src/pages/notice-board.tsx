import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ClipboardList,
  Edit,
  Trash2,
  Eye,
  Search,
  Users,
  Bell,
  CheckCircle2,
  XCircle,
  Archive,
  MoreVertical,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Notice {
  id: string;
  title: string;
  description: string;
  status: "Active" | "Inactive" | "Archived";
  assignedByUserId: string;
  assignedToRole?: string;
  assignedToDepartment?: string;
  assignedDate: string;
  createdAt: string;
  updatedAt: string;
  assignedBy?: {
    name: string;
  };
}

const DEPARTMENTS = [
  "Sales", "IT", "HR", "Reception", "Accounts", 
  "QA", "Verification", "Project", "D&D", "Product Posting"
];

const ROLES_LIST = [
  { key: "admin", label: "Admin" },
  { key: "super_hod", label: "Super HOD" },
  { key: "hod", label: "HOD" },
  { key: "sales_manager", label: "Sales Manager" },
  { key: "sales_executive", label: "Sales Executive" },
  { key: "reception_manager", label: "Reception Manager" },
  { key: "qa_manager", label: "QA Manager" },
  { key: "verification_manager", label: "Verification Manager" },
  { key: "dd_manager", label: "D&D Manager" },
  { key: "product_posting_manager", label: "Product Posting Manager" },
];

type NoticeAssignment = {
  id: string;
  noticeId: string;
  userId: string;
  assignedAt: string;
};

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder
}: {
  options: { id: string, label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
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
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(o => o.id === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-[14px] text-slate-700 dark:text-zinc-300 shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{displayValue}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
      </div>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 max-h-[250px] w-full overflow-y-auto rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-400">
          <div className="sticky top-0 bg-white dark:bg-zinc-900 p-2 border-b border-slate-100 dark:border-zinc-800">
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-md border border-slate-200 dark:border-zinc-800 px-2 py-1.5 text-[13px] outline-none focus:border-[#059669] bg-transparent dark:text-zinc-300"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="py-1">
            {filteredOptions.map((opt) => (
              <div
                key={opt.id}
                className={`cursor-pointer px-3 py-2 text-[14px] transition-colors ${value === opt.id ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100' : 'text-slate-700 dark:text-zinc-300 hover:bg-[#059669] hover:text-white'}`}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                {opt.label}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-[13px] text-slate-500">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NoticeBoard() {
  const userRole = sessionStorage.getItem("userRole") || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToRole, setAssignedToRole] = useState("all");
  const [assignedToDepartment, setAssignedToDepartment] = useState("all");
  const [status, setStatus] = useState<"Active" | "Inactive" | "Archived">("Active");

  // Assign state
  const [assignNoticeId, setAssignNoticeId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignDetail, setAssignDetail] = useState("");

  const { data: usersList = [] } = useQuery<any[]>({
    queryKey: ["/api/users", "all-for-dropdowns"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      return json.data || json.users || [];
    }
  });

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["/api/notice-board"],
  });

  const createNoticeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/notice-board", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notice-board"] });
      toast({ title: "Success", description: "Notice created successfully" });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create notice",
        variant: "destructive" 
      });
    },
  });

  const updateNoticeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/notice-board/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notice-board"] });
      toast({ title: "Success", description: "Notice updated successfully" });
      setIsAddModalOpen(false);
      setIsAssignModalOpen(false);
      setSelectedNotice(null);
      resetForm();
    },
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notice-board/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notice-board"] });
      toast({ title: "Success", description: "Notice deleted successfully" });
    },
  });

  const assignNoticeMutation = useMutation({
    mutationFn: async (data: { noticeId: string, userId: string }) => {
      const res = await apiRequest("POST", "/api/notice-board/assign", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notice assigned successfully" });
      setIsAssignModalOpen(false);
      setAssignNoticeId("");
      setAssignUserId("");
      setAssignDetail("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign notice", variant: "destructive" });
    }
  });

  const handleAssignSave = () => {
    if (!assignNoticeId || !assignUserId) {
      toast({ title: "Validation Error", description: "Please select a notice and a user", variant: "destructive" });
      return;
    }
    assignNoticeMutation.mutate({ noticeId: assignNoticeId, userId: assignUserId });
  };

  const handleNoticeSelect = (id: string) => {
    if (id === "none") {
      setAssignNoticeId("");
      setAssignDetail("");
      return;
    }
    setAssignNoticeId(id);
    const notice = notices.find(n => n.id === id);
    if (notice) {
      setAssignDetail(notice.description);
    } else {
      setAssignDetail("");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssignedToRole("all");
    setAssignedToDepartment("all");
    setStatus("Active");
  };

  const handleEdit = (notice: Notice) => {
    setSelectedNotice(notice);
    setTitle(notice.title);
    setDescription(notice.description);
    setAssignedToRole(notice.assignedToRole || "all");
    setAssignedToDepartment(notice.assignedToDepartment || "all");
    setStatus(notice.status);
    setIsAddModalOpen(true);
  };

  const handleSave = () => {
    if (!title || !description) {
      toast({ title: "Validation Error", description: "Title and Description are required", variant: "destructive" });
      return;
    }

    const data = {
      title,
      description,
      status,
      assignedToRole: assignedToRole === "all" ? null : assignedToRole,
      assignedToDepartment: assignedToDepartment === "all" ? null : assignedToDepartment,
    };

    if (selectedNotice) {
      updateNoticeMutation.mutate({ id: selectedNotice.id, data });
    } else {
      createNoticeMutation.mutate(data);
    }
  };

  const filteredNotices = notices.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 bg-[#f8fafc] min-h-screen font-sans dark:bg-zinc-950">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
          <span className="text-slate-800 uppercase dark:text-zinc-100">PMS</span>
          <span className="text-[#059669] px-0.5 dark:text-zinc-400">/</span>
          <span className="text-[#059669] uppercase font-bold dark:text-zinc-400">NOTICE BOARD SYSTEM</span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => { resetForm(); setSelectedNotice(null); setIsAddModalOpen(true); }}
            className="bg-[#059669] hover:bg-[#047857] text-white shadow-sm h-9 text-[13px] font-bold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Notice
          </Button>
          <Button 
            variant="outline"
            onClick={() => { resetForm(); setSelectedNotice(null); setIsAssignModalOpen(true); }}
            className="border-slate-200 text-slate-600 h-9 text-[13px] font-bold bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
          >
            <Users className="w-4 h-4 mr-1.5 text-[#059669] dark:text-zinc-400" />
            Assign Notice
          </Button>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm mx-2 dark:border-zinc-800">
        <CardHeader className="pb-3 border-b border-slate-50 dark:border-zinc-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-[16px] font-bold text-slate-700 flex items-center gap-2 dark:text-zinc-400">
                <Bell className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                Recent Notices
              </CardTitle>
              <CardDescription className="text-[12px] text-slate-500 mt-0.5 dark:text-zinc-400">
                Manage and view important announcements for the team
              </CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search notices..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-[13px] border-slate-200 focus-visible:ring-[#059669] dark:border-zinc-800"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc] border-b border-white dark:bg-zinc-900 dark:hover:bg-zinc-800">
                  <TableHead className="w-16 py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Sr.#</TableHead>
                  <TableHead className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Notice Name</TableHead>
                  <TableHead className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Description</TableHead>
                  <TableHead className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Assigned Date</TableHead>
                  <TableHead className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Status</TableHead>
                  <TableHead className="w-24 text-right py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500 text-[13px] dark:text-zinc-400">
                      Loading notices...
                    </TableCell>
                  </TableRow>
                ) : filteredNotices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500 dark:text-zinc-400">
                      <div className="flex flex-col items-center gap-2">
                        <ClipboardList className="w-10 h-10 text-slate-200" />
                        <p className="text-[14px]">No notices found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNotices.map((notice, index) => (
                    <TableRow key={notice.id} className="border-b border-slate-50 hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors dark:border-zinc-800">
                      <TableCell className="py-4 px-4 text-[13px] font-bold text-slate-700 dark:text-zinc-400">{index + 1}</TableCell>
                      <TableCell className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">{notice.title}</span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3" />
                            {notice.assignedToRole || notice.assignedToDepartment || "All Staff"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-[13px] text-slate-500 max-w-md dark:text-zinc-400">
                        <p className="truncate">{notice.description}</p>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-[12px] text-slate-500 font-medium dark:text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {format(new Date(notice.assignedDate), "dd MMM yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <Badge 
                          variant="outline" 
                          className={`
                            h-6 px-2.5 text-[11px] font-bold border-0
                            ${notice.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 
                              notice.status === 'Inactive' ? 'bg-slate-100 text-slate-600 dark:text-slate-300' : 'bg-amber-50 text-amber-700'}
                          `}
                        >
                          {notice.status === 'Active' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : notice.status === 'Inactive' ? (
                            <XCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <Archive className="w-3 h-3 mr-1" />
                          )}
                          {notice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-[#059669] hover:bg-emerald-50"
                            onClick={() => { setSelectedNotice(notice); setIsViewModalOpen(true); }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => handleEdit(notice)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this notice?")) {
                                deleteNoticeMutation.mutate(notice.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {/* Add Notice Modal (Simplified) */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 bg-white border-0 dark:bg-zinc-900 rounded-md overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
            <DialogTitle className="text-[17px] font-semibold text-slate-700 dark:text-zinc-400">
              {selectedNotice ? "Edit Notice" : "Add Notice"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="simple-title" className="text-[14px] font-medium text-slate-700 dark:text-zinc-300">Name:</Label>
              <Input 
                id="simple-title" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 text-[14px] border-slate-200 focus:ring-[#059669] dark:border-zinc-800"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="simple-description" className="text-[14px] font-medium text-slate-700 dark:text-zinc-300">Detail:</Label>
              <Textarea 
                id="simple-description" 
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-[14px] border-slate-200 focus:ring-[#059669] resize-none dark:border-zinc-800"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-2 dark:border-zinc-800 dark:bg-zinc-900">
            <Button 
                variant="secondary" 
                onClick={() => setIsAddModalOpen(false)}
                className="h-10 px-6 text-[14px] font-medium bg-[#f1f5f9] hover:bg-[#e2e8f0] text-slate-800 border-0 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Close
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-[#059669] hover:bg-[#047857] h-10 px-6 text-[14px] font-medium shadow-none text-white"
              disabled={createNoticeMutation.isPending || updateNoticeMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Notice Modal (Simplified to match screenshot) */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 bg-white border-0 dark:bg-zinc-900 rounded-md overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
            <DialogTitle className="text-[17px] font-semibold text-slate-700 dark:text-zinc-400">
              Assign Notice
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-slate-700 dark:text-zinc-300">Assign Notice:</Label>
                <SearchableSelect
                  placeholder="Select Notice"
                  value={assignNoticeId}
                  onChange={handleNoticeSelect}
                  options={[
                    { id: "none", label: "Select Notice" },
                    ...notices.map(n => ({ id: n.id, label: n.title }))
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-slate-700 dark:text-zinc-300">User:</Label>
                <SearchableSelect
                  placeholder="Choose..."
                  value={assignUserId}
                  onChange={setAssignUserId}
                  options={usersList.map((u: any) => ({ 
                    id: u.id, 
                    label: u.fullName || u.name || u.email 
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assign-description" className="text-[14px] font-medium text-slate-700 dark:text-zinc-300">Detail:</Label>
              <Textarea 
                id="assign-description" 
                rows={4}
                value={assignDetail}
                onChange={(e) => setAssignDetail(e.target.value)}
                className="text-[14px] border-slate-200 focus:ring-[#059669] resize-none dark:border-zinc-800"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-2 dark:border-zinc-800 dark:bg-zinc-900">
            <Button 
                variant="secondary" 
                onClick={() => setIsAssignModalOpen(false)}
                className="h-10 px-6 text-[14px] font-medium bg-[#f1f5f9] hover:bg-[#e2e8f0] text-slate-800 border-0 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Close
            </Button>
            <Button 
              onClick={handleAssignSave}
              className="bg-[#059669] hover:bg-[#047857] h-10 px-6 text-[14px] font-medium shadow-none text-white"
              disabled={assignNoticeMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white border-0 dark:bg-zinc-900">
          {selectedNotice && (
            <>
              <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 dark:border-zinc-800">
                <div className="flex items-center justify-between w-full pr-6">
                  <DialogTitle className="text-[17px] font-bold text-slate-700 tracking-tight flex items-center gap-2 dark:text-zinc-400">
                    <Bell className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                    Notice Details
                  </DialogTitle>
                  <Badge variant="outline" className={`border-0 h-6 ${selectedNotice.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600 dark:text-slate-300'}`}>
                    {selectedNotice.status}
                  </Badge>
                </div>
              </DialogHeader>
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800 dark:text-zinc-100">{selectedNotice.title}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-[12px] text-slate-500 dark:text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(selectedNotice.assignedDate), "PPp")}
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-[#059669] font-bold dark:text-zinc-400">
                      <Users className="w-3.5 h-3.5" />
                      {selectedNotice.assignedToRole || selectedNotice.assignedToDepartment || "All Staff"}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                  <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap dark:text-zinc-300">
                    {selectedNotice.description}
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between">
                   <div className="text-[11px] text-slate-400">
                     Created by: <span className="font-bold text-slate-500 dark:text-zinc-400">{selectedNotice.assignedBy?.name || "System Admin"}</span>
                   </div>
                </div>
              </div>
              <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
                <Button 
                    className="w-full bg-[#059669] hover:bg-[#047857] h-9 font-bold text-[13px]"
                    onClick={() => setIsViewModalOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
