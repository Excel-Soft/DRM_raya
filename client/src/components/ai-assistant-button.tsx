import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { AIAssistantChat } from "./ai-assistant-chat";

export function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);

  const buttonContent = (
    <>
      <div
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover-elevate active-elevate-2 cursor-pointer flex items-center justify-center shadow-lg rounded-full"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-open-ai-assistant"
        style={{
          zIndex: 9999,
          pointerEvents: 'auto',
          visibility: 'visible',
          opacity: 1,
        }}
      >
        <Sparkles className="w-6 h-6 text-primary-foreground" />
      </div>

      <AIAssistantChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );

  return createPortal(buttonContent, document.body);
}
