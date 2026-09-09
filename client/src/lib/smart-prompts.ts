// Smart prompts that adapt to each screen in WebExcels DRM

export interface SmartPrompt {
  label: string;
  prompt: string;
  icon?: string;
  priority?: 'high' | 'medium' | 'low';
}

// Generate dynamic prompts based on visible data
export function generateDataAwarePrompts(screenPath: string, screenData: any): SmartPrompt[] {
  const basePrompts = getSmartPromptsForScreen(screenPath);
  
  // Add data-specific prompts based on urgency
  const urgentPrompts: SmartPrompt[] = [];
  
  if (screenData?.urgentItems) {
    if (screenData.urgentItems.overdueLeads > 0) {
      urgentPrompts.push({
        label: "Overdue Leads",
        prompt: `I have ${screenData.urgentItems.overdueLeads} overdue leads. What should I do?`,
        priority: 'high',
      });
    }
    if (screenData.urgentItems.expiringSoon > 0) {
      urgentPrompts.push({
        label: "Expiring Soon",
        prompt: `${screenData.urgentItems.expiringSoon} leads are expiring soon. Show me the action plan.`,
        priority: 'high',
      });
    }
  }
  
  // Add sales performance prompts if targets are low
  if (screenData?.salesTargets) {
    const alibaba = screenData.salesTargets.alibaba?.monthly;
    const vas = screenData.salesTargets.vas?.monthly;
    
    if (alibaba && alibaba.percentage < 60) {
      urgentPrompts.push({
        label: "Alibaba Strategy",
        prompt: "My Alibaba target is behind. What's the best strategy to catch up?",
        priority: 'high',
      });
    }
    if (vas && vas.percentage < 60) {
      urgentPrompts.push({
        label: "VAS Strategy",
        prompt: "My VAS target is behind. How can I improve?",
        priority: 'high',
      });
    }
  }
  
  // Combine urgent prompts first, then base prompts
  return [...urgentPrompts, ...basePrompts];
}

