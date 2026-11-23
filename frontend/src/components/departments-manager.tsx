import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";

interface LegacyDepartmentRow {
    id: string;
    name: string;
    email: string | null;
    legacyReadOnly?: boolean;
}

export function DepartmentsManager() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: departments = [], isLoading } = useQuery<LegacyDepartmentRow[]>({
        queryKey: ["/api/attributes/legacy-departments"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/attributes/legacy-departments");
            return res.json();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => mutationRequest("DELETE", `/api/attributes/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/attributes/legacy-departments"] });
            toast({ title: "Deleted" });
        },
        onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });

    return (
        <div className="w-full max-w-none space-y-4">
            <Card className="w-full border-t-4 border-t-[#008d4c] shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Departments</CardTitle>
                    <p className="text-xs text-muted-foreground">From legacy webxl_department (same as old DRM attributes page).</p>
                </CardHeader>
                <CardContent className="p-0">
                    <Table className="w-full">
                        <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                            <TableRow>
                                <TableHead className="min-w-[200px] font-semibold text-slate-700 dark:text-zinc-400">Name</TableHead>
                                <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Email</TableHead>
                                <TableHead className="w-20 text-center font-semibold text-slate-700 dark:text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-8 text-center">
                                        Loading…
                                    </TableCell>
                                </TableRow>
                            ) : departments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                        No departments found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                departments.map((dept) => (
                                    <TableRow key={dept.id}>
                                        <TableCell className="whitespace-normal break-words font-medium text-slate-700 dark:text-zinc-400">
                                            {dept.name}
                                        </TableCell>
                                        <TableCell className="whitespace-normal break-words text-slate-600 dark:text-zinc-400">
                                            {dept.email ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                onClick={() => {
                                                    if (confirm("Delete this department from legacy archive?")) deleteMutation.mutate(dept.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
