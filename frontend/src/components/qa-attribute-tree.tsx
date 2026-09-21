import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, HelpCircle, CornerDownRight } from "lucide-react";

interface AttributeRow {
    id: string;
    category: string;
    name: string;
    parentId: string | null;
}

const CATEGORY = "Q & A";

export function QaAttributeTree() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    // A question is "selected" (checkbox ticked) when its id is in this set —
    // selecting it both reveals its existing answers and opens the inline
    // "Add Answer" box right beneath it, so there's no separate dialog to
    // hunt for.
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
    const [addQuestionOpen, setAddQuestionOpen] = useState(false);
    const [questionText, setQuestionText] = useState("");

    const queryKey = ["/api/attributes", CATEGORY];
    const { data: rows = [], isLoading } = useQuery<AttributeRow[]>({
        queryKey,
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/attributes/${encodeURIComponent(CATEGORY)}`);
            return res.json();
        },
    });
    const questions = rows.filter((r) => !r.parentId);
    const answersByQuestion = new Map<string, AttributeRow[]>();
    rows.filter((r) => r.parentId).forEach((r) => {
        const list = answersByQuestion.get(r.parentId as string) ?? [];
        list.push(r);
        answersByQuestion.set(r.parentId as string, list);
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    const addMutation = useMutation({
        mutationFn: async (payload: { name: string; parentId?: string | null }) =>
            mutationRequest("POST", "/api/attributes", { category: CATEGORY, ...payload }),
        onSuccess: (_data, variables) => {
            invalidate();
            setAddQuestionOpen(false);
            setQuestionText("");
            if (variables.parentId) {
                // Keep the question selected/open so the newly-added answer is
                // visible right away, just clear its draft text.
                setAnswerDrafts((d) => ({ ...d, [variables.parentId as string]: "" }));
            }
            toast({ title: "Saved" });
        },
        onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => mutationRequest("DELETE", `/api/attributes/${id}`),
        onSuccess: () => {
            invalidate();
            toast({ title: "Deleted" });
        },
        onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });

    const toggleSelected = (id: string) =>
        setSelected((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const submitAnswer = (questionId: string) => {
        const text = (answerDrafts[questionId] ?? "").trim();
        if (!text) return;
        addMutation.mutate({ name: text, parentId: questionId });
    };

    return (
        <div>
            <div className="mb-6 flex items-center gap-2">
                <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white" onClick={() => setAddQuestionOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                </Button>
            </div>

            <div className="rounded-md border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <div className="flex items-center gap-2 pb-3 text-slate-700 dark:text-zinc-300 font-semibold">
                    <HelpCircle className="w-4 h-4" />
                    Question & Answers
                </div>
                {isLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading...</div>
                ) : questions.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">No questions yet. Add one above.</div>
                ) : (
                    <div className="pl-2 space-y-1">
                        {questions.map((q) => {
                            const answers = answersByQuestion.get(q.id) ?? [];
                            const isSelected = selected.has(q.id);
                            return (
                                <div key={q.id} className="rounded">
                                    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 group">
                                        <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelected(q.id)}
                                            />
                                            <span className="text-slate-700 dark:text-zinc-300 font-medium">{q.name}</span>
                                        </label>
                                        <Button
                                            variant="ghost" size="sm" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => { if (confirm("Delete this question and its answers?")) deleteMutation.mutate(q.id); }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                    {isSelected && (
                                        <div className="pl-9 pr-2 space-y-1 pb-3">
                                            {answers.map((a) => (
                                                <div key={a.id} className="flex items-start justify-between gap-2 py-1 px-2 rounded group hover:bg-slate-50 dark:hover:bg-zinc-900">
                                                    <div className="flex items-start gap-1.5 text-slate-600 dark:text-zinc-400 text-sm">
                                                        <CornerDownRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                                                        {a.name}
                                                    </div>
                                                    <Button
                                                        variant="ghost" size="sm" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => { if (confirm("Delete this answer?")) deleteMutation.mutate(a.id); }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <div className="flex items-start gap-2 pt-1">
                                                <Textarea
                                                    value={answerDrafts[q.id] ?? ""}
                                                    onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                                                    placeholder="Add answer..."
                                                    className="min-h-[38px] text-sm"
                                                    rows={1}
                                                />
                                                <Button
                                                    size="sm"
                                                    className="bg-[#008d4c] hover:bg-[#00733e] shrink-0"
                                                    disabled={addMutation.isPending || !(answerDrafts[q.id] ?? "").trim()}
                                                    onClick={() => submitAnswer(q.id)}
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Question</Label>
                            <Input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Enter question..." />
                        </div>
                        <Button
                            className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                            disabled={addMutation.isPending || !questionText.trim()}
                            onClick={() => addMutation.mutate({ name: questionText.trim(), parentId: null })}
                        >
                            {addMutation.isPending ? "Adding..." : "Add Question"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
