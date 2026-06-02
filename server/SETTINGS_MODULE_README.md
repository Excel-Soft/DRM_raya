# Settings Module - Implementation Notes

## Overview
The Settings module provides role-based access control and policy management for the WebExcels DRM system.

## Components

### 1. Database Tables (4)
- **roles**: System roles (sales_executive, manager, hod, admin, etc.)
- **urlPermissions**: Maps URL paths to allowed roles
- **policies**: DRM policies (text or numeric range types)
- **allowedIps**: IP whitelist for access control

### 2. Repositories (4)
- `roles.repository.ts`: Role CRUD operations
- `url-permissions.repository.ts`: URL permission management with upsert
- `policies.repository.ts`: Policy management with upsert
- `allowed-ips.repository.ts`: IP whitelist management with IP check helper

### 3. API Routes (20+ endpoints)
All routes prefixed with `/api/settings/`:
- **Roles**: GET, POST, PATCH, DELETE
- **URL Permissions**: GET, POST, PATCH, DELETE
- **Policies**: GET (all), GET (by key), POST, PATCH, DELETE
- **Allowed IPs**: GET, POST, PATCH, DELETE

### 4. Middleware
- `checkUrlPermission`: Validates user role against URL permissions
  - Supports exact path matches and prefix matches (e.g., /api/support/tickets matches /api/support/tickets/123)
  - Normalizes trailing slashes and query params
  - Fail-open by default (allows access if no permission defined)

- `checkAllowedIp`: Validates request IP against whitelist
  - Only enforced when `IP_RESTRICTION_ENABLED=true` environment variable is set
  - Fail-closed by default (denies access on error)

## Current State (Development)

### Authentication
- Using mock user injection (similar to Sales, PMS, Support modules)
- Each module injects a test user from the database
- **Production**: Replace with real auth middleware when frontend login is implemented

### Permission Enforcement
The middleware exists but is **not wired to routes** by default.

**To enable permission checking in production:**

```typescript
// In server/routes.ts
import { checkUrlPermission, checkAllowedIp } from "./settings.middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable IP restriction (optional)
  if (process.env.IP_RESTRICTION_ENABLED === "true") {
    app.use(checkAllowedIp);
  }

  // Enable URL permission checking (requires auth middleware first)
  app.use(checkUrlPermission);

  // ... register module routes
}
```

**Note**: Permission checking requires authenticated users with valid `roleId` fields.

## Role Names vs Role IDs

**Important**: The `allowedRoleIds` field in `urlPermissions` stores **role names** (e.g., "sales_executive"), not UUID role IDs.

This matches the `users.roleId` field which also stores role names for simplicity.

## Seed Data

Run `npx tsx server/seed-settings.ts` to populate:
- 5 roles (sales_executive, assistant_manager, manager, hod, admin)
- 8 URL permissions (API routes with role restrictions)
- 5 policies (monthly_time, monthly_leave, data_privacy, code_of_conduct, sales_targets)
- 5 allowed IPs (office networks and sample remote workers)

## Testing

### Manual Testing
```bash
# Get all roles
curl http://localhost:5000/api/settings/roles

# Get URL permissions
curl http://localhost:5000/api/settings/url-permissions

# Get policies
curl http://localhost:5000/api/settings/policies

# Create a new allowed IP
curl -X POST http://localhost:5000/api/settings/allowed-ips \
  -H "Content-Type: application/json" \
  -d '{"ip":"203.0.113.100","location":"Test Location","userName":"test.user@example.com"}'
```

### Automated Testing
To be implemented:
- URL permission matching tests (exact, prefix, with query params)
- Policy retrieval tests (by key, numeric range validation)
- IP check behavior tests (allowed/denied scenarios)

## Security Considerations

### Current (Development)
- ✅ Mock auth for testing
- ✅ Permission middleware exists
- ⚠️ Middleware not wired (all routes open)
- ⚠️ Role validation not enforced

### Production Requirements
1. **Wire authentication middleware** before all protected routes
2. **Wire permission middleware** after auth, before module routes
3. **Validate user.roleId** against roles table on auth
4. **Enable IP restriction** if required (set `IP_RESTRICTION_ENABLED=true`)
5. **Add automated tests** for permission enforcement
6. **Review fail-open vs fail-closed** policy based on security requirements

## Future Enhancements
- HTTP method-specific permissions (GET vs POST vs DELETE)
- More granular path matching (regex patterns, wildcards)
- Permission caching for performance
- Audit logging for denied access attempts
- Role hierarchy/inheritance
- Time-based access restrictions
