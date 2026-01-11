# Backend Implementation Guide

This document outlines the backend implementation tasks required to connect the RWT Reporting Portal to a .NET backend and SQL Server database.

---

## Quick Start (Handoff Guide)

### What's Already Done

| Component | Status | Location |
|-----------|--------|----------|
| **Angular Frontend** | 100% Complete | `/rwt-reporting-portal/` |
| **Database Schema** | Documented | `DATABASE_TABLES.md` - T-SQL CREATE scripts |
| **Stored Procedures** | Documented | `DATABASE_STORED_PROCEDURES.md` - All SPs |
| **Seed Data** | Documented | `DATABASE_SEED_DATA.md` - Initial data scripts |
| **API Specification** | Documented | `API_DOCUMENTATION.md` - Full endpoint specs |
| **.NET API Project** | Scaffold Complete | `/RWTReportingPortal.API/` |

### Getting Started Steps

1. **Install Prerequisites**
   - .NET 8 SDK
   - SQL Server (local or remote)
   - Visual Studio 2022 or VS Code with C# extension

2. **Set Up Database**
   ```bash
   # Run scripts in this order from DATABASE_TABLES.md:
   1. Create database
   2. Run all CREATE TABLE scripts
   3. Run scripts from DATABASE_SEED_DATA.md
   4. Run scripts from DATABASE_STORED_PROCEDURES.md
   ```

3. **Configure .NET Project**
   ```bash
   cd /RWTReportingPortal.API
   dotnet restore

   # Edit appsettings.json with your values:
   # - ConnectionStrings:DefaultConnection
   # - AzureAd:TenantId, ClientId, ClientSecret
   # - Jwt:SecretKey (min 32 characters)
   ```

4. **Register App in Entra**
   - Follow steps in "Entra Configuration" section of `API_DOCUMENTATION.md`
   - Create security groups: `RWT-ReportingPortal-Access`, `RWT-ReportingPortal-Admins`

5. **Run the API**
   ```bash
   dotnet run
   # API runs on https://localhost:5001
   # Swagger UI at https://localhost:5001/swagger
   ```

6. **Connect Angular Frontend**
   ```bash
   cd /rwt-reporting-portal
   # Update environment.ts with API URL
   ng serve
   ```

### What's Implemented

The .NET project has:
- ✅ Complete project structure
- ✅ All entity models
- ✅ All DTOs
- ✅ All controllers with endpoints
- ✅ Service interfaces
- ✅ `AuthService` - SSO callback, ROPC password login, JWT token generation (WORKING)
- ✅ `UserService` - User lookup, profile updates, avatar, preferences, theme persistence (WORKING)
- ✅ `AdminUserService` - User list, lock/unlock, expire/restore, department assignments, admin role management (WORKING)
- ✅ `DepartmentService` - Department CRUD, user-department mappings (WORKING)
- ✅ `PermissionService` - Admin role grant/revoke, department-based access (WORKING)
- ⚠️ `HubService` / `ReportService` - Core data retrieval (stub - needs implementation)
- ⚠️ `FavoritesService` - Quick access/pinned reports (stub - needs implementation)
- ⚠️ Power BI embed token generation (stub - needs implementation)

**Priority for remaining implementation:**
1. `HubService` / `ReportService` - Connect content management to real data
2. `FavoritesService` - Connect My Dashboard to real data
3. Power BI/SSRS integration for report embedding

---

## Configuration Summary

| Setting | Value |
|---------|-------|
| **Database** | On-premises MS SQL Server |
| **Authentication** | Entra SSO (primary) + Entra password fallback |
| **SSO Provider** | Microsoft Entra ID (Azure AD) |
| **Reporting Platforms** | Power BI + SSRS |
| **Companies** | Multi-company (Redwood Trust, CoreVest) |
| **User Provisioning** | JIT with Entra security group restriction |
| **Access Model** | Granular (Hub → Report Group → Report level) |

### Authentication Methods

| Method | Flow | When Used |
|--------|------|-----------|
| **SSO (Primary)** | OIDC redirect to Entra | Default login experience |
| **Password (Fallback)** | ROPC - validate credentials against Entra | When SSO redirect fails |