export function getSmartPromptsForScreen(screenPath: string): SmartPrompt[] {
  const promptMap: Record<string, SmartPrompt[]> = {
    "/": [
      { label: "Daily Summary", prompt: "Summarize today's performance across all my metrics" },
      { label: "What's Urgent?", prompt: "What needs my immediate attention right now?" },
      { label: "Goal Progress", prompt: "How close am I to my sales targets this month?" },
      { label: "Top Priorities", prompt: "What should I focus on today to maximize results?" },
    ],
    "/dashboard/manager": [
      { label: "Urgent Follow-ups", prompt: "Which leads need urgent follow-up?" },
      { label: "A-Grade This Week", prompt: "Show me all A-grade customers added this week" },
      { label: "Team Follow-ups", prompt: "Summarize my team's follow-ups for today" },
      { label: "Expiring Leads", prompt: "Which leads are expiring soon and need attention?" },
      { label: "Conversion Analysis", prompt: "Analyze my lead conversion rate this month" },
      { label: "Grade Distribution", prompt: "Explain my current grade distribution and what it means" },
    ],
    "/hr/attendance": [
      { label: "My Attendance", prompt: "Show my attendance summary for this month" },
      { label: "Late Days", prompt: "How many times was I late this month?" },
      { label: "Working Hours", prompt: "Calculate my total working hours this month" },
      { label: "Salary Impact", prompt: "How does my attendance affect my salary calculation?" },
    ],
    "/hr/leave-request": [
      { label: "Leave Balance", prompt: "How many leave days do I have remaining?" },
      { label: "Pending Requests", prompt: "What's the status of my pending leave requests?" },
      { label: "Best Time", prompt: "When is the best time to take leave this month?" },
      { label: "Leave Policy", prompt: "Explain the leave request approval process" },
    ],
    "/hr/overtime": [
      { label: "OT Summary", prompt: "Show my overtime summary for this month" },
      { label: "Pending Approval", prompt: "Which overtime records are pending approval?" },
      { label: "Total Hours", prompt: "How many overtime hours have I worked this month?" },
      { label: "OT Policy", prompt: "Explain the overtime submission and approval process" },
    ],
    "/hr/loan": [
      { label: "Loan Balance", prompt: "How much is remaining on my current loan?" },
      { label: "Pending Requests", prompt: "Which loan requests are pending approval?" },
      { label: "My History", prompt: "Summarize my loan and advance salary history" },
      { label: "Loan Policy", prompt: "Explain the two-level loan approval process" },
    ],
    "/sales/duplicate-checker": [
      { label: "Is This Company Here?", prompt: "How do I check if a company is already in the system?" },
      { label: "Recent Entries", prompt: "Show companies I recently entered" },
      { label: "How It Works", prompt: "Explain how the duplicate checker works" },
      { label: "Next Steps", prompt: "What should I do if a match is found?" },
    ],
    "/sales/add-customer": [
      { label: "Suggest Grade", prompt: "Help me determine the right grade for a new lead" },
      { label: "Check Duplicate", prompt: "Has this company already been added?" },
      { label: "Service Match", prompt: "What services match this customer's industry?" },
      { label: "Required Fields", prompt: "What information is required to add a customer?" },
    ],
    "/sales/temp-contact": [
      { label: "Review Contacts", prompt: "Which temporary contacts should I promote to full customers?" },
      { label: "Quick Add", prompt: "Guide me through adding a quick temporary contact" },
      { label: "No Grade Contacts", prompt: "Which temporary contacts are missing grades?" },
      { label: "This Week's Leads", prompt: "Show me contacts added this week" },
      { label: "Conversion Rate", prompt: "What's my temp contact to customer conversion rate?" },
    ],
    "/sales/lead-pools": [
      { label: "Pool Overview", prompt: "Summarize leads across all my pools" },
      { label: "Claim Strategy", prompt: "Which public pool leads should I claim?" },
      { label: "Expiring Leads", prompt: "Which leads in my private pool are expiring soon?" },
      { label: "GM BV Status", prompt: "Show Gold Member Business Verified leads available" },
      { label: "Hot Service Leads", prompt: "Which service pool leads have high potential?" },
      { label: "Release Guide", prompt: "When should I release leads back to public pool?" },
    ],
    "/pms/tasks": [
      { label: "Overdue Tasks", prompt: "Which tasks are overdue and need immediate attention?" },
      { label: "Blocked Tasks", prompt: "What tasks are currently blocked and how can I unblock them?" },
      { label: "My Workload", prompt: "Summarize my current task workload across all projects" },
      { label: "Today's Focus", prompt: "What tasks should I prioritize today?" },
      { label: "Create Task", prompt: "Guide me through creating a new task with proper priority and assignment" },
      { label: "Task Progress", prompt: "What's the completion rate of tasks this week?" },
    ],
    "/pms/status": [
      { label: "Project Summary", prompt: "Summarize progress on all active projects with task breakdowns" },
      { label: "Blocked Projects", prompt: "Which projects have blocked tasks that need attention?" },
      { label: "Timeline Risk", prompt: "Which projects are at risk of missing their deadlines?" },
      { label: "Team Workload", prompt: "How are tasks distributed across team members?" },
      { label: "Completion Trend", prompt: "What's the overall project completion trend this month?" },
      { label: "Create Project", prompt: "Guide me through setting up a new project" },
    ],
    "/workspace": [
      { label: "Today's Plan", prompt: "What should I accomplish in my workspace today?" },
      { label: "Organize Tasks", prompt: "Help me prioritize my workspace tasks" },
      { label: "Focus Time", prompt: "How should I structure my focus time for maximum productivity?" },
      { label: "Quick Notes", prompt: "What are my most important notes and reminders?" },
      { label: "Task Progress", prompt: "Show my task completion rate for today" },
    ],
    "/policies": [
      { label: "Find Policy", prompt: "Help me find the policy document I need" },
      { label: "Leave Rules", prompt: "What are the leave and attendance policies?" },
      { label: "Commission Structure", prompt: "Explain the sales commission structure" },
      { label: "Data Privacy", prompt: "What are the data privacy guidelines I should follow?" },
      { label: "Remote Work", prompt: "What are the remote work guidelines?" },
      { label: "Expense Policy", prompt: "How do I submit expense reimbursements?" },
    ],
    "/reports": [
      { label: "Overall Performance", prompt: "Show my overall performance across all report types" },
      { label: "GM Last Quarter", prompt: "Show my GM report for last quarter" },
      { label: "BV Approvals", prompt: "How many BV clients were approved?" },
      { label: "VAS This Month", prompt: "List all completed VAS services this month" },
      { label: "Loan Summary", prompt: "Summarize my loan and advance salary activity" },
      { label: "Compare Reports", prompt: "Compare my performance across Loan, VAS, GM, and BV" },
    ],
    "/reports/loan": [
      { label: "Loan Summary", prompt: "Show my loan report summary for this period" },
      { label: "Approval Rate", prompt: "What's my loan approval success rate?" },
      { label: "Pending Loans", prompt: "Which loans are pending approval?" },
      { label: "Monthly Trend", prompt: "How has my loan activity changed month over month?" },
    ],
    "/reports/vas": [
      { label: "VAS Performance", prompt: "Summarize VAS performance this period" },
      { label: "VAS This Month", prompt: "List all completed VAS services this month" },
      { label: "Target Progress", prompt: "How close am I to my VAS targets?" },
      { label: "Improvement Areas", prompt: "Where can I improve VAS sales?" },
    ],
    "/reports/gm": [
      { label: "GM Conversions", prompt: "Show my GM report for last quarter" },
      { label: "GM Pipeline", prompt: "How many customers are in my GM pipeline?" },
      { label: "Conversion Rate", prompt: "What's my Gold Membership conversion rate?" },
      { label: "Top GM Clients", prompt: "List my top Gold Member clients" },
    ],
    "/reports/bv": [
      { label: "BV Approvals", prompt: "How many BV clients were approved?" },
      { label: "Pending BV", prompt: "Show pending business verifications" },
      { label: "Success Rate", prompt: "What's our BV completion rate?" },
      { label: "Recent Verifications", prompt: "List recently verified businesses" },
    ],
    "/training": [
      { label: "Training Summary", prompt: "Which trainings are incomplete?" },
      { label: "Next Step", prompt: "What training should I focus on next?" },
      { label: "DRM Progress", prompt: "Summarize DRM module progress for me" },
      { label: "SEO Training", prompt: "Remind me to complete SEO training" },
      { label: "Overall Progress", prompt: "What's my overall training completion rate?" },
    ],
    "/training/drm": [
      { label: "My Progress", prompt: "Show my progress in DRM training" },
      { label: "Next Module", prompt: "What should I learn next in DRM?" },
      { label: "Incomplete", prompt: "List my incomplete DRM training modules" },
      { label: "Summary", prompt: "Summarize DRM module 3 for me" },
    ],
    "/training/seo": [
      { label: "My Progress", prompt: "Show my progress in SEO training" },
      { label: "Key Concepts", prompt: "Summarize key SEO concepts I should know" },
      { label: "Reminder", prompt: "Remind me to complete SEO training" },
    ],
    "/training/alibaba": [
      { label: "My Progress", prompt: "Show my progress in Alibaba training" },
      { label: "Pending Modules", prompt: "Which Alibaba training modules are pending?" },
    ],
    "/training/salestools": [
      { label: "My Progress", prompt: "Show my progress in Sales Tools training" },
      { label: "Scripts", prompt: "What sales scripts are available?" },
      { label: "Methods", prompt: "Explain the sales methods I should know" },
    ],
  };

  return promptMap[screenPath] || [
    { label: "Help", prompt: "What can you help me with on this screen?" },
    { label: "Features", prompt: "Explain the features available here" },
  ];
}

// Common prompts available on all screens
export const universalPrompts: SmartPrompt[] = [
  { label: "Today's Summary", prompt: "Summarize my activity and performance for today" },
  { label: "Yesterday's Recap", prompt: "What did I miss yesterday?" },
  { label: "Follow-ups Needed", prompt: "Which leads or customers need follow-up?" },
  { label: "Quick Wins", prompt: "What quick wins can I achieve today?" },
];
