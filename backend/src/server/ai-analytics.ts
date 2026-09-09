// AI Assistant Analytics and Intelligence Layer
import { AssistantContext, UserRole } from "./ai-assistant";

export function getAnalyticalGuidance(context: AssistantContext): string {
  const { screenData, currentScreen, userRole } = context;
  
  if (!screenData || Object.keys(screenData).length === 0) {
    return "No data available for analysis. Provide general guidance about this screen's features.";
  }

  // Dashboard-specific analytics
  if (currentScreen === "/") {
    return analyzeDashboard(screenData, userRole);
  }
  
  // Customer module analytics
  if (currentScreen.startsWith("/customers")) {
    return analyzeCustomerModule(screenData, userRole);
  }
  
  // PMS module analytics
  if (currentScreen.startsWith("/pms")) {
    return analyzePMSModule(screenData, userRole);
  }
  
  // Training module analytics
  if (currentScreen.startsWith("/training")) {
    return analyzeTrainingModule(screenData, userRole);
  }
  
  // HR module analytics (attendance, leave, overtime)
  if (currentScreen.startsWith("/hr")) {
    return analyzeHRModule(screenData, userRole, currentScreen);
  }
  
  // Sales module analytics
  if (currentScreen.startsWith("/sales") || currentScreen.startsWith("/dashboard")) {
    return analyzeSalesModule(screenData, userRole);
  }
  
  return "Analyze the available data and provide relevant insights.";
}

function analyzeDashboard(data: any, role: UserRole): string {
  const insights: string[] = [];
  
  // Sales performance analysis
  if (data.salesTargets) {
    const alibaba = data.salesTargets.alibaba;
    const vas = data.salesTargets.vas;
    
    insights.push("**Sales Performance Analysis:**");
    
    if (alibaba?.monthly?.percentage < 50) {
      insights.push(`- CRITICAL: Alibaba monthly target at ${alibaba.monthly.percentage}% - Needs immediate focus`);
    } else if (alibaba?.monthly?.percentage < 75) {
      insights.push(`- WARNING: Alibaba monthly target at ${alibaba.monthly.percentage}% - Push needed`);
    } else {
      insights.push(`- GOOD: Alibaba monthly target at ${alibaba.monthly.percentage}% - On track`);
    }
    
    if (vas?.monthly?.percentage < 50) {
      insights.push(`- CRITICAL: VAS monthly target at ${vas.monthly.percentage}% - Needs immediate focus`);
    }
  }
  
  // Urgency analysis
  if (data.urgentItems) {
    insights.push("\n**Urgent Action Items:**");
    if (data.urgentItems.overdueLeads > 0) {
      insights.push(`- ${data.urgentItems.overdueLeads} overdue leads - PRIORITY 1`);
    }
    if (data.urgentItems.expiringSoon > 0) {
      insights.push(`- ${data.urgentItems.expiringSoon} leads expiring soon - Act within 48 hours`);
    }
    if (data.urgentItems.pendingFollowUps > 0) {
      insights.push(`- ${data.urgentItems.pendingFollowUps} pending follow-ups - Schedule today`);
    }
  }
  
  // Growth trends
  if (data.customersGrowth !== undefined) {
    insights.push("\n**Growth Trends:**");
    if (data.customersGrowth > 10) {
      insights.push(`- Strong customer growth: +${data.customersGrowth}%`);
    } else if (data.customersGrowth < 5) {
      insights.push(`- Slow customer growth: +${data.customersGrowth}% - Focus on acquisition`);
    }
  }
  
  // Role-specific recommendations
  if (role === "Sales Executive") {
    insights.push("\n**Recommended Actions for Today:**");
    insights.push("1. Address overdue leads first (highest conversion risk)");
    insights.push("2. Follow up with expiring leads");
    insights.push("3. Focus on lower-performing target (Alibaba or VAS)");
    insights.push("4. Log all activities for performance tracking");
  }
  
  return insights.join("\n");
}

function analyzeCustomerModule(data: any, role: UserRole): string {
  const insights: string[] = [];
  
  if (data.totalLeads) {
    insights.push("**Lead Pool Analysis:**");
    insights.push(`- Total Leads: ${data.totalLeads}`);
    
    if (data.hotLeads > 0) {
      insights.push(`- Hot Leads: ${data.hotLeads} (${Math.round(data.hotLeads / data.totalLeads * 100)}%) - PRIORITY`);
    }
    if (data.warmLeads > 0) {
      insights.push(`- Warm Leads: ${data.warmLeads} (${Math.round(data.warmLeads / data.totalLeads * 100)}%) - Follow up this week`);
    }
    if (data.coldLeads > 0) {
      insights.push(`- Cold Leads: ${data.coldLeads} (${Math.round(data.coldLeads / data.totalLeads * 100)}%) - Nurture campaign`);
    }
    
    if (data.expiringSoon > 0) {
      insights.push(`\n**URGENT:** ${data.expiringSoon} leads expiring soon - Contact within 48 hours`);
    }
    
    if (data.needsFollowUp > 0) {
      insights.push(`**Action Required:** ${data.needsFollowUp} leads need follow-up today`);
    }
  }
  
  return insights.join("\n") || "Analyze customer data and provide conversion recommendations.";
}