**Important:** Passwords are **NOT stored locally**. The fallback login form sends credentials to Entra for validation via the ROPC (Resource Owner Password Credentials) flow. This provides a backup when:
- SSO redirect encounters network issues
- Browser blocks third-party redirects
- User is on a restricted network
- Mobile/embedded browser limitations

---

## Access Control Model

### Dual Permission Model

The application uses a **dual permission model** combining:
1. **Department-based access** - Users belong to departments; reports are tagged with departments
2. **Ad-hoc access** - Individual permissions granted per user

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPARTMENT-BASED ACCESS                       │
│  User → Department → Report (via department tags)               │
│  e.g., Finance user → Finance dept → All Finance-tagged reports │
├─────────────────────────────────────────────────────────────────┤
│                      AD-HOC ACCESS                               │
│  User → Hub/Group/Report (direct permission)                    │
│  For one-off access outside department scope                    │
├─────────────────────────────────────────────────────────────────┤
│                      ADMIN BYPASS                                │
│  Admin role → All reports                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Departments (Organizational Groups)

| Department | Description |
|------------|-------------|
| Admin | System administrators |
| IT | Information Technology |
| Treasury | Treasury and cash management |
| Finance | Financial planning and analysis |
| Accounting | General accounting |
| Enterprise | Enterprise-wide access |
| Lending | Loan origination and servicing |
| Operations | Business operations |
| Compliance | Regulatory compliance |
| HR | Human resources |
| Executive | Executive leadership |

### Permission Resolution Logic

```
1. Check if user has ADMIN role → Allow all
2. Check if user's DEPARTMENT has access to report → Allow
3. Check if user has HUB-level access → Allow all reports in hub
4. Check if user has REPORT-GROUP-level access → Allow all reports in group
5. Check if user has REPORT-level access → Allow specific report
6. Deny access
```

### Access Scenarios

| Scenario | Permission Method |
|----------|------------------|
| User sees all reports tagged for their department | Assign user to department |
| User needs access to reports outside their department | Grant ad-hoc hub/group/report access |
| New employee in Finance | Add to Finance department |
| Cross-functional access | Add to multiple departments |
| Admin sees everything | Admin role (bypasses all checks) |

---

## Implementation To-Do List

### Phase 1: Database Schema Design ✅ DOCUMENTED

> **Status**: All T-SQL CREATE scripts documented in `DATABASE_TABLES.md`

- [x] **1.1 Create User Tables**
  - [x] `Users` - Core user account (synced from Entra)
  - [x] `UserProfiles` - Extended profile data (avatar, display name)
  - [x] `UserPreferences` - User-specific settings (theme, table row size)

- [x] **1.2 Create Authentication Tables**
  - [x] `UserSessions` - Active session tracking
  - [x] `RefreshTokens` - JWT refresh token storage
  - [x] `LoginHistory` - Login audit trail (last login, login count)

- [x] **1.3 Create Authorization Tables**
  - [x] `Roles` - Role definitions (Admin, User)
  - [x] `UserRoles` - User-to-role mapping

- [x] **1.4 Create Access Control Tables**
  - [x] `UserHubAccess` - Hub-level permissions
  - [x] `UserReportGroupAccess` - Report-group-level permissions
  - [x] `UserReportAccess` - Individual report-level permissions
  - [x] `Departments` - Organizational departments
  - [x] `UserDepartments` - User-to-department mapping
  - [x] `ReportDepartments` - Report-to-department access tags

- [x] **1.5 Create Reporting Tables**
  - [x] `Companies` - Company definitions (Redwood Trust, CoreVest)
  - [x] `ReportingHubs` - Hub definitions
  - [x] `ReportGroups` - Sub-categories within hubs
  - [x] `Reports` - Report metadata (Power BI / SSRS)
  - [x] `UserFavorites` - Pinned/quick access reports

- [x] **1.6 Create Audit Tables**
  - [x] `AuditLog` - General activity logging
  - [x] `ReportAccessLog` - Report view tracking

---

