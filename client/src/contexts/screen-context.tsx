import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { sessionMemory } from '@/lib/session-memory';

export interface ScreenData {
  screenPath: string;
  screenName: string;
  moduleType: 'dashboard' | 'customers' | 'pms' | 'training' | 'reports' | 'workspace' | 'other';
  visibleData: Record<string, any>;
  recentActivity: any[];
  userRole: string;
}

interface ScreenContextType {
  screenData: ScreenData;
  updateVisibleData: (data: Record<string, any>) => void;
  addRecentActivity: (activity: any) => void;
}

const ScreenContext = createContext<ScreenContextType | undefined>(undefined);

function getModuleType(path: string): ScreenData['moduleType'] {
  if (path === '/' || path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/customers') || path.startsWith('/sales/customers')) return 'customers';
  if (path.startsWith('/pms')) return 'pms';
  if (path.startsWith('/training')) return 'training';
  if (path.startsWith('/reports')) return 'reports';
  if (path === '/workspace') return 'workspace';
  return 'other';
}

function getScreenName(path: string): string {
  const screenMap: Record<string, string> = {
    "/": "Dashboard",
    "/dashboard/sales-executive": "Sales Executive Dashboard",
    "/dashboard/software-executive": "Software Executive Dashboard",
    "/sales/customers": "Customer Management",
    "/sales/duplicate-checker": "Duplicate Checker",
    "/sales/add-customer": "Add Customer",
    "/attendance": "Attendance & Leave Tracker",
    "/hr/attendance": "Attendance Management",
    "/hr/leave-request": "Leave Request",
    "/hr/overtime": "Overtime Submission",
    "/hr/loan": "Loan / Advance Salary",
    "/loan-request": "Loan Request",
    "/customers/duplicate-check": "Duplicate Check",
    "/customers/add": "Add Customer",
    "/customers/temp": "Temporary Contacts",
    "/customers/private-pool": "Private Pool",
    "/customers/service-pool": "Service Pool",
    "/customers/gm-pool": "GM Pool",
    "/pms/tasks": "PMS Task Creation",
    "/pms/status": "PMS Project Status",
    "/workspace": "Workspace",
    "/gm-pool/add-gm": "GM Pool / Add GM",
    "/reports/loan": "Loan Reports",
    "/reports/vas": "VAS Reports",
    "/reports/gm": "GM Reports",
    "/reports/bv": "BV Reports",
    "/training/drm": "DRM Training",
    "/training/seo": "SEO Training",
    "/training/alibaba": "Alibaba Training",
  };
  
  return screenMap[path] || "Unknown Screen";
}

export function ScreenContextProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const prevLocationRef = useRef<string>(location);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [visibleData, setVisibleData] = useState<Record<string, any>>({});

  const screenData: ScreenData = {
    screenPath: location,
    screenName: getScreenName(location),
    moduleType: getModuleType(location),
    visibleData,
    recentActivity,
    userRole: sessionStorage.getItem("userRole") || "",
  };

  const updateVisibleData = useCallback((data: Record<string, any>) => {
    setVisibleData(prev => ({ ...prev, ...data }));
  }, []);

  const addRecentActivity = useCallback((activity: any) => {
    setRecentActivity(prev => [activity, ...prev].slice(0, 10)); // Keep last 10 activities
  }, []);

  // Clear visible data when route changes and track navigation
  useEffect(() => {
    const prevLocation = prevLocationRef.current;
    
    if (prevLocation !== location) {
      setVisibleData({});
      sessionMemory.addNavigation(prevLocation, location);
      prevLocationRef.current = location;
    }
  }, [location]);

  return (
    <ScreenContext.Provider value={{ screenData, updateVisibleData, addRecentActivity }}>
      {children}
    </ScreenContext.Provider>
  );
}

export function useScreenContext() {
  const context = useContext(ScreenContext);
  if (!context) {
    throw new Error('useScreenContext must be used within ScreenContextProvider');
  }
  return context;
}
