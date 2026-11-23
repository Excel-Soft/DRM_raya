import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, HelpCircle, CornerDownRight } from "lucide-react";

interface AttributeRow {
    id: string;
    category: string;
    name: string;
    parentId: string | null;
    legacyReadOnly?: boolean;
}

const CATEGORY = "Q & A";

function isLegacyRow(id: string) {
    return id.startsWith("legacy-question-") || id.startsWith("legacy-attribute-");
}

export function QaAttributeTree() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
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

    const submitAnswer = (questionId: string) => {
        const text = (answerDrafts[questionId] ?? "").trim();
        if (!text) return;
        if (isLegacyRow(questionId)) {
            toast({
                title: "Legacy question",
                description: "Add a new modern question to attach editable answers.",
                variant: "destructive",
            });
            return;
        }
        addMutation.mutate({ name: text, parentId: questionId });
    };

    return (
        <div className="w-full max-w-none space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white" onClick={() => setAddQuestionOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                </Button>
            </div>

            <Card className="w-full border-t-4 border-t-[#008d4c] shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-700 dark:text-zinc-400">
                        <HelpCircle className="h-5 w-5 text-[#008d4c]" />
                        Question & Answers
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[calc(100vh-14rem)] overflow-y-auto px-2 pb-4">
                        {isLoading ? (
                            <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
                        ) : questions.length === 0 ? (
                            <p className="py-12 text-center text-sm text-muted-foreground">No questions yet. Add one above.</p>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {questions.map((q, index) => {
                                    const answers = answersByQuestion.get(q.id) ?? [];
                                    const legacyQ = isLegacyRow(q.id);
                                    return (
                                        <div key={q.id} className="px-3 py-3">
                                            <div className="flex items-start justify-between gap-3 group">
                                                <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                                                    {index + 1}. {q.name}
                                                </p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() => {
                                                        const msg = legacyQ
                                                            ? "Delete this legacy question and all its answers?"
                                                            : "Delete this question and its answers?";
                                                        if (confirm(msg)) deleteMutation.mutate(q.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {answers.length > 0 && (
                                                <ul className="mt-2 space-y-2 pl-4">
                                                    {answers.map((a) => (
                                                        <li
                                                            key={a.id}
                                                            className="group/a flex items-start justify-between gap-2 text-sm text-slate-600 dark:text-zinc-400"
                                                        >
                                                            <div className="flex min-w-0 flex-1 items-start gap-2">
                                                                <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                                <span className="whitespace-pre-wrap break-words">{a.name}</span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                                onClick={() => {
                                                                    const msg =
                                                                        a.legacyReadOnly || isLegacyRow(a.id)
                                                                            ? "Delete this legacy answer?"
                                                                            : "Delete this answer?";
                                                                    if (confirm(msg)) deleteMutation.mutate(a.id);
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {!legacyQ && (
                                                <div className="mt-3 flex items-start gap-2 pl-4">
                                                    <Textarea
                                                        value={answerDrafts[q.id] ?? ""}
                                                        onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                                                        placeholder="Add answer…"
                                                        className="min-h-[38px] text-sm"
                                                        rows={1}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="shrink-0 bg-[#008d4c] hover:bg-[#00733e]"
                                                        disabled={addMutation.isPending || !(answerDrafts[q.id] ?? "").trim()}
                                                        onClick={() => submitAnswer(q.id)}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Question</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Question</Label>
                            <Input
                                value={questionText}
                                onChange={(e) => setQuestionText(e.target.value)}
                                placeholder="Enter question…"
                            />
                        </div>
                        <Button
                            className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                            disabled={addMutation.isPending || !questionText.trim()}
                            onClick={() => addMutation.mutate({ name: questionText.trim(), parentId: null })}
                        >
                            {addMutation.isPending ? "Adding…" : "Add Question"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
