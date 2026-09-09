import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TargetSlab {
  range: string;
  commission: number;
  bonus?: number;
}

interface ServiceTarget {
  name: string;
  current: number;
  monthly: number;
  quarterly: number;
  halfYearly: number;
  yearly: number;
  slabs: TargetSlab[];
}

const services: ServiceTarget[] = [
  {
    name: "Alibaba Membership",
    current: 35000,
    monthly: 50000,
    quarterly: 150000,
    halfYearly: 300000,
    yearly: 600000,
    slabs: [
      { range: "$1k - $49k", commission: 10, bonus: 500 },
      { range: "$50k - $99k", commission: 15, bonus: 1500 },
      { range: "$100k+", commission: 20, bonus: 3000 },
    ],
  },
  {
    name: "Value-Added Services (VAS)",
    current: 22000,
    monthly: 30000,
    quarterly: 90000,
    halfYearly: 180000,
    yearly: 360000,
    slabs: [
      { range: "$1k - $29k", commission: 8, bonus: 300 },
      { range: "$30k - $59k", commission: 12, bonus: 1000 },
      { range: "$60k+", commission: 18, bonus: 2500 },
    ],
  },
];

export function SalesTargetTracker() {
  return (
    <Card data-testid="card-sales-targets">
      <CardHeader>
        <CardTitle>Sales Targets & Commission</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="alibaba" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="alibaba" data-testid="tab-alibaba">Alibaba</TabsTrigger>
            <TabsTrigger value="vas" data-testid="tab-vas">VAS</TabsTrigger>
          </TabsList>

          {services.map((service) => (
            <TabsContent
              key={service.name}
              value={service.name === "Alibaba Membership" ? "alibaba" : "vas"}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Monthly", value: service.monthly },
                  { label: "Quarterly", value: service.quarterly },
                  { label: "Half-Yearly", value: service.halfYearly },
                  { label: "Yearly", value: service.yearly },
                ].map((target) => {
                  const percentage = Math.round((service.current / target.value) * 100);
                  return (
                    <div key={target.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{target.label}</span>
                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        ${service.current.toLocaleString()} / ${target.value.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Commission Slabs</h4>
                <div className="space-y-2">
                  {service.slabs.map((slab, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{slab.range}</div>
                        <div className="text-xs text-muted-foreground">
                          {slab.commission}% commission
                        </div>
                      </div>
                      <Badge variant="secondary" data-testid={`badge-bonus-${index}`}>
                        ${slab.bonus} bonus
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
