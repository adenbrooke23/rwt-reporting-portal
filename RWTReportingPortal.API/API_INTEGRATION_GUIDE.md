# API Integration Guide

This document captures lessons learned while connecting the Angular frontend to the .NET API backend. Use this as a reference when implementing future API endpoints.

---

## Table of Contents
- [Authentication & Authorization](#authentication--authorization)
- [API Endpoint Patterns](#api-endpoint-patterns)
- [Common Issues & Solutions](#common-issues--solutions)
- [Checklist for New Endpoints](#checklist-for-new-endpoints)
- [Testing API Endpoints](#testing-api-endpoints)

---

## Authentication & Authorization

### JWT Token Flow
1. User authenticates via Microsoft Entra SSO
2. API returns JWT access token and refresh token
3. Angular stores tokens in localStorage
4. **Auth interceptor** attaches `Authorization: Bearer {token}` to all API requests

### Auth Interceptor (Critical)
Location: `rwt-reporting-portal/src/app/core/interceptors/auth.interceptor.ts`

The interceptor automatically adds the JWT token to requests going to the API. **Important**: It reads the token directly from localStorage instead of injecting AuthService to avoid a circular dependency (see Issue 8 below).

```typescript
// Reads directly from localStorage - NO service injection
private getAccessToken(): string | null {
  if (!isPlatformBrowser(this.platformId)) {
    return null;
  }
  const tokenStr = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if (tokenStr) {
    const token = JSON.parse(tokenStr);
    return token?.accessToken || null;
  }
  return null;
}
```

**Without this interceptor, all authenticated API calls will return 401 Unauthorized.**

### User ID Extraction
The .NET API extracts the user ID from JWT claims:
```csharp
private int GetUserId()
{
    var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (int.TryParse(userIdClaim, out var userId))
    {
        return userId;
    }
    throw new UnauthorizedAccessException("Invalid user token");
}
```

---

## API Endpoint Patterns

### Base URLs
- **API Base**: `https://erpqaapi.redwoodtrust.com/api`
- **Auth endpoints**: `/api/auth/*`
- **User endpoints**: `/api/users/*`

### Angular Service Pattern
Always use full API URLs, not relative paths:
```typescript
// Correct
private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';
private readonly USERS_API_URL = `${this.API_BASE_URL}/users`;

this.http.get(`${this.USERS_API_URL}/profile`)

// Incorrect - will fail in production
this.http.get('/api/users/profile')
```

### .NET Controller Pattern
```csharp
[ApiController]
[Route("api/users")]
[Authorize]  // Requires JWT authentication
public class UsersController : ControllerBase
{
    [HttpGet("profile")]    // GET /api/users/profile
    [HttpPut("profile/avatar")]  // PUT /api/users/profile/avatar
}
```

---

## Common Issues & Solutions

### Issue 1: 405 Method Not Allowed
**Cause**: IIS WebDAV module blocks PUT and DELETE requests by default.

**Solution**: Add `web.config` to disable WebDAV:
```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\RWTReportingPortal.API.dll" stdoutLogEnabled="false" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
```

**Note**: If sections are locked at the IIS server level, WebDAV must be disabled by an IIS admin.

### Issue 2: 401 Unauthorized
**Causes**:
1. Auth interceptor not registered in `app.config.ts`
2. Token not being sent with request
3. Token expired

**Solution**: Ensure interceptor is registered:
```typescript
// app.config.ts
import { authInterceptorProvider } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    authInterceptorProvider  // Add this!
  ]
};
```

### Issue 3: Navigation Properties Not Loading (null values)
**Cause**: Entity Framework doesn't load related entities by default.

**Bad** - Profile will be null:
```csharp
var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
return user.Profile?.AvatarId;  // Always null!
```

**Good** - Include related entity:
```csharp
var user = await _context.Users
    .Include(u => u.Profile)
    .FirstOrDefaultAsync(u => u.UserId == userId);
return user.Profile?.AvatarId;  // Works!
```

**Alternative** - Query the related table directly:
```csharp
var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
return profile?.AvatarId;  // Works!
```

### Issue 4: Cannot Find Expired/Locked Users (404 on Restore/Unlock)
**Cause**: Standard `GetByIdAsync` filters out expired users with `WHERE !IsExpired`.

**Solution**: Create a separate method that doesn't filter:
```csharp
// Standard method - filters out expired users
public async Task<User?> GetByIdAsync(int userId)
{
    return await _context.Users
        .FirstOrDefaultAsync(u => u.UserId == userId && !u.IsExpired);
}

// Special method for admin operations - includes expired users
public async Task<User?> GetByIdIncludeExpiredAsync(int userId)
{
    return await _context.Users
        .FirstOrDefaultAsync(u => u.UserId == userId);
}
```

**Use `GetByIdIncludeExpiredAsync` for**:
- Unlock user endpoint
- Restore user endpoint
- Any admin operation that needs to find inactive/expired users

**Account Status Hierarchy**:
- `IsExpired` supersedes `IsActive` - expired users are filtered from queries entirely
- `IsLockedOut` is checked after IsExpired
- Lock operation should set both `IsLockedOut = true` AND `IsActive = false`

### Issue 7: Admin Role Management vs Department Assignment
**Pattern Difference**: Admin role uses immediate save (toggling checkbox calls API directly), while departments use deferred save (changes are batched and saved with "Save Changes" button).

**Admin Role Flow** (Immediate):
```typescript
// Frontend: Toggle calls API immediately
async toggleAdminRole(): Promise<void> {
  const confirmed = await this.confirmationService.confirm(...);
  if (!confirmed) return;

  this.adminUserService.updateUserAdminRole(userId, newAdminStatus).subscribe({
    next: () => {
      // Update local user's roles array
      if (newAdminStatus) {
        this.selectedUser.roles = [...this.selectedUser.roles, 'Admin'];
      } else {
        this.selectedUser.roles = this.selectedUser.roles.filter(r => r.toLowerCase() !== 'admin');
      }
    }
  });
}
```

**Backend Implementation** (Uses UserRoles table):
```csharp
public async Task UpdateUserAdminRoleAsync(int userId, bool isAdmin, int grantedBy)
{
    var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "Admin");
    var existingUserRole = await _context.UserRoles
        .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == adminRole.RoleId);

    if (isAdmin && existingUserRole == null)
    {
        // Add Admin role
        _context.UserRoles.Add(new UserRole { UserId = userId, RoleId = adminRole.RoleId, ... });
    }
    else if (!isAdmin && existingUserRole != null)
    {
        // Remove Admin role
        _context.UserRoles.Remove(existingUserRole);
    }
    await _context.SaveChangesAsync();
}
```

**Security Note**: Users cannot modify their own admin status (enforced in both frontend and backend).

### Issue 8: NG0200 InjectionToken Error After Page Refresh
**Cause**: Circular dependency in Angular's dependency injection:
`HttpClient` → `HTTP_INTERCEPTORS` → `AuthInterceptor` → `AuthService` → `HttpClient`

When the auth interceptor injected AuthService, and AuthService injected HttpClient, it created a circular dependency. This worked on initial login but caused NG0200 errors after page refresh during hydration.

**Symptoms**:
- Login works fine
- After page refresh, console shows: `NG0200: Circular dependency in DI detected for InjectionToken HTTP_INTERCEPTORS`
- Theme doesn't load, user profile doesn't load, API calls fail

**Solution**: The auth interceptor reads JWT tokens directly from localStorage instead of injecting AuthService:
```typescript
// BAD - causes circular dependency
constructor(private authService: AuthService) { }

// GOOD - reads directly from storage
private getAccessToken(): string | null {
  const tokenStr = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if (tokenStr) {
    const token = JSON.parse(tokenStr);
    return token?.accessToken || null;
  }
  return null;
}
```

**Key Rule**: HTTP interceptors should NEVER inject services that themselves use HttpClient.

### Issue 5: Data Saved But Not Fetched on Login
**Cause**: JWT token doesn't contain database-stored values (like avatar). Must fetch from API after login.

**Solution**: After SSO callback, fetch user profile:
```typescript
handleSSOTokens(accessToken: string, refreshToken?: string): void {
  // 1. Decode JWT for basic user info
  const user = this.decodeJwtUser(accessToken);

  // 2. Store token (needed for API calls)
  this.storeToken(token, true);

  // 3. Fetch full profile from API (includes avatar, preferences, etc.)
  this.fetchUserProfile().subscribe({
    next: (profile) => {
      const updatedUser = { ...user, avatarId: profile.avatarId };
      this.storeUser(updatedUser, true);
    }
  });
}
```

### Issue 6: CORS Errors
**Cause**: API not configured to accept requests from Angular app's origin.

**Solution**: Configure CORS in `Program.cs`:
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.WithOrigins("https://erpqa.redwoodtrust.com")
            .AllowAnyHeader()
            .AllowAnyMethod()  // Allows GET, POST, PUT, DELETE
            .AllowCredentials();
    });
});
```

---

## Checklist for New Endpoints

### Backend (.NET API)

- [ ] Create DTO classes for request/response in `Models/DTOs/`
- [ ] Add endpoint to appropriate controller with correct HTTP verb
- [ ] Add `[Authorize]` attribute if authentication required
- [ ] Use `GetUserId()` helper to get current user from JWT
- [ ] If loading related data, use `.Include()` or query table directly
- [ ] Implement service method if business logic needed
- [ ] Test endpoint with Swagger or curl before frontend integration

### Frontend (Angular)

- [ ] Use full API URL (not relative path)
- [ ] Ensure auth interceptor is registered (for authenticated endpoints)
- [ ] Handle loading states (`isLoading = true/false`)
- [ ] Handle errors with user-friendly messages
- [ ] Update local state/storage after successful API calls
- [ ] Test with browser DevTools Network tab

---

## Testing API Endpoints

### From Browser Console (Quick Test)
```javascript
// GET request
fetch('https://erpqaapi.redwoodtrust.com/api/users/profile', {
  headers: {
    'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('auth_token')).accessToken
  }
}).then(r => r.json()).then(console.log)

// PUT request
fetch('https://erpqaapi.redwoodtrust.com/api/users/profile/avatar', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('auth_token')).accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ avatarId: 'avatar-blue' })
}).then(r => r.json()).then(console.log)
```

### From Command Line (curl)
```bash
# GET
curl -H "Authorization: Bearer YOUR_TOKEN" https://erpqaapi.redwoodtrust.com/api/users/profile