### Phase 2: .NET API Development ✅ SCAFFOLDED

> **Status**: All controllers and endpoints scaffolded in `/RWTReportingPortal.API/`
> Service implementations are stubs - need actual business logic.

- [x] **2.1 Authentication Endpoints (Entra)** - `AuthController.cs`
  - [x] `GET /api/auth/login` - Redirect to Entra SSO login (primary)
  - [x] `GET /api/auth/callback` - Handle Entra SSO callback, JIT provision user
  - [x] `POST /api/auth/login` - Password fallback (validates against Entra via ROPC)
  - [x] `POST /api/auth/logout` - Session termination
  - [x] `POST /api/auth/refresh` - Token refresh
  - [x] `GET /api/auth/me` - Get current user with permissions

- [x] **2.2 User Profile Endpoints** - `UsersController.cs`
  - [x] `GET /api/users/profile` - Get user profile
  - [x] `PUT /api/users/profile/avatar` - Update avatar
  - [x] `GET /api/users/preferences` - Get user preferences
  - [x] `PUT /api/users/preferences` - Update preferences (theme, etc.)

- [x] **2.3 Reporting Hub Endpoints** - `HubsController.cs`
  - [x] `GET /api/hubs` - List accessible hubs (filtered by permissions)
  - [x] `GET /api/hubs/{hubId}` - Get hub details
  - [x] `GET /api/hubs/{hubId}/groups` - List report groups in hub
  - [x] `GET /api/hubs/{hubId}/reports` - List all accessible reports in hub

- [x] **2.4 Report Group Endpoints** - `ReportGroupsController.cs`
  - [x] `GET /api/groups/{groupId}` - Get report group details
  - [x] `GET /api/groups/{groupId}/reports` - List reports in group

- [x] **2.5 Reports Endpoints** - `ReportsController.cs`
  - [x] `GET /api/reports/{reportId}` - Get report details
  - [x] `GET /api/reports/{reportId}/embed` - Get embed URL (Power BI/SSRS)
  - [x] `POST /api/reports/{reportId}/access` - Log report access

- [x] **2.6 Favorites/Quick Access Endpoints** - `FavoritesController.cs`
  - [x] `GET /api/favorites` - Get user's pinned reports
  - [x] `POST /api/favorites/{reportId}` - Pin a report
  - [x] `DELETE /api/favorites/{reportId}` - Unpin a report
  - [x] `PUT /api/favorites/reorder` - Reorder favorites

- [x] **2.7 Admin Endpoints** - `Admin/*Controller.cs`
  - [x] `GET /api/admin/users` - List all users
  - [x] `GET /api/admin/users/{userId}` - Get user details with permissions
  - [x] `PUT /api/admin/users/{userId}/status` - Activate/deactivate user
  - [x] `GET /api/admin/users/{userId}/permissions` - Get user's permissions
  - [x] `POST /api/admin/users/{userId}/permissions/hub` - Grant hub access
  - [x] `POST /api/admin/users/{userId}/permissions/group` - Grant group access
  - [x] `POST /api/admin/users/{userId}/permissions/report` - Grant report access
  - [x] `DELETE /api/admin/users/{userId}/permissions/{permissionId}` - Revoke permission
  - [x] `GET /api/admin/audit-log` - View audit logs
  - [x] `GET /api/admin/hubs` - Manage hubs
  - [x] `GET /api/admin/groups` - Manage report groups
  - [x] `GET /api/admin/reports` - Manage reports

- [x] **2.8 Department Endpoints** - `Admin/AdminDepartmentsController.cs`
  - [x] `GET /api/admin/departments` - List all departments
  - [x] `POST /api/admin/departments` - Create department
  - [x] `PUT /api/admin/departments/{id}` - Update department
  - [x] `DELETE /api/admin/departments/{id}` - Delete department
  - [x] `GET /api/admin/departments/{id}/users` - Get department users
  - [x] `GET /api/admin/departments/{id}/reports` - Get department reports

---

### Phase 3: Data to Persist

#### 3.1 User Data (from Entra + Local)

