import { useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

// Not needed for the initial visible dashboard — only fetched once the user
// actually opens the assistant. `hasOpenedOnce` (not `isOpen`) gates mounting
// so the panel — and its chat history — stays mounted across subsequent
// close/reopen toggles, matching the previous always-mounted behavior.
const AIAssistantChat = lazy(() =>
  import("./ai-assistant-chat").then((m) => ({ default: m.AIAssistantChat })),
);

export function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);

  const buttonContent = (
    <>
      <div
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover-elevate active-elevate-2 cursor-pointer flex items-center justify-center shadow-lg rounded-full"
        onClick={() => {
          setIsOpen(!isOpen);
          setHasOpenedOnce(true);
        }}
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

      {hasOpenedOnce && (
        <Suspense fallback={null}>
          <AIAssistantChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );

  return createPortal(buttonContent, document.body);
}
