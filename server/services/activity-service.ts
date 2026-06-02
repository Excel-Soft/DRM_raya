import { db } from "../db";
import { activityLogs, insertActivityLogSchema } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

export class ActivityLogService {
    /**
     * Log an activity to the database to preserve a clear audit trail.
     */
    static async log(data: {
        userId?: string;
        action: string;
        resourceType: string;
        resourceId: string;
        details?: string;
    }) {
        try {
            const parsedData = insertActivityLogSchema.parse(data);
            await db.insert(activityLogs).values(parsedData);
        } catch (error) {
            console.error("[ActivityLogService] Failed to log activity:", error);
        }
    }

    static async getLogsForResource(resourceType: string, resourceId: string) {
        return await db
            .select()
            .from(activityLogs)
            .where(
                and(
                    eq(activityLogs.resourceType, resourceType),
                    eq(activityLogs.resourceId, resourceId)
                )
            );
    }
}