# PUT
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avatarId":"avatar-blue"}' \
  https://erpqaapi.redwoodtrust.com/api/users/profile/avatar
```

### Using Swagger
Navigate to `https://erpqaapi.redwoodtrust.com/swagger` (if enabled in development).

---

## Current Working Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/auth/login` | Initiate SSO login | Working |
| GET | `/api/auth/callback` | SSO callback handler | Working |
| POST | `/api/auth/login` | Password login (ROPC) | Working |
| POST | `/api/auth/refresh` | Refresh access token | Working |
| GET | `/api/users/profile` | Get user profile (avatar) | Working |
| PUT | `/api/users/profile/avatar` | Update avatar | Working |
| GET | `/api/users/preferences` | Get user preferences | Implemented |
| PUT | `/api/users/preferences` | Update preferences | Implemented |
| GET | `/api/users/stats` | Get user statistics | Implemented |

### Hub Endpoints (Requires Authentication)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/hubs` | Get accessible hubs for current user | Working |
| GET | `/api/hubs/{hubId}` | Get hub detail with reports | Pending |
| GET | `/api/hubs/{hubId}/reports` | Get reports in hub | Pending |

**Permission Logic for `/api/hubs`:**
1. **Admin users** → See all active hubs
2. **Regular users** → See hubs where they have:
   - Direct hub access (UserHubAccess)
   - Direct report access (UserReportAccess → hub)
   - Department membership (UserDepartments → ReportDepartments → hub)

