import { MetricCard } from "../metric-card";
import { Users, UserPlus, RefreshCw, Clock } from "lucide-react";

export default function MetricCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-background">
      <MetricCard
        title="Total Customers"
        value="1,248"
        icon={Users}
        trend={{ value: 12.5, isPositive: true }}
      />
      <MetricCard
        title="Contacts Added"
        value="156"
        icon={UserPlus}
        trend={{ value: 8.2, isPositive: true }}
      />
      <MetricCard
        title="New Customers"
        value="42"
        icon={RefreshCw}
        trend={{ value: 3.1, isPositive: false }}
      />
      <MetricCard
        title="Renewals"
        value="28"
        icon={Clock}
        subtitle="14 expiring in 7 days"
      />
    </div>
  );
}
