import { TopBar } from "../top-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useState } from "react";

export default function TopBarExample() {
  const [isDark, setIsDark] = useState(false);

  return (
    <SidebarProvider>
      <div className="w-full">
        <TopBar
          userRole="Sales Executive"
          userName="John Doe"
          isDark={isDark}
          onThemeToggle={() => setIsDark(!isDark)}
        />
      </div>
    </SidebarProvider>
  );
}
