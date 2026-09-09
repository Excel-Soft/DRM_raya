import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Target, X } from "lucide-react";

type Department = {
    id: string;
    name: string;
    count: number;
    members?: string[];
};

type AssignmentForm = {
    department: string;
    assign: string;
    ratio: string;
};

const DEPARTMENTS: Department[] = [
    { id: "sales", name: "Sales Department", count: 0 },
    { id: "admin", name: "Admin", count: 0 },
    { id: "service", name: "Service Department", count: 0 },
    { id: "reception", name: "Reception Department", count: 0 },
    { id: "project", name: "Project Department", count: 0 },
    { id: "seo_smm", name: "SEO/SMM Department", count: 0 },
    { id: "product_posting", name: "Product Posting", count: 0 },
    { id: "dnd", name: "D&D Department", count: 2, members: ["Ghazanfar ali", "Jibran Razzaq"] },
    { id: "internship", name: "Internship & Trainee", count: 0 },
    { id: "accounts", name: "Accounts Department", count: 0 },
    { id: "it", name: "IT Department", count: 0 },
    { id: "other", name: "Other", count: 0 },
    { id: "web_excels", name: "Web Excels", count: 0 },
    { id: "rnd", name: "R&D", count: 0 },
    { id: "welc", name: "WELC", count: 0 },
    { id: "deactive", name: "Deactive", count: 0 },
    { id: "lead", name: "Lead Department", count: 0 },
    { id: "qa", name: "QA Department", count: 0 },
    { id: "verification", name: "Verification Department", count: 0 },
    { id: "complaint", name: "Complaint Department", count: 0 },
    { id: "marketing", name: "Marketing Department", count: 0 },
    { id: "media", name: "Media Department", count: 0 },
    { id: "hod", name: "Head of Department", count: 0 },
    { id: "software", name: "Software Department", count: 0 },
    { id: "trade", name: "Trade Assurance", count: 0 },
    { id: "super_hod", name: "Super HOD", count: 0 },
];

export default function PmsSettings() {
    const { toast } = useToast();
    const [departments] = useState<Department[]>(DEPARTMENTS);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [form, setForm] = useState<AssignmentForm>({
        department: "",
        assign: "",
        ratio: "0:0",
    });

    // Fetch department stats (optional)
    const { data: stats } = useQuery({
        queryKey: ["/api/pms/department-stats"],
        queryFn: async () => {
            try {
                const res = await apiRequest("GET", "/api/pms/department-stats");
                return await res.json();
            } catch {
                return null;
            }
        },
    });

    // Save assignment mutation
    const saveMutation = useMutation({
        mutationFn: async (data: AssignmentForm) => {
            return apiRequest("POST", "/api/pms/department-assignment", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/pms/department-stats"] });
            toast({ title: "Assignment saved successfully" });
            setDialogOpen(false);
        },
        onError: () => {
            toast({ title: "Failed to save assignment", variant: "destructive" });
        },
    });

    const handleCardClick = (dept: Department) => {
        setSelectedDept(dept);
        setForm({
            department: dept.name,
            assign: "",
            ratio: "0:0",
        });
        setDialogOpen(true);
    };

    const handleSave = () => {
        saveMutation.mutate(form);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-semibold text-gray-700 uppercase tracking-wide dark:text-zinc-400">
                    ASSIGN PMS PROJECT
                </h1>
            </div>

            {/* Department Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {departments.map((dept) => (
                    <Card
                        key={dept.id}
                        className="hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 dark:border-zinc-800"
                        onClick={() => handleCardClick(dept)}
                    >
                        <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                            {/* Green Circle Icon */}
                            <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                                <Target className="w-6 h-6 text-white" />
                            </div>

                            {/* Department Name */}
                            <h3 className="font-medium text-gray-800 text-sm dark:text-zinc-100">
                                {dept.name}
                            </h3>

                            {/* Count or Members */}
                            {dept.count > 0 && (
                                <div className="text-sm text-gray-600 dark:text-zinc-300">
                                    {dept.count}:{dept.count}
                                </div>
                            )}

                            {/* Member Badges */}
                            {dept.members && dept.members.length > 0 && (
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {dept.members.map((member, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="secondary"
                                            className="text-xs bg-green-600 text-white hover:bg-green-700"
                                        >
                                            {member}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Assignment Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-medium">
                            Distributed Project
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Department Field */}
                        <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            <Input
                                id="department"
                                value={form.department}
                                disabled
                                className="bg-gray-100 dark:bg-zinc-900"
                            />
                        </div>

                        {/* Assign Field */}
                        <div className="space-y-2">
                            <Label htmlFor="assign">Assign</Label>
                            <Input
                                id="assign"
                                value={form.assign}
                                onChange={(e) => setForm({ ...form, assign: e.target.value })}
                                placeholder="Enter assignment"
                            />
                        </div>

                        {/* Ratio Field */}
                        <div className="space-y-2">
                            <Label htmlFor="ratio">Ratio</Label>
                            <Input
                                id="ratio"
                                value={form.ratio}
                                onChange={(e) => setForm({ ...form, ratio: e.target.value })}
                                placeholder="0:0"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={handleSave}
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