function analyzePMSModule(data: any, role: UserRole): string {
  const insights: string[] = [];
  
  if (data.totalTasks) {
    insights.push("**Project Task Analysis:**");
    insights.push(`- Total Active Tasks: ${data.totalTasks}`);
    
    if (data.overdueTasks > 0) {
      insights.push(`- OVERDUE: ${data.overdueTasks} tasks (${Math.round(data.overdueTasks / data.totalTasks * 100)}%) - Immediate attention needed`);
    }
    if (data.todayTasks > 0) {
      insights.push(`- Due Today: ${data.todayTasks} tasks - Focus for today`);
    }
    if (data.blockedTasks > 0) {
      insights.push(`- Blocked: ${data.blockedTasks} tasks - Resolve dependencies`);
    }
    
    if (data.completedThisWeek > 0) {
      const completionRate = Math.round(data.completedThisWeek / (data.totalTasks + data.completedThisWeek) * 100);
      insights.push(`\n**Productivity:** ${data.completedThisWeek} tasks completed this week (${completionRate}% completion rate)`);
    }
    
    insights.push("\n**Recommended Priority:**");
    insights.push("1. Clear overdue tasks first");
    insights.push("2. Unblock blocked tasks");
    insights.push("3. Focus on today's tasks");
  }
  
  return insights.join("\n") || "Analyze project tasks and suggest prioritization.";
}

function analyzeTrainingModule(data: any, role: UserRole): string {
  const insights: string[] = [];
  
  if (data.totalModules) {
    insights.push("**Training Progress Analysis:**");
    insights.push(`- Completion: ${data.completionPercentage}% (${data.completedModules}/${data.totalModules} modules)`);
    
    if (data.completionPercentage < 30) {
      insights.push("- STATUS: Behind schedule - Dedicate 30 min daily");
    } else if (data.completionPercentage < 70) {
      insights.push("- STATUS: Making progress - Keep momentum");
    } else {
      insights.push("- STATUS: Almost done - Finish strong!");
    }
    
    if (data.inProgressModules > 0) {
      insights.push(`- Currently learning: ${data.inProgressModules} modules`);
    }
    if (data.pendingModules > 0) {
      insights.push(`- Remaining: ${data.pendingModules} modules`);
    }
    
    insights.push("\n**Recommendation:** Complete in-progress modules before starting new ones.");
  }
  
  return insights.join("\n") || "Track training progress and suggest learning path.";
}

