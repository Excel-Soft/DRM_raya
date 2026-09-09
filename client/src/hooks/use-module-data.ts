import { useEffect } from 'react';
import { useScreenContext } from '@/contexts/screen-context';

// Pure function to get module data
export function getModuleData(modulePath: string): Record<string, any> {
  const moduleData: Record<string, any> = {
      '/customers/private-pool': {
        totalLeads: 45,
        hotLeads: 12,
        coldLeads: 18,
        warmLeads: 15,
        expiringSoon: 7,
        needsFollowUp: 9,
      },
      '/pms/tasks': {
        totalTasks: 28,
        overdueTasks: 5,
        todayTasks: 8,
        completedThisWeek: 12,
        blockedTasks: 3,
      },
      '/training/drm': {
        totalModules: 15,
        completedModules: 8,
        inProgressModules: 2,
        pendingModules: 5,
        completionPercentage: 53,
      },
      '/workspace': {
        todayGoal: "Complete 6 customer calls",
        timeSpentToday: "4h 25m",
        tasksCompleted: 6,
        tasksPending: 4,
        priorityItems: 3,
      }
    };

    const data = moduleData[modulePath] || {
      info: `Data for ${modulePath} will be available when the module is fully implemented`
    };
  
  return data;
}

// Generic hook for other modules - extensible as new modules are built
export function useModuleData(modulePath: string) {
  const { updateVisibleData } = useScreenContext();

  useEffect(() => {
    updateVisibleData(getModuleData(modulePath));
  }, [modulePath, updateVisibleData]);
}
