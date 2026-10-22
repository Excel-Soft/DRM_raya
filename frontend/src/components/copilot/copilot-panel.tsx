import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Send, X, Loader2, AlertTriangle, FileText, Activity as ActivityIcon, Trash2 } from "lucide-react";
import { useAssistant } from "@/contexts/assistant-context";
import { cn } from "@/lib/utils";
import {
  askCopilot,
  getCopilotCapability,
  listCopilotDrafts,
  discardCopilotDraft,
  listCopilotActivity,
  CopilotApiError,
  type CopilotCapability,
  type CopilotTurnResponse,
  type CopilotDraft,
  type CopilotAuditEntry,
} from "@/lib/copilot-api";

interface CopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  evidence?: CopilotTurnResponse["evidence"];
  warnings?: CopilotTurnResponse["warnings"];
  mode?: CopilotTurnResponse["mode"];
}

const SUGGESTED_ACTIONS = [
  "Summarise this customer",
  "What is blocking this record?",
  "Show my overdue work",
  "Prepare a follow-up",
  "Draft a quotation proposal",
];

export function CopilotPanel({ isOpen, onClose }: CopilotPanelProps) {
  const { userName, userRole } = useAssistant();
  const [capability, setCapability] = useState<CopilotCapability | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ask");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [drafts, setDrafts] = useState<CopilotDraft[] | null>(null);
  const [activity, setActivity] = useState<CopilotAuditEntry[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getCopilotCapability()
      .then(setCapability)
      .catch((err) => setCapabilityError(err instanceof Error ? err.message : "Failed to load Copilot status"));
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (activeTab === "drafts" && drafts === null && capability?.allowedForUser) {
      listCopilotDrafts()
        .then((r) => setDrafts(r.drafts))
        .catch(() => setDrafts([]));
    }
    if (activeTab === "activity" && activity === null && capability?.allowedForUser) {
      listCopilotActivity()
        .then((r) => setActivity(r.entries))
        .catch(() => setActivity([]));
    }
  }, [activeTab, drafts, activity, capability]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setAskError(null);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsSending(true);
    try {
      const result = await askCopilot({ message: trimmed, conversationId });
      setConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, evidence: result.evidence, warnings: result.warnings, mode: result.mode },
      ]);
    } catch (err) {
      const message =
        err instanceof CopilotApiError
          ? err.message
          : "Something went wrong reaching Copilot. Please try again.";
      setAskError(message);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${message}` }]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleDiscardDraft(draftId: string) {
    await discardCopilotDraft(draftId);
    setDrafts((prev) => (prev ? prev.filter((d) => d.id !== draftId) : prev));
  }

  if (!isOpen) return null;

  return (
    <Card
      className="fixed top-0 right-0 h-full w-96 shadow-xl z-[100] flex flex-col rounded-none border-l"
      data-testid="card-copilot-panel"
    >
      <CardHeader className="flex flex-col gap-2 pb-3 border-b">
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">WebExcels DRM Copilot</CardTitle>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Ask • Understand • Prepare • Act within permissions
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-copilot" className="hover:bg-destructive/10">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground" data-testid="text-copilot-identity">
          Signed in as <span className="font-medium text-foreground">{userName}</span>
          {userRole ? <span> · {userRole}</span> : null}
        </p>
      </CardHeader>

      {!capability && !capabilityError ? (
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      ) : capabilityError || !capability?.configured ? (
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <p className="text-sm font-medium">Copilot isn't available right now</p>
          <p className="text-xs text-muted-foreground">
            {capabilityError ?? capability?.reasons.join("; ") ?? "Please check back later."}
          </p>
        </CardContent>
      ) : !capability.allowedForUser ? (
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6">
          <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm font-medium">Not available for your account</p>
          <p className="text-xs text-muted-foreground">Copilot is in a limited pilot. Ask your admin to add you to the allowlist.</p>
        </CardContent>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 grid grid-cols-3">
            <TabsTrigger value="ask" data-testid="tab-copilot-ask">Ask</TabsTrigger>
            <TabsTrigger value="drafts" data-testid="tab-copilot-drafts">Drafts</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-copilot-activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="ask" className="flex-1 flex flex-col min-h-0 m-0">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Try asking:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_ACTIONS.map((prompt) => (
                        <Badge
                          key={prompt}
                          variant="outline"
                          className="cursor-pointer hover-elevate"
                          onClick={() => sendMessage(prompt)}
                          data-testid={`copilot-suggested-${prompt.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {prompt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={index} className={cn("flex flex-col gap-1.5", message.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-4 py-2",
                        message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                      data-testid={`copilot-message-${message.role}-${index}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.mode && message.mode !== "ok" && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        {message.mode === "degraded" ? "Partial answer" : "Blocked"}
                      </Badge>
                    )}
                    {message.warnings?.map((w) => (
                      <p key={w.code} className="text-[11px] text-muted-foreground max-w-[85%]">{w.message}</p>
                    ))}
                    {!!message.evidence?.length && (
                      <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                        {message.evidence.map((ref, i) => (
                          <a
                            key={`${ref.type}-${ref.id}-${i}`}
                            href={ref.route ?? "#"}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                            data-testid={`copilot-evidence-${ref.type}-${ref.id}`}
                          >
                            {ref.label ?? `${ref.type} · ${ref.id.slice(0, 8)}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            {askError && (
              <p className="px-4 text-[11px] text-destructive" data-testid="text-copilot-ask-error">{askError}</p>
            )}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about a customer, record, or what's blocking work..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  disabled={isSending}
                  data-testid="input-copilot-message"
                />
                <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isSending} size="icon" data-testid="button-copilot-send">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="drafts" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full p-4">
              {drafts === null ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : drafts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-center py-8">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No drafts yet. Ask Copilot to prepare one.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="rounded-lg border border-border p-3 space-y-1.5" data-testid={`copilot-draft-${draft.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px]">DRAFT</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDiscardDraft(draft.id)} data-testid={`button-discard-draft-${draft.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-sm font-medium">{draft.content.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{draft.content.body}</p>
                      {!!draft.missingFields?.length && (
                        <p className="text-[11px] text-amber-600">Missing: {draft.missingFields.join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full p-4">
              {activity === null ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : activity.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-center py-8">
                  <ActivityIcon className="w-6 h-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-xs border-b border-border/60 pb-2" data-testid={`copilot-activity-${entry.id}`}>
                      <div>
                        <p className="font-medium text-foreground">{entry.action}</p>
                        <p className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant={entry.outcome === "ok" ? "outline" : "destructive"} className="text-[10px]">
                        {entry.outcome}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}
