// @ts-nocheck
import React from 'react';
import { DashboardProvider, useDashboard } from './hooks/DashboardContext';
import { CommissionVerificationView } from './views/CommissionVerificationView';
import { CompletedProjectView } from './views/CompletedProjectView';
import { DepProjectView } from './views/DepProjectView';
import { InProgressProjectView } from './views/InProgressProjectView';
import { LateComingView } from './views/LateComingView';
import { LoanApplicationView } from './views/LoanApplicationView';
import { OverTimeView } from './views/OverTimeView';
import { PendingProjectView } from './views/PendingProjectView';
import { PerformanceView } from './views/PerformanceView';
import { PmsSettingView } from './views/PmsSettingView';
import { ProjectListView } from './views/ProjectListView';
import { ProjectReportView } from './views/ProjectReportView';
import { ProjectTaskView } from './views/ProjectTaskView';
import { RunningProjectView } from './views/RunningProjectView';
import { TaskCreateView } from './views/TaskCreateView';
import { UpcomingProjectView } from './views/UpcomingProjectView';
import { DashboardView } from './views/DashboardView';

function DashboardRenderer() {
    const { currentView } = useDashboard();
    
    switch (currentView) {
        case "commission-verification": return <CommissionVerificationView />;
        case "completed-project": return <CompletedProjectView />;
        case "dep-project": return <DepProjectView />;
        case "in-progress-project": return <InProgressProjectView />;
        case "late-coming": return <LateComingView />;
        case "loan-application": return <LoanApplicationView />;
        case "over-time": return <OverTimeView />;
        case "pending-project": return <PendingProjectView />;
        case "performance": return <PerformanceView />;
        case "pms-setting": return <PmsSettingView />;
        case "project-list": return <ProjectListView />;
        case "project-report": return <ProjectReportView />;
        case "project-task": return <ProjectTaskView />;
        case "running-project": return <RunningProjectView />;
        case "task-create": return <TaskCreateView />;
        case "upcoming-project": return <UpcomingProjectView />;
        default: return <DashboardView />;
    }
}

export default function SoftwareManagerDashboard() {
    return (
        <DashboardProvider>
            <DashboardRenderer />
        </DashboardProvider>
    );
}