function analyzeHRModule(data: any, role: UserRole, currentScreen: string): string {
  const insights: string[] = [];
  
  // Attendance screen analytics
  if (currentScreen === "/hr/attendance") {
    if (data.summary) {
      insights.push("**Attendance Summary:**");
      insights.push(`- Present Days: ${data.summary.present || 0}`);
      insights.push(`- Absent Days: ${data.summary.absent || 0}`);
      insights.push(`- Late Days: ${data.summary.late || 0}`);
      insights.push(`- Leave Days: ${data.summary.leave || 0}`);
      
      const totalDays = (data.summary.present || 0) + (data.summary.absent || 0) + (data.summary.late || 0) + (data.summary.leave || 0);
      if (totalDays > 0) {
        const attendanceRate = Math.round(((data.summary.present || 0) / totalDays) * 100);
        insights.push(`\n**Attendance Rate:** ${attendanceRate}%`);
        
        if (attendanceRate < 80) {
          insights.push("- WARNING: Attendance below 80% may affect performance review");
        } else if (attendanceRate >= 95) {
          insights.push("- EXCELLENT: Maintaining outstanding attendance record");
        }
      }
      
      if ((data.summary.late || 0) > 3) {
        insights.push(`\n**Attention:** ${data.summary.late} late arrivals this month - Consider adjusting schedule`);
      }
    }
    
    if (data.salary) {
      insights.push("\n**Salary Impact:**");
      insights.push(`- Effective Working Days: ${data.salary.effectiveWorkingDays || 0}`);
    }
    
    return insights.join("\n") || "Review your attendance records and check-in/out times.";
  }
  
  // Leave Request screen analytics
  if (currentScreen === "/hr/leave-request") {
    if (data.stats) {
      insights.push("**Leave Request Summary:**");
      insights.push(`- Total Requests: ${data.stats.total || 0}`);
      insights.push(`- Pending: ${data.stats.pending || 0}`);
      insights.push(`- Approved: ${data.stats.approved || 0}`);
      insights.push(`- Rejected: ${data.stats.rejected || 0}`);
      
      if ((data.stats.pending || 0) > 0) {
        insights.push(`\n**Action Required:** You have ${data.stats.pending} pending leave request(s)`);
      }
      
      const approvalRate = data.stats.total > 0 
        ? Math.round(((data.stats.approved || 0) / data.stats.total) * 100) 
        : 0;
      insights.push(`\n**Approval Rate:** ${approvalRate}%`);
    }
    
    insights.push("\n**Recommendations:**");
    insights.push("- Submit leave requests at least 3 days in advance");
    insights.push("- Provide clear purpose and alternative contact");
    insights.push("- Check calendar for team availability before requesting");
    
    return insights.join("\n") || "Submit and track your leave requests here.";
  }
  
  // Overtime screen analytics
  if (currentScreen === "/hr/overtime") {
    if (data.stats) {
      insights.push("**Overtime Summary:**");
      insights.push(`- Total Records: ${data.stats.totalRecords || 0}`);
      insights.push(`- Pending Approval: ${data.stats.pending || 0}`);
      insights.push(`- Approved: ${data.stats.approved || 0}`);
      insights.push(`- Rejected: ${data.stats.rejected || 0}`);
      
      const totalHours = Math.round((data.stats.totalMinutesApproved || 0) / 60 * 10) / 10;
      insights.push(`\n**Approved Hours This Month:** ${totalHours} hours`);
      
      if ((data.stats.pending || 0) > 0) {
        insights.push(`\n**Pending:** ${data.stats.pending} overtime record(s) awaiting approval`);
      }
      
      if (totalHours > 40) {
        insights.push("\n**Notice:** High overtime hours - Consider discussing workload with manager");
      }
    }
    
    insights.push("\n**Best Practices:**");
    insights.push("- Submit overtime on the same day it's worked");
    insights.push("- Include detailed task descriptions");
    insights.push("- Ensure prior approval for planned overtime");
    
    return insights.join("\n") || "Track and submit your overtime work records.";
  }
  
  return "Analyze HR data and provide relevant insights.";
}

function analyzeSalesModule(data: any, role: UserRole): string {
  const insights: string[] = [];
  
  // Sales dashboard analytics
  if (data.kpis) {
    insights.push("**Sales Performance Overview:**");
    insights.push(`- Total Customers: ${data.kpis.totalCustomers || 0}`);
    insights.push(`- Active Opportunities: ${data.kpis.activeOpportunities || 0}`);
    insights.push(`- Pending Follow-ups: ${data.kpis.pendingFollowUps || 0}`);
  }
  
  // Customer management analytics
  if (data.customers) {
    insights.push("**Customer Insights:**");
    
    if (data.customers.byGrade) {
      const gradeA = data.customers.byGrade.A || 0;
      const gradeB = data.customers.byGrade.B || 0;
      const gradeC = data.customers.byGrade.C || 0;
      insights.push(`- Grade A (Hot): ${gradeA}`);
      insights.push(`- Grade B (Warm): ${gradeB}`);
      insights.push(`- Grade C (Cold): ${gradeC}`);
      
      if (gradeA > 0) {
        insights.push(`\n**Priority:** Focus on ${gradeA} Grade A leads for immediate conversion`);
      }
    }
    
    if (data.customers.needFollowUp > 0) {
      insights.push(`\n**Action Required:** ${data.customers.needFollowUp} customers need follow-up`);
    }
  }
  
  // Pipeline analytics
  if (data.pipeline) {
    insights.push("\n**Pipeline Analysis:**");
    Object.entries(data.pipeline).forEach(([stage, count]) => {
      insights.push(`- ${stage}: ${count}`);
    });
  }
  
  if (role === "Sales Executive") {
    insights.push("\n**Daily Action Plan:**");
    insights.push("1. Check and respond to pending follow-ups");
    insights.push("2. Contact Grade A leads first");
    insights.push("3. Update customer notes after each interaction");
    insights.push("4. Log all activities for performance tracking");
  }
  
  return insights.join("\n") || "Analyze sales data and customer information.";
}

// Intelligence functions for specific query types
export function identifyQueryIntent(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("urgent") || lowerMessage.includes("priority") || lowerMessage.includes("important")) {
    return "urgency";
  }
  if (lowerMessage.includes("summary") || lowerMessage.includes("overview")) {
    return "summary";
  }
  if (lowerMessage.includes("how") || lowerMessage.includes("what") || lowerMessage.includes("explain")) {
    return "explanation";
  }
  if (lowerMessage.includes("should i") || lowerMessage.includes("recommend") || lowerMessage.includes("suggest")) {
    return "recommendation";
  }
  if (lowerMessage.includes("compare") || lowerMessage.includes("difference") || lowerMessage.includes("vs")) {
    return "comparison";
  }
  
  return "general";
}