| Field | Source | Storage |
|-------|--------|---------|
| `EntraObjectId` | Entra (immutable) | `Users.EntraObjectId` |
| `Email` | Entra | `Users.Email` |
| `FirstName` | Entra | `Users.FirstName` |
| `LastName` | Entra | `Users.LastName` |
| `DisplayName` | Entra (can override) | `UserProfiles.DisplayName` |
| `EntraGroups` | Entra | `Users.EntraGroups` (JSON) |
| `Company` | Derived from Entra groups | `Users.CompanyId` |
| `AvatarId` | User selection | `UserProfiles.AvatarId` |
| `IsActive` | Admin controlled | `Users.IsActive` |
| `CreatedAt` | Auto (first login) | `Users.CreatedAt` |
| `LastLoginAt` | Auto | `Users.LastLoginAt` |
| `LoginCount` | Auto | `Users.LoginCount` |

#### 3.2 User Preferences

| Field | Description | Storage |
|-------|-------------|---------|
| `ThemeId` | Selected theme | `UserPreferences.ThemeId` |
| `TableRowSize` | Table density (xs/sm/md/lg) | `UserPreferences.TableRowSize` |

#### 3.3 Access Permissions

| Level | Table | Fields |
|-------|-------|--------|
| Hub | `UserHubAccess` | `UserId`, `HubId`, `GrantedBy`, `GrantedAt` |
| Report Group | `UserReportGroupAccess` | `UserId`, `ReportGroupId`, `GrantedBy`, `GrantedAt` |
| Report | `UserReportAccess` | `UserId`, `ReportId`, `GrantedBy`, `GrantedAt` |

#### 3.4 Favorites

| Field | Description | Storage |
|-------|-------------|---------|
| `UserId` | User who pinned | `UserFavorites.UserId` |
| `ReportId` | Pinned report | `UserFavorites.ReportId` |
| `SortOrder` | Display order | `UserFavorites.SortOrder` |
| `PinnedAt` | Timestamp | `UserFavorites.CreatedAt` |

---

### Phase 4: Security Implementation ✅ SCAFFOLDED

> **Status**: Infrastructure scaffolded in `/RWTReportingPortal.API/Infrastructure/`
> Entra app registration and runtime configuration required.

- [x] **4.1 Entra Integration** - `Infrastructure/Auth/EntraAuthService.cs`
  - [ ] Register application in Entra (runtime task)
  - [ ] Configure redirect URIs (runtime task)
  - [ ] Set up required permissions (User.Read, GroupMember.Read.All)
  - [ ] Enable "Allow public client flows" for ROPC fallback
  - [x] Implement OIDC authentication flow (SSO primary)
  - [x] Implement ROPC authentication flow (password fallback)
  - [ ] Extract user info and groups from token (stub - needs Graph API)

- [x] **4.2 JIT User Provisioning** - In `AuthService`
  - [x] Check if user's Entra group is in allowed list (stub)
  - [x] Create user record on first login (stub)
  - [x] Sync user info from Entra token (stub)
  - [x] Derive company from Entra group membership (stub)
  - [x] Set default preferences (stub)

- [x] **4.3 JWT Token Management** - `Infrastructure/Auth/JwtTokenService.cs`
  - [x] Generate access token (15 min expiry)
  - [x] Generate refresh token (7 day expiry)
  - [x] Implement token refresh endpoint
  - [x] Store refresh tokens securely (hashed) - stub
  - [x] Implement token revocation on logout - stub

- [x] **4.4 Authorization Middleware** - `Infrastructure/Middleware/`
  - [x] Create permission-checking middleware (stub)
  - [x] Implement hub access check (stub)
  - [x] Implement report group access check (stub)
  - [x] Implement report access check (stub)
  - [x] Admin role bypass (via policy)

- [x] **4.5 Security Best Practices** - `Program.cs`
  - [x] HTTPS enforcement (configured)
  - [x] CORS configuration (allowed origins)
  - [ ] Rate limiting on auth endpoints (not yet added)
  - [x] SQL injection prevention (parameterized queries/EF Core)
  - [x] Audit logging for sensitive operations (stub)

---

### Phase 5: Integration Points ✅ SCAFFOLDED

