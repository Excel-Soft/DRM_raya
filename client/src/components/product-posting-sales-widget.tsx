import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Plus, AlertCircle, Upload } from "lucide-react";

interface Invoice {
    id: string;
    projectName?: string;
    status: string;
    companyName?: string;
    amount: number;
    createdAt: string;
}

export function ProductPostingSalesWidget() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [projectName, setProjectName] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [docUploadOpen, setDocUploadOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [docUrl, setDocUrl] = useState("");

    const { data: invoicesData } = useQuery({
        queryKey: ["/api/invoices"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/invoices");
            return res.json();
        }
    });

    const createInvoiceMutation = useMutation({
        mutationFn: async (data: { amount: string, projectName: string, companyName: string }) => {
            await apiRequest("POST", "/api/invoices", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
            setIsOpen(false);
            setAmount("");
            setProjectName("");
            setCompanyName("");
        }
    });

    const { data: projectsData } = useQuery({
        queryKey: ["/api/pms/projects?withStats=false"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/projects?withStats=false");
            return res.json();
        }
    });

    const uploadDocMutation = useMutation({
        mutationFn: async ({ projectId, url }: { projectId: string; url: string }) => {
            const res = await apiRequest("POST", `/api/projects/${projectId}/documents`, { documentUrl: url });
            return res.json();
        },
        onSuccess: () => {
            setDocUploadOpen(false);
            setDocUrl("");
            alert("Document uploaded successfully for review.");
        }
    });

    const invoices = invoicesData?.data || [];
    const projects = Array.isArray(projectsData) ? projectsData : (projectsData as any)?.data || [];

    const getProjectIdForInvoice = (invoiceId: string) => {
        const project = projects.find((p: any) => p.invoiceId === invoiceId);
        return project?.id;
    };

    return (
        <Card className="col-span-1 border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50 border-b dark:bg-zinc-900">
                <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Product Posting Invoices
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Create invoices and track project documents
                    </CardDescription>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="h-8 gap-1">
                            <Plus className="h-3.5 w-3.5" />
                            New Invoice
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Product Posting Invoice</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="projectName">Project Name</Label>
                                <Input
                                    id="projectName"
                                    placeholder="e.g. SEO Campaign"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name</Label>
                                <Input
                                    id="companyName"
                                    placeholder="e.g. Acme Corp"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount ($)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="e.g. 0 for complimentary, or 500"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>
                            <Button
                                onClick={() => createInvoiceMutation.mutate({ 
                                    amount: amount || "0", 
                                    projectName: projectName, 
                                    companyName: companyName 
                                })}
                                disabled={createInvoiceMutation.isPending}
                            >
                                {createInvoiceMutation.isPending ? "Creating..." : "Submit Invoice"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                    {invoices.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No invoices created yet.
                        </div>
                    ) : (
                        invoices.map((inv: Invoice) => (
                            <div key={inv.id} className="flex flex-col p-3 border-b hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-semibold">{inv.projectName || `INV-${inv.id.substring(0, 6)}`}</span>
                                    <Badge variant={
                                        inv.status === "APPROVED" ? "default" :
                                            inv.status === "REJECTED" ? "destructive" : "secondary"
                                    }>
                                        {inv.status.replace("_", " ")}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span className="font-medium text-slate-600 dark:text-zinc-300">{inv.companyName || "No Company"}</span>
                                    <span>Amount: ${inv.amount}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                    {new Date(inv.createdAt).toLocaleDateString()}
                                </div>
                                {inv.status === "REJECTED" && (
                                    <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Action required: Check notifications for reason.
                                    </div>
                                )}

                                {/* Simulated Document Upload Trigger for Approved Projects */}
                                {inv.status === "APPROVED" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 text-xs h-7 w-fit gap-1"
                                        onClick={() => {
                                            const projId = getProjectIdForInvoice(inv.id);
                                            if (!projId) {
                                                alert("Project not ready yet. Please wait.");
                                                return;
                                            }
                                            setSelectedProjectId(projId);
                                            setDocUploadOpen(true);
                                        }}
                                    >
                                        <Upload className="h-3 w-3" />
                                        Upload Documents
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>

            {/* Document Upload Dialog */}
            <Dialog open={docUploadOpen} onOpenChange={setDocUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Requirements Document</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Project: {selectedProjectId}</Label>
                            <Input
                                placeholder="Google Drive / Dropbox Link..."
                                value={docUrl}
                                onChange={(e) => setDocUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Paste a link to the requirement scope, images, or assets.
                            </p>
                        </div>
                        <Button
                            onClick={() => uploadDocMutation.mutate({ projectId: selectedProjectId, url: docUrl })}
                            disabled={uploadDocMutation.isPending || !docUrl}
                        >
                            {uploadDocMutation.isPending ? "Uploading..." : "Submit for Verification"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
