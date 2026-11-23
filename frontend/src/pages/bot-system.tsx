import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, Search, Settings, MoreVertical } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Message = {
    id: string;
    text: string;
    sender: "user" | "bot";
    timestamp: Date;
};

type User = {
    id: number;
    fullName: string;
    email: string;
};

function BotBubble({ msg }: { msg: Message }) {
    const isUser = msg.sender === "user";
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${isUser
                    ? "bg-green-600 text-white"
                    : "bg-white dark:bg-zinc-900 border text-gray-800 dark:text-slate-200"
                    }`}
            >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                <p
                    className={`text-xs mt-1 ${isUser ? "text-green-100" : "text-gray-500 dark:text-slate-400"
                        }`}
                >
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
            </div>
        </div>
    );
}

export default function BotSystem() {
    const { toast } = useToast();
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [booted, setBooted] = useState(false);

    const { data: user } = useQuery<User>({
        queryKey: ["/api/me/profile"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/me/profile");
            return await res.json();
        },
    });

    const sendMutation = useMutation({
        mutationFn: async (text: string) => {
            const res = await apiRequest("POST", "/api/bot/send-message", { message: text });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Bot request failed");
            return body as { response: string };
        },
    });

    const pushBot = (text: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `bot-${Date.now()}`,
                text,
                sender: "bot",
                timestamp: new Date(),
            },
        ]);
    };

    const pushUser = (text: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `user-${Date.now()}`,
                text,
                sender: "user",
                timestamp: new Date(),
            },
        ]);
    };

    useEffect(() => {
        if (booted) return;
        setBooted(true);
        sendMutation
            .mutateAsync("Hello")
            .then((data) => pushBot(data.response))
            .catch(() => {
                pushBot("Chat Bot\n\nType Hi or Hello for commands.");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [booted]);

    const sendText = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        pushUser(trimmed);
        setMessage("");
        try {
            const data = await sendMutation.mutateAsync(trimmed);
            pushBot(data.response);
        } catch (e: unknown) {
            const err = e instanceof Error ? e.message : "Failed to reach bot";
            toast({ title: "Bot error", description: err, variant: "destructive" });
        }
    };

    const handleSend = () => sendText(message);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleGetCommands = () => sendText("Hello");

    const handleClearChat = () => {
        setMessages([]);
        setBooted(false);
        toast({ title: "Chat cleared" });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-zinc-900">
            <div className="bg-white border-b px-6 py-4 dark:bg-zinc-900">
                <h1 className="text-sm font-semibold text-gray-800 uppercase tracking-wide dark:text-zinc-100">
                    BOT SYSTEM
                </h1>
            </div>

            <div className="bg-white border-b px-6 py-3 flex items-center justify-between dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-semibold">
                        {user?.fullName
                            ? user.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)
                            : "U"}
                    </div>
                    <div>
                        <p className="font-medium text-gray-800 dark:text-zinc-100">
                            {user?.fullName || "Loading..."}
                        </p>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-600" />
                            Active now
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9" type="button" onClick={handleGetCommands}>
                        <Search className="h-4 w-4 text-gray-600 dark:text-zinc-300" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Settings className="h-4 w-4 text-gray-600 dark:text-zinc-300" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={handleClearChat}>Clear chat</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleGetCommands}>Get commands</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="icon" className="h-9 w-9" type="button" disabled>
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <button
                            type="button"
                            className="text-red-500 text-sm hover:underline"
                            onClick={handleGetCommands}
                        >
                            Click Here To Get Commands
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <BotBubble key={msg.id} msg={msg} />
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white border-t px-6 py-4 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter Message..."
                        className="flex-1 bg-gray-100 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-zinc-900"
                        disabled={sendMutation.isPending}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!message.trim() || sendMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 px-6"
                    >
                        Send
                        <Send className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
