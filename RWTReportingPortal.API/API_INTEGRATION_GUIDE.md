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

The interceptor automatically adds the JWT token to requests going to the API:
```typescript
if (request.url.startsWith(this.API_BASE)) {
  const token = this.authService.getCurrentToken();
  if (token?.accessToken) {
    request = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token.accessToken}`
      }
    });
  }
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

### Issue 4: Data Saved But Not Fetched on Login
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

### Issue 5: CORS Errors
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

---

## Database Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `portal.User` | Main user record | UserId, Email, EntraObjectId |
| `portal.UserProfile` | Profile data | UserProfileId, UserId, AvatarId |
| `portal.UserPreference` | User preferences | UserPreferenceId, UserId, ThemeId |

**Note**: Table names are singular (UserProfile, not UserProfiles). The DbSet properties in code use plural names but map to singular table names.

---

## Next Steps for API Integration

When implementing new features, follow this pattern:

1. **Backend First**: Create the endpoint and test with Swagger/curl
2. **Add to Angular Service**: Create methods that call the API
3. **Wire Up Components**: Connect UI to the service methods
4. **Test End-to-End**: Verify data flows from UI → API → Database → API → UI

---

*Last Updated: January 2026*
*Based on learnings from user profile/avatar implementation*