> **Status**: Service stubs created. Runtime configuration and Azure setup required.

- [x] **5.1 Power BI Integration** - `Services/Implementations/PowerBIService.cs`
  - [ ] Register app in Azure for Power BI API (runtime task)
  - [ ] Configure Power BI Embedded capacity (runtime task)
  - [x] Implement embed token generation (stub)
  - [x] Handle report/dashboard embedding (stub)
  - [ ] Implement row-level security (RLS) if needed

- [x] **5.2 SSRS Integration** - `Services/Implementations/SSRSService.cs`
  - [ ] Configure SSRS report server URL (appsettings)
  - [ ] Set up service account for SSRS access (runtime task)
  - [x] Implement report URL generation with parameters
  - [ ] Handle SSRS authentication (Windows/Forms)
  - [ ] Configure report rendering options

- [ ] **5.3 Entra Security Groups** (runtime task)
  - [ ] Create security group: `RWT-ReportingPortal-Access` (required for login)
  - [ ] Create security group: `RWT-ReportingPortal-Admins` (admin role)
  - [ ] Optional: Company groups for auto-assignment

---

### Phase 6: Stored Procedures ✅ DOCUMENTED

> **Status**: All stored procedures documented in `DATABASE_STORED_PROCEDURES.md`
> Ready to run on SQL Server after tables are created.

- [x] **6.1 User Procedures**
  - [x] `usp_User_GetByEntraId` - Get user by Entra Object ID
  - [x] `usp_User_CreateFromEntra` - JIT create user
  - [x] `usp_User_UpdateLastLogin` - Update login timestamp
  - [x] `usp_User_RecordFailedLogin` - Record failed login attempt
  - [x] `usp_User_Unlock` - Unlock a locked user account
  - [x] `usp_User_Deactivate` - Temporarily deactivate user
  - [x] `usp_User_Activate` - Reactivate a deactivated user
  - [x] `usp_User_Expire` - Expire user account (preserves data)
  - [x] `usp_User_Restore` - Restore an expired user account
  - [x] `usp_User_GetAll` - Admin: list all users
  - [x] `usp_UserProfile_Update` - Update avatar/display name
  - [x] `usp_UserPreferences_Upsert` - Update/insert preferences

- [x] **6.2 Session Procedures**
  - [x] `usp_Session_Create` - Create new session
  - [x] `usp_Session_Validate` - Validate session
  - [x] `usp_Session_End` - End session
  - [x] `usp_RefreshToken_Store` - Store refresh token
  - [x] `usp_RefreshToken_Validate` - Validate and rotate refresh token
  - [x] `usp_RefreshToken_Revoke` - Revoke refresh token

- [x] **6.3 Permission Procedures**
  - [x] `usp_Permissions_GetByUserId` - Get all user permissions
  - [x] `usp_Permissions_CheckHubAccess` - Check hub access
  - [x] `usp_Permissions_CheckGroupAccess` - Check report group access
  - [x] `usp_Permissions_CheckReportAccess` - Check report access
  - [x] `usp_Permissions_GrantHub` - Grant hub access
  - [x] `usp_Permissions_GrantGroup` - Grant group access
  - [x] `usp_Permissions_GrantReport` - Grant report access
  - [x] `usp_Permissions_Revoke` - Revoke any permission

- [x] **6.4 Reporting Procedures**
  - [x] `usp_Hubs_GetAccessible` - Get hubs user can access
  - [x] `usp_ReportGroups_GetByHubId` - Get groups in hub
  - [x] `usp_Reports_GetAccessible` - Get reports user can access
  - [x] `usp_Reports_GetByGroupId` - Get reports in group
  - [x] `usp_Favorites_GetByUserId` - Get user favorites
  - [x] `usp_Favorites_Add` - Add favorite
  - [x] `usp_Favorites_Remove` - Remove favorite
  - [x] `usp_Favorites_Reorder` - Update sort order

- [x] **6.5 Audit Procedures**
  - [x] `usp_AuditLog_Insert` - Log activity
  - [x] `usp_LoginHistory_Insert` - Log login
  - [x] `usp_ReportAccess_Log` - Log report view
  - [x] `usp_AuditLog_Search` - Admin: search audit logs

