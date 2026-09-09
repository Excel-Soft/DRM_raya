import { useState } from "react";
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

export default function OnlineForm() {
    const { toast } = useToast();
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);

    // Fetch current user data
    const { data: user } = useQuery<User>({
        queryKey: ["/api/me/profile"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/me/profile");
            return await res.json();
        },
    });

    // Send message mutation
    const sendMutation = useMutation({
        mutationFn: async (text: string) => {
            return apiRequest("POST", "/api/forms/send-message", { message: text });
        },
        onSuccess: (response) => {
            // Add user message
            const userMsg: Message = {
                id: Date.now().toString(),
                text: message,
                sender: "user",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMsg]);
            setMessage("");

            // Simulate bot response
            setTimeout(() => {
                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    text: "Form submission received. How can I help you?",
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, botMsg]);
            }, 500);
        },
        onError: () => {
            toast({ title: "Failed to send message", variant: "destructive" });
        },
    });

    const handleSend = () => {
        if (!message.trim()) return;
        sendMutation.mutate(message);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleViewProfile = () => {
        toast({ title: "View Profile clicked" });
    };

    const handleClearChat = () => {
        setMessages([]);
        toast({ title: "Chat cleared" });
    };

    const handleMuted = () => {
        toast({ title: "Muted toggled" });
    };

    const handleDelete = () => {
        toast({ title: "Delete clicked", variant: "destructive" });
    };

    const handleGetCommands = () => {
        const commandsMsg: Message = {
            id: Date.now().toString(),
            text: "Available form commands:\n/submit - Submit form\n/clear - Clear form\n/help - Get help",
            sender: "bot",
            timestamp: new Date(),
        };
        setMessages([commandsMsg]);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-sm font-semibold text-gray-800 uppercase tracking-wide dark:text-zinc-100">
                            ONLINE FORM
                        </h1>
                    </div>
                </div>
            </div>

            {/* User Info Bar */}
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
                            <span className="w-2 h-2 rounded-full bg-green-600"></span>
                            Active now
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Search className="h-4 w-4 text-gray-600 dark:text-zinc-300" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem>
                                Action
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Another action
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Something else
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Settings className="h-4 w-4 text-gray-600 dark:text-zinc-300" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={handleViewProfile}>
                                View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleClearChat}>
                                Clear chat
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleMuted}>
                                Muted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <MoreVertical className="h-4 w-4 text-gray-600 dark:text-zinc-300" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem>
                                Action
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Another action
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Something else
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <button
                                className="text-red-500 text-sm cursor-pointer hover:underline bg-transparent border-0 font-medium"
                                onClick={handleGetCommands}
                            >
                                Click Here To Get Commands
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"
                                    }`}
                            >
                                <div
                                    className={`max-w-md px-4 py-2 rounded-lg ${msg.sender === "user"
                                            ? "bg-green-600 text-white"
                                            : "bg-white dark:bg-zinc-900 border text-gray-800 dark:text-slate-200"
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-line">{msg.text}</p>
                                    <p
                                        className={`text-xs mt-1 ${msg.sender === "user"
                                                ? "text-green-100"
                                                : "text-gray-500 dark:text-slate-400"
                                            }`}
                                    >
                                        {msg.timestamp.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="bg-white border-t px-6 py-4 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter Message..."
                        className="flex-1 bg-gray-100 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-zinc-900"
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
