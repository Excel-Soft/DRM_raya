import { createContext, useContext, useState } from "react";
import { useScreenContext } from "./screen-context";

interface AssistantContextValue {
  currentScreen: string;
  /** Server-validated role/name only — see AssistantProviderProps. Never a
   *  client-side placeholder; Copilot's backend re-derives identity from the
   *  auth token regardless, but the UI must not *display* a fake identity. */
  userRole: string;
  userName: string;
  screenData: Record<string, any>;
  setScreenData: (data: Record<string, any>) => void;
}

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

interface AssistantProviderProps {
  children: React.ReactNode;
  /**
   * Real, server-validated identity (from App.tsx's `/api/auth/me` resolution).
   * Previously this context owned its own local state defaulting to the
   * placeholders "John Doe" / "Sales Executive" and nothing ever overwrote
   * them, so every assistant request carried a fake identity regardless of
   * who was actually logged in. These are now required props, sourced from
   * the one place real identity is resolved.
   */
  userName: string;
  userRole: string;
}

export function AssistantProvider({ children, userName, userRole }: AssistantProviderProps) {
  const { screenData: contextScreenData } = useScreenContext();
  const [additionalData, setAdditionalData] = useState<Record<string, any>>({});

  // Merge screen context data with additional data
  const screenData = {
    ...contextScreenData.visibleData,
    ...additionalData,
    screenName: contextScreenData.screenName,
    moduleType: contextScreenData.moduleType,
    recentActivity: contextScreenData.recentActivity,
  };

  return (
    <AssistantContext.Provider
      value={{
        currentScreen: contextScreenData.screenPath,
        userRole,
        userName,
        screenData,
        setScreenData: setAdditionalData,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistant must be used within AssistantProvider");
  }
  return context;
}