- [x] **6.6 Department Procedures**
  - [x] `usp_Department_GetAll` - List all departments
  - [x] `usp_Department_GetById` - Get department by ID
  - [x] `usp_Department_Create` - Create department
  - [x] `usp_Department_Update` - Update department
  - [x] `usp_Department_Delete` - Delete department
  - [x] `usp_Department_GetUsers` - Get users in department
  - [x] `usp_Department_GetReports` - Get reports tagged with department
  - [x] `usp_UserDepartment_Assign` - Assign user to department
  - [x] `usp_UserDepartment_Remove` - Remove user from department
  - [x] `usp_ReportDepartment_Add` - Tag report with department
  - [x] `usp_ReportDepartment_Remove` - Remove department tag from report

---

### Phase 7: Report Catalog Management ✅ MOSTLY COMPLETE

> **Status**: Angular UI 100% complete. API endpoints scaffolded. Stored procedures documented.

- [x] **7.1 Hub Admin Endpoints** - `Admin/AdminHubsController.cs`
  - [x] `GET /api/admin/hubs` - List all hubs with counts
  - [x] `POST /api/admin/hubs` - Create new hub
  - [x] `PUT /api/admin/hubs/{hubId}` - Update hub
  - [x] `DELETE /api/admin/hubs/{hubId}` - Soft/hard delete hub
  - [x] `PUT /api/admin/hubs/reorder` - Reorder hubs

- [x] **7.2 Report Group Admin Endpoints** - `Admin/AdminReportGroupsController.cs`
  - [x] `GET /api/admin/groups` - List groups (filter by hub)
  - [x] `POST /api/admin/groups` - Create new group
  - [x] `PUT /api/admin/groups/{groupId}` - Update group
  - [x] `DELETE /api/admin/groups/{groupId}` - Soft/hard delete group
  - [x] `PUT /api/admin/groups/{groupId}/move` - Move to different hub
  - [x] `PUT /api/admin/groups/reorder` - Reorder groups in hub

- [x] **7.3 Report Admin Endpoints** - `Admin/AdminReportsController.cs`
  - [x] `GET /api/admin/reports` - List reports with filtering
  - [x] `POST /api/admin/reports` - Create new report
  - [x] `PUT /api/admin/reports/{reportId}` - Update report
  - [x] `DELETE /api/admin/reports/{reportId}` - Soft/hard delete report
  - [x] `PUT /api/admin/reports/{reportId}/move` - Move to different group
  - [x] `PUT /api/admin/reports/reorder` - Reorder reports in group
  - [ ] `POST /api/admin/reports/bulk-import` - Bulk import reports (not scaffolded)

- [x] **7.4 Power BI Discovery** - Partial
  - [ ] Register service principal in Azure for Power BI API (runtime task)
  - [ ] Configure service principal access to Power BI workspaces (runtime task)
  - [x] `GET /api/admin/powerbi/workspaces` - List accessible workspaces (stub)
  - [x] `GET /api/admin/powerbi/workspaces/{id}/reports` - List reports in workspace (stub)
  - [ ] `POST /api/admin/powerbi/import` - Import selected reports (not scaffolded)

- [x] **7.5 Hub/Group/Report Stored Procedures** - `DATABASE_STORED_PROCEDURES.md`
  - [x] Hub CRUD procedures (`usp_Hub_*`)
  - [x] Report Group CRUD procedures (`usp_ReportGroup_*`)
  - [x] Report CRUD procedures (`usp_Report_*`)
  - [ ] Bulk import procedure (`usp_Report_BulkImport`) (not documented)

- [x] **7.6 Angular Admin UI** - 100% Complete
  - [x] Content management landing page (`/admin/content`)
  - [x] Hub management component (list, create/edit modal)
  - [x] Report group management component
  - [x] Report management component (with department access)
  - [x] Department management component
  - [ ] Power BI import wizard component (not implemented)

---

## Audit Requirements

### User Audit Fields

