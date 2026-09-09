import { useEffect } from 'react';
import { useScreenContext } from '@/contexts/screen-context';

// Export pure function for context provider
export function getDashboardData() {
  return {
      totalCustomers: 1248,
      customersGrowth: 12.5,
      contactsAdded: 156,
      contactsGrowth: 8.2,
      newCustomThisMonth: 42,
      customGrowth: 3.1,
      
      // Sales targets
      salesTargets: {
        alibaba: {
          monthly: { current: 35000, target: 50000, percentage: 70 },
          quarterly: { current: 35000, target: 150000, percentage: 23 },
          halfYearly: { current: 35000, target: 300000, percentage: 12 },
          yearly: { current: 35000, target: 600000, percentage: 6 },
        },
        vas: {
          monthly: { current: 28000, target: 45000, percentage: 62 },
          quarterly: { current: 28000, target: 135000, percentage: 21 },
          halfYearly: { current: 28000, target: 270000, percentage: 10 },
          yearly: { current: 28000, target: 540000, percentage: 5 },
        }
      },
      
      // Commission info
      commissionSlabs: [
        { range: "$1k - $49k", rate: 10, bonus: 500 },
        { range: "$50k - $99k", rate: 15, bonus: 1500 },
        { range: "$100k+", rate: 20, bonus: 3000 },
      ],
      
      // Urgent items
      urgentItems: {
        overdueLeads: 5,
        expiringSoon: 8,
        pendingFollowUps: 12,
        unansweredCalls: 3,
      },
      
      // Recent activities
      recentActivities: [
        { type: "call", customer: "ABC Corp", time: "2 hours ago", status: "completed" },
        { type: "email", customer: "XYZ Ltd", time: "4 hours ago", status: "sent" },
        { type: "meeting", customer: "Tech Solutions", time: "Yesterday", status: "scheduled" },
      ]
  };
}

// Hook to automatically populate screen context with dashboard data
export function useDashboardData() {
  const { updateVisibleData } = useScreenContext();

  useEffect(() => {
    updateVisibleData(getDashboardData());
  }, [updateVisibleData]);
}
