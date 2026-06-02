import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Check, X, FileText, ExternalLink } from "lucide-react";

// For demonstration, we simply fetch all projects and their docs
// In a real app, you'd want an endpoint specific string to fetch pending docs across all projects

export function ProductPostingManagerWidget() {
    const queryClient = useQueryClient();
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
        queryKey: ["/api/projects"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/projects");
            return res.json();
        }
    });

    // We have a chicken and egg problem to fetch all docs across all projects without a global route
    // For UI simulation, let's pretend we have a combined route or we fetch all projects, then their docs.
    // Assuming we created a global /api/projects/documents/pending or we just mock it.

    // Real implementation requires a global docs pipeline
    // Let's implement an ad-hoc local list based on what we see.

    if (isLoadingProjects) return <div>Loading...</div>;

    return (
        <Card className="col-span-1 border shadow-sm">
            <CardHeader className="pb-2 bg-slate-50 border-b dark:bg-zinc-900">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Document Verification Queue
                </CardTitle>
                <CardDescription className="text-xs">
                    Review requirement documents submitted by Sales.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                    Integration placeholder: Needs `/api/projects/documents/pending` endpoint to render list of documents to approve.
                </p>
            </CardContent>
        </Card>
    );
}