| Field | Description |
|-------|-------------|
| `CreatedAt` | When user first logged in (JIT provisioned) |
| `LastLoginAt` | Most recent login timestamp |
| `LoginCount` | Total number of logins |
| `IsActive` | Account active/inactive status |
| `DeactivatedAt` | When account was deactivated |
| `DeactivatedBy` | Admin who deactivated |
| `IsExpired` | Account expired status (preserved but cannot login) |
| `ExpiredAt` | When account was expired |
| `ExpiredBy` | Admin who expired the account |
| `ExpirationReason` | Reason for expiration |
| `EntraGroups` | Current Entra group memberships |
| `Company` | Assigned company |

### Audit Log Events

| Event | Data Captured |
|-------|---------------|
| `USER_LOGIN` | UserId, IP, UserAgent, Timestamp |
| `USER_LOGOUT` | UserId, Timestamp |
| `PERMISSION_GRANTED` | UserId, PermissionType, TargetId, GrantedBy |
| `PERMISSION_REVOKED` | UserId, PermissionType, TargetId, RevokedBy |
| `USER_DEACTIVATED` | UserId, DeactivatedBy, Reason |
| `USER_ACTIVATED` | UserId, ActivatedBy |
| `USER_EXPIRED` | UserId, ExpiredBy, Reason |
| `USER_RESTORED` | UserId, RestoredBy |
| `PROFILE_UPDATED` | UserId, FieldsChanged |
| `REPORT_VIEWED` | UserId, ReportId, Timestamp |

---

## Next Steps (For Backend Developer)

### Completed Documentation
1. ✅ Configuration and access model documented
2. ✅ Database schema designed (`DATABASE_TABLES.md`)
3. ✅ T-SQL table creation scripts written
4. ✅ Stored procedures documented (`DATABASE_STORED_PROCEDURES.md`)
5. ✅ Seed data scripts written (`DATABASE_SEED_DATA.md`)
6. ✅ API endpoints specified (`API_DOCUMENTATION.md`)
7. ✅ .NET API project scaffolded (`/RWTReportingPortal.API/`)
8. ✅ Angular frontend 100% complete (`/rwt-reporting-portal/`)

### Remaining Implementation Tasks

#### Completed ✅
1. [x] **Set up SQL Server database**
   - Run CREATE TABLE scripts from `DATABASE_TABLES.md`
   - Run seed data from `DATABASE_SEED_DATA.md`
   - Run stored procedures from `DATABASE_STORED_PROCEDURES.md`

2. [x] **Configure Entra ID (Azure AD)**
   - Register application in Entra
   - Create security groups: `RWT-ReportingPortal-Access`, `RWT-ReportingPortal-Admins`
   - Configure redirect URIs
   - Enable public client flows for ROPC

3. [x] **Configure .NET project**
   - Update `appsettings.json` with connection string
   - Add Entra credentials (TenantId, ClientId, ClientSecret)
   - Set JWT secret key

4. [x] **Implement core service logic**
   - Authentication (SSO, ROPC password, JWT tokens)
   - User profile and preferences
   - User management (lock/unlock/expire/restore)
   - Department assignments
   - Admin role management

#### In Progress ⚠️
5. [ ] **Implement content services**
   - `HubService` - CRUD for reporting hubs
   - `ReportGroupService` - CRUD for report categories
   - `ReportService` - CRUD for reports, department tagging
   - `FavoritesService` - User quick access/pinned reports

6. [ ] **Configure Power BI Embedded** (if using Power BI)
   - Register service principal for Power BI API
   - Configure workspace access
   - Implement embed token generation

7. [ ] **Configure SSRS** (if using SSRS)
   - Set report server URL
   - Configure service account credentials

---

## Entra Security Groups to Create

| Group Name | Purpose |
|------------|---------|
| `RWT-ReportingPortal-Access` | Required for any user to log in |
| `RWT-ReportingPortal-Admins` | Grants admin role in application |
| `RWT-Company-RedwoodTrust` | (Optional) Auto-assign to Redwood Trust |
| `RWT-Company-CoreVest` | (Optional) Auto-assign to CoreVest |