### Admin User Management Endpoints (Requires Admin Role)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/admin/users` | Get paginated user list (includes counts) | Working |
| GET | `/api/admin/users/{userId}` | Get user details | Working |
| GET | `/api/admin/users/{userId}/permissions` | Get user hub/report permissions | Working |
| PUT | `/api/admin/users/{userId}/lock` | Lock user account | Working |
| PUT | `/api/admin/users/{userId}/unlock` | Unlock user account | Working |
| PUT | `/api/admin/users/{userId}/expire` | Expire user account | Working |
| PUT | `/api/admin/users/{userId}/restore` | Restore expired account | Working |
| GET | `/api/admin/users/{userId}/departments` | Get user's departments | Working |
| POST | `/api/admin/users/{userId}/departments` | Assign user to department | Working |
| DELETE | `/api/admin/users/{userId}/departments/{deptId}` | Remove from department | Working |
| PUT | `/api/admin/users/{userId}/roles/admin` | Grant/revoke admin role | Working |
| POST | `/api/admin/users/{userId}/permissions/hub` | Grant hub access | Working |
| DELETE | `/api/admin/users/{userId}/permissions/hub/{hubId}` | Revoke hub access | Working |
| POST | `/api/admin/users/{userId}/permissions/report` | Grant report access | Working |
| DELETE | `/api/admin/users/{userId}/permissions/report/{reportId}` | Revoke report access | Working |

