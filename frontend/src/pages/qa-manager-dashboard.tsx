import { QAManagerWidget } from "@/components/qa-manager-widget";

export default function QAManagerDashboard() {
    return (
        <div className="flex flex-col gap-4 p-4 lg:p-6 min-h-screen bg-slate-50/50">
            <div className="flex items-center gap-2 text-[14px] font-bold tracking-tight mb-2">
                <span className="text-gray-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                <span className="text-gray-400">/</span>
                <span className="text-[#00a65a] uppercase dark:text-zinc-400">QA DEPARTMENT</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-800 uppercase dark:text-zinc-100">QA MANAGER</span>
            </div>
            <QAManagerWidget />
        </div>
    );
}
