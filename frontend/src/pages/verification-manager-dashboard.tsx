import { VerificationManagerWidget } from "@/components/verification-manager-widget";

export default function VerificationManagerDashboard() {
    return (
        <div className="flex flex-col gap-4 p-4 lg:p-6 min-h-screen bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20">
            {/* Breadcrumb Header */}
            <div className="flex items-center gap-2 text-[14px] font-bold tracking-tight mb-2">
                <span className="text-gray-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                <span className="text-gray-400">/</span>
                <span className="text-[#00a65a] uppercase dark:text-zinc-400">VERIFICATION DEPARTMENT</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-800 uppercase dark:text-zinc-100">VERIFICATION MANAGER</span>
            </div>

            {/* Main Dashboard Widget */}
            <VerificationManagerWidget />
        </div>
    );
}
