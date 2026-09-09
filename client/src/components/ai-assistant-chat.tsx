import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, X, Loader2, Zap } from "lucide-react";
import { useAssistant } from "@/contexts/assistant-context";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { generateDataAwarePrompts } from "@/lib/smart-prompts";
import { sessionMemory } from "@/lib/session-memory";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIAssistantChat({ isOpen, onClose }: AIAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm WebX-AI Assistant, your intelligent guide for WebExcels DRM. I can help you understand features, analyze your data, and suggest next steps based on what you're working on.\n\nTry the quick prompts below or ask me anything!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSmartPrompts, setShowSmartPrompts] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { currentScreen, userRole, userName, screenData } = useAssistant();
  const smartPrompts = generateDataAwarePrompts(currentScreen, screenData);
  
  // Get session summary dynamically
  const getSessionSummary = () => sessionMemory.getSessionSummary();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    // Build conversation history with the new user message included
    const currentHistory = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setShowSmartPrompts(false);

    try {
      const response = await apiRequest("POST", "/api/ai/chat", {
        message: messageText,
        context: {
          currentScreen,
          userRole,
          userName,
          screenData,
          sessionSummary: getSessionSummary(), // Get fresh summary at request time
        },
        conversationHistory: currentHistory,
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Store in session memory
      sessionMemory.addConversation(messageText, data.response);
    } catch (error) {
      console.error("Failed to get AI response:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleSmartPromptClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    // Reset smart prompts when screen changes
    setShowSmartPrompts(true);
  }, [currentScreen]);

  if (!isOpen) return null;

  return (
    <Card
      className="fixed top-0 right-0 h-full w-96 shadow-xl z-[100] flex flex-col rounded-none border-l"
      data-testid="card-ai-assistant"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <CardTitle className="text-base">WebX-AI Assistant</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          data-testid="button-close-assistant"
          className="hover:bg-destructive/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {showSmartPrompts && messages.length === 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Quick Actions</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {smartPrompts.map((smartPrompt, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover-elevate"
                          onClick={() => handleSmartPromptClick(smartPrompt.prompt)}
                          data-testid={`smart-prompt-${idx}`}
                        >
                          {smartPrompt.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-xs">{smartPrompt.prompt}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
                data-testid={`message-${message.role}-${index}`}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about your data, features, or next steps..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              data-testid="input-ai-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
