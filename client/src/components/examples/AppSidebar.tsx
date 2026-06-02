import { AppSidebar } from "../app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "280px",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="h-screen">
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}