### Admin Hub Endpoints (Requires Admin Role)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/admin/hubs` | Get all hubs (admin view) | Working |
| GET | `/api/admin/hubs/{hubId}` | Get hub by ID | Working |
| GET | `/api/admin/hubs/with-reports` | Get hubs with reports (for permission UI) | Working |
| POST | `/api/admin/hubs` | Create hub | Working |
| PUT | `/api/admin/hubs/{hubId}` | Update hub | Working |
| DELETE | `/api/admin/hubs/{hubId}` | Delete hub (soft delete by default) | Working |
| PUT | `/api/admin/hubs/reorder` | Reorder hubs | Working |

### Admin Department Endpoints (Requires Admin Role)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/admin/departments` | Get all departments | Working |
| GET | `/api/admin/departments/{deptId}` | Get department by ID | Working |
| POST | `/api/admin/departments` | Create department | Working |
| PUT | `/api/admin/departments/{deptId}` | Update department | Working |
| DELETE | `/api/admin/departments/{deptId}` | Delete department (soft delete by default) | Working |

---

## Database Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `portal.User` | Main user record | UserId, Email, EntraObjectId, IsActive, IsLockedOut, IsExpired |
| `portal.UserProfile` | Profile data | UserProfileId, UserId, AvatarId |
| `portal.UserPreference` | User preferences | UserPreferenceId, UserId, ThemeId |
| `portal.Role` | Role definitions | RoleId, RoleName |
| `portal.UserRole` | User-role mappings | UserId, RoleId |
| `portal.Department` | Organizational departments | DepartmentId, DepartmentCode, DepartmentName |
| `portal.UserDepartment` | User-department mappings | UserId, DepartmentId, GrantedAt |

**Note**: Table names are singular (UserProfile, not UserProfiles). The DbSet properties in code use plural names but map to singular table names.

