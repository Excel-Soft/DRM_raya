import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, MessageSquare, Users, Mail } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ActivityType = "call" | "whatsapp" | "meeting" | "email";

interface Activity {
  id: number;
  type: ActivityType;
  duration: number;
  timestamp: Date;
}

const activityTypes = [
  { value: "call" as ActivityType, label: "Call", icon: Phone },
  { value: "whatsapp" as ActivityType, label: "WhatsApp", icon: MessageSquare },
  { value: "meeting" as ActivityType, label: "Meeting", icon: Users },
  { value: "email" as ActivityType, label: "Email", icon: Mail },
];

export function ActivityLogger() {
  const [selectedType, setSelectedType] = useState<ActivityType>("call");
  const [duration, setDuration] = useState("30");
  const [activities, setActivities] = useState<Activity[]>([]);

  const handleLog = () => {
    const newActivity: Activity = {
      id: Date.now(),
      type: selectedType,
      duration: parseInt(duration) || 0,
      timestamp: new Date(),
    };
    setActivities([newActivity, ...activities]);
    setDuration("30");
    console.log("Activity logged:", newActivity);
  };

  const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);

  return (
    <Card data-testid="card-activity-logger">
      <CardHeader>
        <CardTitle>Activity Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Activity Type</Label>
          <div className="grid grid-cols-4 gap-2">
            {activityTypes.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={selectedType === value ? "default" : "outline"}
                onClick={() => setSelectedType(value)}
                className="flex flex-col gap-1 h-auto py-3"
                data-testid={`button-activity-${value}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            data-testid="input-duration"
          />
        </div>

        <Button onClick={handleLog} className="w-full" data-testid="button-log-activity">
          Log Activity
        </Button>

        {activities.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Today's Activities</h4>
              <span className="text-sm text-muted-foreground">
                Total: {totalMinutes} mins ({(totalMinutes / 60).toFixed(1)}h)
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activities.slice(0, 5).map((activity) => {
                const typeConfig = activityTypes.find((t) => t.value === activity.type)!;
                const Icon = typeConfig.icon;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    data-testid={`activity-${activity.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{typeConfig.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{activity.duration} mins</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
