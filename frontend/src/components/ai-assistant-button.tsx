import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

// Not needed for the initial visible dashboard — only fetched once the user
// actually opens the assistant. `hasOpenedOnce` (not `isOpen`) gates mounting
// so the panel — and its chat history — stays mounted across subsequent
// close/reopen toggles, matching the previous always-mounted behavior.
const CopilotPanel = lazy(() =>
  import("./copilot/copilot-panel").then((m) => ({ default: m.CopilotPanel })),
);

const SIZE = 56; // w-14 / h-14
const MARGIN = 8;
const POS_KEY = "ai-assistant-button-pos";

type Pos = { x: number; y: number };

const clampPos = (p: Pos): Pos => ({
  x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - SIZE - MARGIN),
  y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - SIZE - MARGIN),
});

/** Default spot = old bottom-6 right-6. */
const defaultPos = (): Pos => ({ x: window.innerWidth - SIZE - 24, y: window.innerHeight - SIZE - 24 });

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return clampPos(p);
    }
  } catch { /* storage unavailable */ }
  return defaultPos();
}

export function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  // Draggable: press and move to reposition anywhere on screen; a press without
  // movement still opens the assistant. Position is remembered per browser.
  const [pos, setPos] = useState<Pos>(loadPos);
  const drag = useRef<{ startX: number; startY: number; origin: Pos; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { startX: e.clientX, startY: e.clientY, origin: pos, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setPos(clampPos({ x: d.origin.x + dx, y: d.origin.y + dy }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (!d) return;
    if (d.moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* storage unavailable */ }
      return;
    }
    setIsOpen(!isOpen);
    setHasOpenedOnce(true);
  };

  const buttonContent = (
    <>
      <div
        className="fixed w-14 h-14 bg-primary hover-elevate active-elevate-2 cursor-grab active:cursor-grabbing select-none touch-none flex items-center justify-center shadow-lg rounded-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        title="Drag to move"
        data-testid="button-open-ai-assistant"
        style={{
          left: pos.x,
          top: pos.y,
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
          <CopilotPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );

  return createPortal(buttonContent, document.body);
}