### User Account Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `IsActive` | bit | User can log in (false when locked) |
| `IsLockedOut` | bit | Account is locked by admin |
| `LockedOutAt` | datetime | When lock was applied |
| `LockoutReason` | nvarchar | Why account was locked |
| `IsExpired` | bit | Account is expired (supersedes IsActive) |
| `ExpiredAt` | datetime | When expiration was applied |
| `ExpirationReason` | nvarchar | Why account was expired (includes ticket #) |
| `ExpiredBy` | int | Admin who expired the account |

---

## Next Steps for API Integration

When implementing new features, follow this pattern:

1. **Backend First**: Create the endpoint and test with Swagger/curl
2. **Add to Angular Service**: Create methods that call the API
3. **Wire Up Components**: Connect UI to the service methods
4. **Test End-to-End**: Verify data flows from UI → API → Database → API → UI

---

## Angular Frontend Integration Files

| File | Purpose |
|------|---------|
| `hub.service.ts` | Dashboard hub API calls (permission-based access) |
| `admin-user.service.ts` | Admin user management API calls |
| `admin.component.ts` | User Management UI (uses AdminUserService) |
| `dashboard.component.ts` | Dashboard UI (uses HubService for real API) |
| `auth.interceptor.ts` | Adds JWT token to API requests |
| `auth.service.ts` | Authentication and token management |

### HubService Methods (Dashboard)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getAccessibleHubs()` | GET `/api/hubs` | Get hubs user has access to |

### AdminUserService Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getAllUsers(...)` | GET `/api/admin/users` | Paginated user list with counts |
| `lockUser(userId, reason?)` | PUT `/api/admin/users/{id}/lock` | Lock user account |
| `unlockUser(userId)` | PUT `/api/admin/users/{id}/unlock` | Unlock user account |
| `expireUser(userId, reason?)` | PUT `/api/admin/users/{id}/expire` | Expire user account |
| `restoreUser(userId)` | PUT `/api/admin/users/{id}/restore` | Restore expired account |
| `getAllDepartments()` | GET `/api/admin/departments` | Get all departments |
| `getUserDepartments(userId)` | GET `/api/admin/users/{id}/departments` | Get user's departments |
| `assignUserToDepartment(...)` | POST `/api/admin/users/{id}/departments` | Assign to department |
| `removeUserFromDepartment(...)` | DELETE `/api/admin/users/{id}/departments/{deptId}` | Remove from department |
| `updateUserAdminRole(userId, isAdmin)` | PUT `/api/admin/users/{id}/roles/admin` | Grant/revoke admin role |
| `getUserPermissions(userId)` | GET `/api/admin/users/{id}/permissions` | Get hub/report permissions |
| `getHubsWithReports()` | GET `/api/admin/hubs/with-reports` | Get hubs with reports for permission UI |
| `grantHubAccess(userId, hubId)` | POST `/api/admin/users/{id}/permissions/hub` | Grant hub access |
| `revokeHubAccess(userId, hubId)` | DELETE `/api/admin/users/{id}/permissions/hub/{hubId}` | Revoke hub access |
| `grantReportAccess(userId, reportId)` | POST `/api/admin/users/{id}/permissions/report` | Grant report access |
| `revokeReportAccess(userId, reportId)` | DELETE `/api/admin/users/{id}/permissions/report/{reportId}` | Revoke report access |

---

## AdminUserDto Fields

The `AdminUserDto` returned by `GET /api/admin/users` includes:

| Field | Type | Description |
|-------|------|-------------|
| `userId` | int | User's ID |
| `email` | string | User's email |
| `firstName`, `lastName` | string | User's name |
| `displayName` | string | Combined first + last name |
| `company` | string | Company name |
| `roles` | string[] | Array of role names (e.g., ["Admin", "User"]) |
| `isActive` | bool | Account is active |
| `isExpired` | bool | Account is expired |
| `isLockedOut` | bool | Account is locked |
| `departmentCount` | int | Number of departments user belongs to |
| `hubCount` | int | Number of ad-hoc hub permissions (non-expired) |
| `reportCount` | int | Number of ad-hoc report permissions (non-expired) |
| `lastLoginAt` | DateTime? | Last login timestamp |
| `loginCount` | int | Total login count |
| `createdAt` | DateTime | Account creation date |

**Backend Implementation Note**: To include counts, the `UserRepository.GetAllAsync` method must include related entities:

```csharp
var query = _context.Users
    .Include(u => u.Company)
    .Include(u => u.UserRoles)
        .ThenInclude(ur => ur.Role)
    .Include(u => u.UserDepartments)  // Required for departmentCount
    .Include(u => u.HubAccess)        // Required for hubCount
    .Include(u => u.ReportAccess)     // Required for reportCount
    .AsQueryable();
```

Then in the controller:
```csharp
DepartmentCount = u.UserDepartments?.Count ?? 0,
HubCount = u.HubAccess?.Count(ha => ha.ExpiresAt == null || ha.ExpiresAt > DateTime.UtcNow) ?? 0,
ReportCount = u.ReportAccess?.Count(ra => ra.ExpiresAt == null || ra.ExpiresAt > DateTime.UtcNow) ?? 0
```

---

## Permission Model

The application uses a dual permission model:

```
┌────────────────────────────────────────────────────────────┐
│ ADMIN BYPASS                                                │
│ Admin role → All hubs and reports                          │
├────────────────────────────────────────────────────────────┤
│ DEPARTMENT-BASED ACCESS                                     │
│ User → UserDepartment → ReportDepartment → Report → Hub    │
├────────────────────────────────────────────────────────────┤
│ AD-HOC HUB ACCESS                                           │
│ User → UserHubAccess → Hub (all reports in hub)            │
├────────────────────────────────────────────────────────────┤
│ AD-HOC REPORT ACCESS                                        │
│ User → UserReportAccess → Report → Hub                     │
└────────────────────────────────────────────────────────────┘
```

**Access Resolution**: User can see a hub if ANY of the following are true:
1. User has **Admin** role
2. User has **UserHubAccess** to that hub
3. User has **UserReportAccess** to any report in that hub
4. User's department (**UserDepartment**) is tagged on any report (**ReportDepartment**) in that hub

---

---

## Hub DTO Fields

The `HubDto` returned by hub endpoints includes:

| Field | Type | Description |
|-------|------|-------------|
| `hubId` | int | Hub's unique ID |
| `hubCode` | string | Unique code for the hub (e.g., "sequoia") |
| `hubName` | string | Display name |
| `description` | string? | Hub description |
| `iconName` | string? | Carbon icon name (e.g., "folder", "document", "chart--bar") |
| `colorClass` | string? | CSS color class for styling (e.g., "hub-sequoia", "hub-corevest") |
| `backgroundImage` | string? | URL to background image |
| `sortOrder` | int | Display order |
| `isActive` | bool | Whether hub is active |
| `reportGroupCount` | int | Number of report groups in hub |
| `reportCount` | int | Total number of reports in hub |
| `createdAt` | DateTime | Creation timestamp |
| `createdByEmail` | string? | Email of user who created the hub |

**ColorClass Note**: The `colorClass` field stores the CSS class used for hub card styling in the frontend. If not set, the frontend derives a color from the `hubCode`. Available color classes:
- `hub-sequoia` - Green theme
- `hub-corevest` - Orange theme
- `hub-enterprise` - Blue theme
- `hub-aspire` - Purple theme

---

*Last Updated: January 2026*
*Based on learnings from user profile/avatar, user management, hub permissions, hub/department CRUD, and circular dependency fix implementations*
