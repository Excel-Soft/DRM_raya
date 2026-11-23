import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Folder, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryNode = {
    id: string;
    name: string;
    children?: CategoryNode[];
};

function CategoryBranch({ node, depth, expanded, onToggle }: { node: CategoryNode; depth: number; expanded: Set<string>; onToggle: (id: string) => void }) {
    const [open, setOpen] = useState(depth < 1);
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isOpen = expanded.has(node.id) || open;
    const indent = 12 + depth * 18;

    return (
        <>
            <button
                type="button"
                className={cn(
                    "flex w-full items-center gap-2 border-b border-slate-100 py-2 pr-4 text-left text-sm transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
                    depth === 0 && "font-semibold text-slate-800 dark:text-zinc-200",
                )}
                style={{ paddingLeft: indent }}
                onClick={() => {
                    if (hasChildren) {
                        onToggle(node.id);
                        setOpen((v) => !v);
                    }
                }}
            >
                {hasChildren ? (
                    isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                ) : (
                    <span className="inline-block h-4 w-4 shrink-0" />
                )}
                {hasChildren ? <Folder className="h-4 w-4 shrink-0 text-emerald-600" /> : <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                <span className="min-w-0 flex-1">{node.name}</span>
            </button>
            {hasChildren &&
                isOpen &&
                node.children!.map((child) => (
                    <CategoryBranch key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
                ))}
        </>
    );
}

export function LegacyAttributeTree({ title, queryKey, apiPath }: { title: string; queryKey: string; apiPath: string }) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const onToggle = useCallback((id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const { data: tree = [], isLoading } = useQuery<CategoryNode[]>({
        queryKey: [queryKey],
        queryFn: async () => {
            const res = await apiRequest("GET", apiPath);
            return res.json();
        },
    });

    return (
        <div className="w-full max-w-none">
            <Card className="w-full border-t-4 border-t-[#008d4c] shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">{title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[calc(100vh-14rem)] overflow-y-auto overflow-x-hidden bg-white dark:bg-zinc-950">
                        {isLoading ? (
                            <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
                        ) : tree.length === 0 ? (
                            <p className="py-12 text-center text-sm text-muted-foreground">No items found.</p>
                        ) : (
                            tree.map((node) => <CategoryBranch key={node.id} node={node} depth={0} expanded={expanded} onToggle={onToggle} />)
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
