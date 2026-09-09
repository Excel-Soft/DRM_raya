import { AIAssistantChat } from "../ai-assistant-chat";
import { AssistantProvider } from "@/contexts/assistant-context";

export default function AIAssistantChatExample() {
  return (
    <AssistantProvider>
      <div className="h-screen bg-background flex items-center justify-center">
        <AIAssistantChat isOpen={true} onClose={() => console.log("Close clicked")} />
      </div>
    </AssistantProvider>
  );
}
