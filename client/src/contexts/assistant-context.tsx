import { createContext, useContext, useState } from "react";
import { useScreenContext } from "./screen-context";

type UserRole = "Sales Executive" | "Assistant Manager" | "Manager" | "HOD" | "Admin";

interface AssistantContextValue {
  currentScreen: string;
  userRole: UserRole;
  userName: string;
  screenData: Record<string, any>;
  setScreenData: (data: Record<string, any>) => void;
  setUserRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
}

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const { screenData: contextScreenData } = useScreenContext();
  const [userRole, setUserRole] = useState<UserRole>("Sales Executive");
  const [userName, setUserName] = useState("John Doe");
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
        setUserRole,
        setUserName,
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
