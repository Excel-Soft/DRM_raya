import { db } from "./server/db";
import { users, roles } from "./shared/schema";
import { eq, or, like } from "drizzle-orm";

async function fixRoles() {
    console.log("Fetching users with role 'posting_executive'...");
    
    // Get users who have 'posting_executive' as their main role
    const usersWithRole = await db.select().from(users).where(eq(users.role, 'posting_executive'));
    
    console.log(`Found ${usersWithRole.length} users with primary role 'posting_executive'`);
    
    // Update them to 'product_posting_executive'
    for (const user of usersWithRole) {
        // Also fix the roles array if it exists
        let newRoles = Array.isArray(user.roles) ? [...user.roles] : [];
        if (newRoles.includes('posting_executive')) {
            newRoles = newRoles.map(r => r === 'posting_executive' ? 'product_posting_executive' : r);
        }
        
        await db.update(users)
            .set({ 
                role: 'product_posting_executive',
                roles: newRoles 
            })
            .where(eq(users.id, user.id));
        console.log(`Updated user ${user.fullName} (${user.id})`);
    }

    // Also check all users to see if anyone has 'posting_executive' in their roles array but not as primary
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
        if (Array.isArray(user.roles) && user.roles.includes('posting_executive') && user.role !== 'posting_executive') {
             let newRoles = user.roles.map((r: string) => r === 'posting_executive' ? 'product_posting_executive' : r);
             // Ensure uniqueness
             newRoles = [...new Set(newRoles)];
             await db.update(users)
                .set({ roles: newRoles })
                .where(eq(users.id, user.id));
             console.log(`Updated roles array for user ${user.fullName} (${user.id})`);
        }
    }
    
    console.log("Deleting 'posting_executive' from roles table...");
    try {
        await db.delete(roles).where(eq(roles.name, 'posting_executive'));
        console.log("Deleted 'posting_executive' role successfully.");
    } catch (e: any) {
        console.error("Error deleting role:", e.message);
    }
    
    process.exit(0);
}

fixRoles();
