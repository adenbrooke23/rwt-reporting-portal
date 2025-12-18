# Database Stored Procedures - T-SQL Scripts

This file contains stored procedures for the RWT Reporting Portal database.

**Server:** DEVSQLGEN01
**Database:** REDWOOD_SOLUTIONS
**Schema:** portal

## Hybrid Approach

This project uses a **hybrid data access strategy**:

| Approach | Use For |
|----------|---------|
| **Stored Procedures** | Complex queries, multi-table transactions, permission logic, bulk operations |
| **Entity Framework Core** | Simple CRUD operations (create, read, update, delete single entities) |

### What EF Core Handles

The following are simple CRUD and should use EF Core in the .NET API:

- **User Profile/Preferences** - Update avatar, display name, theme, table row size
- **Sessions** - Create, end, cleanup expired sessions
- **Refresh Tokens** - Store, revoke tokens
- **Favorites** - Add, remove, reorder pinned reports
- **Announcements** - Full CRUD (create, read, update, delete, publish/unpublish)
- **Hub Admin** - Create, update, delete, reorder hubs
- **Report Group Admin** - Create, update, delete, move, reorder groups
- **Report Admin** - Create, update, delete, move, reorder reports
- **Department Admin** - Create, update, delete departments
- **User Departments** - Assign/remove users to/from departments
- **Report Departments** - Tag/untag reports with department access
- **User Admin** - Activate, deactivate, unlock, expire, restore users

### What Stored Procedures Handle

The following require stored procedures due to complexity:

| Category | Procedures | Reason |
|----------|------------|--------|
| User Provisioning | `usp_User_CreateFromEntra` | Multi-table transaction |
| Authentication | `usp_User_GetByEntraId`, `usp_User_UpdateLastLogin`, `usp_User_RecordFailedLogin` | Performance-critical, complex logic |
| Session Validation | `usp_Session_Validate` | Complex idle timeout + status checks |
| Permissions | 6 procedures | Complex permission hierarchy |
| Accessible Content | `usp_Hubs_GetAccessible`, `usp_Reports_GetAccessible` | Permission-filtered queries |
| Bulk Operations | `usp_Report_BulkImport` | Complex bulk insert with duplicate detection |
| Audit | `usp_AuditLog_Insert`, `usp_ReportAccess_Log` | Consistent audit format |
| Statistics | `usp_UserStats_GetDashboard` | Aggregation with permission checks |

**Total Stored Procedures: 17**

---

## 1. User Authentication Procedures

### 1.1 usp_User_GetByEntraId

Called during authentication to retrieve user with profile, preferences, and company info.

```sql
CREATE OR ALTER PROCEDURE portal.usp_User_GetByEntraId
    @EntraObjectId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId,
        u.EntraObjectId,
        u.Email,
        u.FirstName,
        u.LastName,
        u.CompanyId,
        c.CompanyCode,
        c.CompanyName,
        u.EntraGroups,
        u.IsActive,
        u.IsExpired,
        u.IsLockedOut,
        u.LockedOutAt,
        u.LockedOutUntil,
        u.LockoutReason,
        u.FailedLoginAttempts,
        u.LastLoginAt,
        u.LoginCount,
        u.CreatedAt,
        up.DisplayName,
        up.AvatarId,
        upr.ThemeId,
        upr.TableRowSize
    FROM portal.Users u
    LEFT JOIN portal.Companies c ON u.CompanyId = c.CompanyId
    LEFT JOIN portal.UserProfiles up ON u.UserId = up.UserId
    LEFT JOIN portal.UserPreferences upr ON u.UserId = upr.UserId
    WHERE u.EntraObjectId = @EntraObjectId
      AND u.IsExpired = 0;
END;
GO
```

### 1.2 usp_User_CreateFromEntra

JIT (Just-In-Time) user provisioning. Creates user, profile, preferences, and assigns default role in one transaction.

```sql
CREATE OR ALTER PROCEDURE portal.usp_User_CreateFromEntra
    @EntraObjectId NVARCHAR(50),
    @Email NVARCHAR(256),
    @FirstName NVARCHAR(100),
    @LastName NVARCHAR(100),
    @EntraGroups NVARCHAR(MAX),
    @CompanyCode NVARCHAR(50) = NULL,
    @DefaultTheme NVARCHAR(50) = 'white',
    @DefaultTableRowSize NVARCHAR(10) = 'md'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    DECLARE @CompanyId INT = NULL;

    -- Get company ID if provided
    IF @CompanyCode IS NOT NULL
    BEGIN
        SELECT @CompanyId = CompanyId FROM portal.Companies WHERE CompanyCode = @CompanyCode;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Insert user
        INSERT INTO portal.Users (EntraObjectId, Email, FirstName, LastName, CompanyId, EntraGroups, LastLoginAt, LoginCount)
        VALUES (@EntraObjectId, @Email, @FirstName, @LastName, @CompanyId, @EntraGroups, GETUTCDATE(), 1);

        SET @UserId = SCOPE_IDENTITY();

        -- Create profile
        INSERT INTO portal.UserProfiles (UserId, DisplayName)
        VALUES (@UserId, CONCAT(@FirstName, ' ', @LastName));

        -- Create preferences with defaults
        INSERT INTO portal.UserPreferences (UserId, ThemeId, TableRowSize)
        VALUES (@UserId, @DefaultTheme, @DefaultTableRowSize);

        -- Assign default User role
        DECLARE @UserRoleId INT = (SELECT RoleId FROM portal.Roles WHERE RoleName = 'User');
        INSERT INTO portal.UserRoles (UserId, RoleId)
        VALUES (@UserId, @UserRoleId);

        COMMIT TRANSACTION;

        -- Return the created user
        EXEC portal.usp_User_GetByEntraId @EntraObjectId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
```

### 1.3 usp_User_UpdateLastLogin

Updates login timestamp, increments count, resets failed attempts, and logs to LoginHistory.

```sql
CREATE OR ALTER PROCEDURE portal.usp_User_UpdateLastLogin
    @UserId INT,
    @IPAddress NVARCHAR(50) = NULL,
    @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Email NVARCHAR(256);
    SELECT @Email = Email FROM portal.Users WHERE UserId = @UserId;

    -- Update user login info
    UPDATE portal.Users
    SET LastLoginAt = GETUTCDATE(),
        LoginCount = LoginCount + 1,
        FailedLoginAttempts = 0,
        UpdatedAt = GETUTCDATE()
    WHERE UserId = @UserId;

    -- Log the login
    INSERT INTO portal.LoginHistory (UserId, UserEmail, LoginMethod, IPAddress, UserAgent, IsSuccess)
    VALUES (@UserId, @Email, 'SSO', @IPAddress, @UserAgent, 1);
END;
GO
```

### 1.4 usp_User_RecordFailedLogin

Records failed login attempt with automatic lockout after configured max attempts.

```sql
CREATE OR ALTER PROCEDURE portal.usp_User_RecordFailedLogin
    @EntraObjectId NVARCHAR(50) = NULL,
    @Email NVARCHAR(256) = NULL,
    @IPAddress NVARCHAR(50) = NULL,
    @UserAgent NVARCHAR(500) = NULL,
    @FailureReason NVARCHAR(200) = NULL,
    @LoginMethod NVARCHAR(20) = 'PASSWORD'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    DECLARE @FailedAttempts INT;
    DECLARE @MaxAttempts INT;
    DECLARE @LockoutMinutes INT;

    -- Get settings
    SELECT @MaxAttempts = CAST(SettingValue AS INT) FROM portal.AppSettings WHERE SettingKey = 'Security.MaxFailedLoginAttempts';
    SELECT @LockoutMinutes = CAST(SettingValue AS INT) FROM portal.AppSettings WHERE SettingKey = 'Security.LockoutDurationMinutes';

    -- Find user
    SELECT @UserId = UserId
    FROM portal.Users
    WHERE (EntraObjectId = @EntraObjectId OR Email = @Email)
      AND IsExpired = 0;

    IF @UserId IS NOT NULL
    BEGIN
        -- Increment failed attempts
        UPDATE portal.Users
        SET FailedLoginAttempts = FailedLoginAttempts + 1,
            LastFailedLoginAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
        WHERE UserId = @UserId;

        -- Check if should lock out
        SELECT @FailedAttempts = FailedLoginAttempts FROM portal.Users WHERE UserId = @UserId;

        IF @FailedAttempts >= @MaxAttempts
        BEGIN
            UPDATE portal.Users
            SET IsLockedOut = 1,
                LockedOutAt = GETUTCDATE(),
                LockedOutUntil = CASE WHEN @LockoutMinutes > 0 THEN DATEADD(MINUTE, @LockoutMinutes, GETUTCDATE()) ELSE NULL END,
                LockoutReason = 'Too many failed login attempts'
            WHERE UserId = @UserId;
        END
    END

    -- Log the failed attempt
    INSERT INTO portal.LoginHistory (UserId, UserEmail, LoginMethod, IPAddress, UserAgent, IsSuccess, FailureReason)
    VALUES (@UserId, @Email, @LoginMethod, @IPAddress, @UserAgent, 0, @FailureReason);
END;
GO
```

---

## 2. Session Validation

### 2.1 usp_Session_Validate

Validates session with idle timeout check and user status verification.

```sql
CREATE OR ALTER PROCEDURE portal.usp_Session_Validate
    @SessionId UNIQUEIDENTIFIER,
    @IdleTimeoutMinutes INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IsValid BIT = 0;
    DECLARE @UserId INT;
    DECLARE @LastActivity DATETIME2;

    SELECT
        @UserId = s.UserId,
        @LastActivity = s.LastActivityAt
    FROM portal.UserSessions s
    JOIN portal.Users u ON s.UserId = u.UserId
    WHERE s.SessionId = @SessionId
      AND s.RevokedAt IS NULL
      AND s.ExpiresAt > GETUTCDATE()
      AND u.IsActive = 1
      AND u.IsExpired = 0
      AND u.IsLockedOut = 0;

    IF @UserId IS NOT NULL
    BEGIN
        -- Check idle timeout
        IF DATEDIFF(MINUTE, @LastActivity, GETUTCDATE()) < @IdleTimeoutMinutes
        BEGIN
            SET @IsValid = 1;
            -- Update activity
            UPDATE portal.UserSessions SET LastActivityAt = GETUTCDATE() WHERE SessionId = @SessionId;
        END
        ELSE
        BEGIN
            -- Session timed out due to inactivity
            UPDATE portal.UserSessions SET RevokedAt = GETUTCDATE(), RevokedReason = 'IDLE' WHERE SessionId = @SessionId;
        END
    END

    SELECT @IsValid AS IsValid, @UserId AS UserId;
END;
GO
```

---

## 3. Permission Procedures

### 3.1 usp_Permissions_GetByUserId

Returns all permissions for a user across departments, hub, group, and report levels.

```sql
CREATE OR ALTER PROCEDURE portal.usp_Permissions_GetByUserId
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if admin (bypass all permission checks)
    DECLARE @IsAdmin BIT = 0;
    IF EXISTS (
        SELECT 1 FROM portal.UserRoles ur
        JOIN portal.Roles r ON ur.RoleId = r.RoleId
        WHERE ur.UserId = @UserId AND r.RoleName = 'Admin'
    )
    BEGIN
        SET @IsAdmin = 1;
    END

    SELECT @IsAdmin AS IsAdmin;

    -- Department memberships (grants access to reports tagged with these departments)
    SELECT
        'Department' AS PermissionLevel,
        ud.UserDepartmentId AS PermissionId,
        d.DepartmentId AS TargetId,
        d.DepartmentCode AS TargetCode,
        d.DepartmentName AS TargetName,
        NULL AS ParentName,
        ud.GrantedAt,
        NULL AS ExpiresAt,
        g.Email AS GrantedByEmail,
        (SELECT COUNT(*) FROM portal.ReportDepartments rd WHERE rd.DepartmentId = d.DepartmentId) AS ReportCount
    FROM portal.UserDepartments ud
    JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId
    LEFT JOIN portal.Users g ON ud.GrantedBy = g.UserId
    WHERE ud.UserId = @UserId
      AND d.IsActive = 1;

    -- Hub-level access
    SELECT
        'Hub' AS PermissionLevel,
        uha.UserHubAccessId AS PermissionId,
        h.HubId AS TargetId,
        h.HubCode AS TargetCode,
        h.HubName AS TargetName,
        NULL AS ParentName,
        uha.GrantedAt,
        uha.ExpiresAt,
        g.Email AS GrantedByEmail
    FROM portal.UserHubAccess uha
    JOIN portal.ReportingHubs h ON uha.HubId = h.HubId
    LEFT JOIN portal.Users g ON uha.GrantedBy = g.UserId
    WHERE uha.UserId = @UserId
      AND (uha.ExpiresAt IS NULL OR uha.ExpiresAt > GETUTCDATE());

    -- Report Group-level access
    SELECT
        'ReportGroup' AS PermissionLevel,
        urga.UserReportGroupAccessId AS PermissionId,
        rg.ReportGroupId AS TargetId,
        rg.GroupCode AS TargetCode,
        rg.GroupName AS TargetName,
        h.HubName AS ParentName,
        urga.GrantedAt,
        urga.ExpiresAt,
        g.Email AS GrantedByEmail
    FROM portal.UserReportGroupAccess urga
    JOIN portal.ReportGroups rg ON urga.ReportGroupId = rg.ReportGroupId
    JOIN portal.ReportingHubs h ON rg.HubId = h.HubId
    LEFT JOIN portal.Users g ON urga.GrantedBy = g.UserId
    WHERE urga.UserId = @UserId
      AND (urga.ExpiresAt IS NULL OR urga.ExpiresAt > GETUTCDATE());

    -- Report-level access (ad-hoc permissions)
    SELECT
        'Report' AS PermissionLevel,
        ura.UserReportAccessId AS PermissionId,
        r.ReportId AS TargetId,
        r.ReportCode AS TargetCode,
        r.ReportName AS TargetName,
        rg.GroupName AS ParentName,
        ura.GrantedAt,
        ura.ExpiresAt,
        g.Email AS GrantedByEmail
    FROM portal.UserReportAccess ura
    JOIN portal.Reports r ON ura.ReportId = r.ReportId
    JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId
    LEFT JOIN portal.Users g ON ura.GrantedBy = g.UserId
    WHERE ura.UserId = @UserId
      AND (ura.ExpiresAt IS NULL OR ura.ExpiresAt > GETUTCDATE());
END;
GO
```

### 3.2 usp_Permissions_CheckReportAccess

Checks if user has access to a specific report through any permission level (including department-based access).

```sql
CREATE OR ALTER PROCEDURE portal.usp_Permissions_CheckReportAccess
    @UserId INT,
    @ReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HasAccess BIT = 0;

    -- Check if admin
    IF EXISTS (
        SELECT 1 FROM portal.UserRoles ur
        JOIN portal.Roles r ON ur.RoleId = r.RoleId
        WHERE ur.UserId = @UserId AND r.RoleName = 'Admin'
    )
    BEGIN
        SET @HasAccess = 1;
    END
    -- Check department-based access (user's department has access to report)
    ELSE IF EXISTS (
        SELECT 1 FROM portal.UserDepartments ud
        JOIN portal.ReportDepartments rd ON ud.DepartmentId = rd.DepartmentId
        JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId
        WHERE ud.UserId = @UserId
          AND rd.ReportId = @ReportId
          AND d.IsActive = 1
    )
    BEGIN
        SET @HasAccess = 1;
    END
    -- Check report-level access (ad-hoc permission)
    ELSE IF EXISTS (
        SELECT 1 FROM portal.UserReportAccess
        WHERE UserId = @UserId AND ReportId = @ReportId
          AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())
    )
    BEGIN
        SET @HasAccess = 1;
    END
    -- Check report-group-level access
    ELSE IF EXISTS (
        SELECT 1 FROM portal.UserReportGroupAccess urga
        JOIN portal.Reports r ON urga.ReportGroupId = r.ReportGroupId
        WHERE urga.UserId = @UserId AND r.ReportId = @ReportId
          AND (urga.ExpiresAt IS NULL OR urga.ExpiresAt > GETUTCDATE())
    )
    BEGIN
        SET @HasAccess = 1;
    END
    -- Check hub-level access
    ELSE IF EXISTS (
        SELECT 1 FROM portal.UserHubAccess uha
        JOIN portal.ReportGroups rg ON uha.HubId = rg.HubId
        JOIN portal.Reports r ON rg.ReportGroupId = r.ReportGroupId
        WHERE uha.UserId = @UserId AND r.ReportId = @ReportId
          AND (uha.ExpiresAt IS NULL OR uha.ExpiresAt > GETUTCDATE())
    )
    BEGIN
        SET @HasAccess = 1;
    END

    SELECT @HasAccess AS HasAccess;
END;
GO
```

### 3.3 usp_Permissions_GrantHub

```sql
CREATE OR ALTER PROCEDURE portal.usp_Permissions_GrantHub
    @UserId INT,
    @HubId INT,
    @GrantedByUserId INT,
    @ExpiresAt DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserEmail NVARCHAR(256);
    DECLARE @AdminEmail NVARCHAR(256);
    DECLARE @HubName NVARCHAR(100);

    SELECT @UserEmail = Email FROM portal.Users WHERE UserId = @UserId;
    SELECT @AdminEmail = Email FROM portal.Users WHERE UserId = @GrantedByUserId;
    SELECT @HubName = HubName FROM portal.ReportingHubs WHERE HubId = @HubId;

    -- Insert or update
    IF EXISTS (SELECT 1 FROM portal.UserHubAccess WHERE UserId = @UserId AND HubId = @HubId)
    BEGIN
        UPDATE portal.UserHubAccess
        SET GrantedBy = @GrantedByUserId,
            GrantedAt = GETUTCDATE(),
            ExpiresAt = @ExpiresAt
        WHERE UserId = @UserId AND HubId = @HubId;
    END
    ELSE
    BEGIN
        INSERT INTO portal.UserHubAccess (UserId, HubId, GrantedBy, ExpiresAt)
        VALUES (@UserId, @HubId, @GrantedByUserId, @ExpiresAt);
    END

    -- Audit log
    INSERT INTO portal.AuditLog (UserId, UserEmail, EventType, EventDescription, TargetType, TargetId, NewValues)
    VALUES (@GrantedByUserId, @AdminEmail, 'PERMISSION_GRANTED',
            CONCAT('Granted hub access to ', @UserEmail, ' for ', @HubName),
            'Hub', @HubId,
            JSON_QUERY(CONCAT('{"userId":', @UserId, ',"hubId":', @HubId, '}')));
END;
GO
```

### 3.4 usp_Permissions_GrantReportGroup

```sql
CREATE OR ALTER PROCEDURE portal.usp_Permissions_GrantReportGroup
    @UserId INT,
    @ReportGroupId INT,
    @GrantedByUserId INT,
    @ExpiresAt DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserEmail NVARCHAR(256);
    DECLARE @AdminEmail NVARCHAR(256);
    DECLARE @GroupName NVARCHAR(100);

    SELECT @UserEmail = Email FROM portal.Users WHERE UserId = @UserId;
    SELECT @AdminEmail = Email FROM portal.Users WHERE UserId = @GrantedByUserId;
    SELECT @GroupName = GroupName FROM portal.ReportGroups WHERE ReportGroupId = @ReportGroupId;

    IF EXISTS (SELECT 1 FROM portal.UserReportGroupAccess WHERE UserId = @UserId AND ReportGroupId = @ReportGroupId)
    BEGIN
        UPDATE portal.UserReportGroupAccess
        SET GrantedBy = @GrantedByUserId,
            GrantedAt = GETUTCDATE(),
            ExpiresAt = @ExpiresAt
        WHERE UserId = @UserId AND ReportGroupId = @ReportGroupId;
    END
    ELSE
    BEGIN
        INSERT INTO portal.UserReportGroupAccess (UserId, ReportGroupId, GrantedBy, ExpiresAt)
        VALUES (@UserId, @ReportGroupId, @GrantedByUserId, @ExpiresAt);
    END

    -- Audit log
    INSERT INTO portal.AuditLog (UserId, UserEmail, EventType, EventDescription, TargetType, TargetId)
    VALUES (@GrantedByUserId, @AdminEmail, 'PERMISSION_GRANTED',
            CONCAT('Granted report group access to ', @UserEmail, ' for ', @GroupName),
            'ReportGroup', @ReportGroupId);
END;
GO
```

### 3.5 usp_Permissions_GrantReport

```sql
CREATE OR ALTER PROCEDURE portal.usp_Permissions_GrantReport
    @UserId INT,
    @ReportId INT,
    @GrantedByUserId INT,
    @ExpiresAt DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserEmail NVARCHAR(256);
    DECLARE @AdminEmail NVARCHAR(256);
    DECLARE @ReportName NVARCHAR(200);

    SELECT @UserEmail = Email FROM portal.Users WHERE UserId = @UserId;
    SELECT @AdminEmail = Email FROM portal.Users WHERE UserId = @GrantedByUserId;
    SELECT @ReportName = ReportName FROM portal.Reports WHERE ReportId = @ReportId;

    IF EXISTS (SELECT 1 FROM portal.UserReportAccess WHERE UserId = @UserId AND ReportId = @ReportId)
    BEGIN
        UPDATE portal.UserReportAccess
        SET GrantedBy = @GrantedByUserId,
            GrantedAt = GETUTCDATE(),
            ExpiresAt = @ExpiresAt
        WHERE UserId = @UserId AND ReportId = @ReportId;
    END
    ELSE
    BEGIN
        INSERT INTO portal.UserReportAccess (UserId, ReportId, GrantedBy, ExpiresAt)
        VALUES (@UserId, @ReportId, @GrantedByUserId, @ExpiresAt);
    END

    -- Audit log
    INSERT INTO portal.AuditLog (UserId, UserEmail, EventType, EventDescription, TargetType, TargetId)
    VALUES (@GrantedByUserId, @AdminEmail, 'PERMISSION_GRANTED',
            CONCAT('Granted report access to ', @UserEmail, ' for ', @ReportName),
            'Report', @ReportId);
END;
GO
```

### 3.6 usp_Permissions_Revoke

Revokes any permission (hub, group, or report level) by permission ID.

```sql
CREATE OR ALTER PROCEDURE portal.usp_Permissions_Revoke
    @PermissionLevel NVARCHAR(20),  -- 'Hub', 'ReportGroup', 'Report'
    @PermissionId INT,
    @RevokedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    DECLARE @TargetId INT;
    DECLARE @UserEmail NVARCHAR(256);
    DECLARE @AdminEmail NVARCHAR(256);
    DECLARE @TargetName NVARCHAR(200);

    SELECT @AdminEmail = Email FROM portal.Users WHERE UserId = @RevokedByUserId;

    IF @PermissionLevel = 'Hub'
    BEGIN
        SELECT @UserId = uha.UserId, @TargetId = uha.HubId, @TargetName = h.HubName
        FROM portal.UserHubAccess uha
        JOIN portal.ReportingHubs h ON uha.HubId = h.HubId
        WHERE uha.UserHubAccessId = @PermissionId;

        DELETE FROM portal.UserHubAccess WHERE UserHubAccessId = @PermissionId;
    END
    ELSE IF @PermissionLevel = 'ReportGroup'
    BEGIN
        SELECT @UserId = urga.UserId, @TargetId = urga.ReportGroupId, @TargetName = rg.GroupName
        FROM portal.UserReportGroupAccess urga
        JOIN portal.ReportGroups rg ON urga.ReportGroupId = rg.ReportGroupId
        WHERE urga.UserReportGroupAccessId = @PermissionId;

        DELETE FROM portal.UserReportGroupAccess WHERE UserReportGroupAccessId = @PermissionId;
    END
    ELSE IF @PermissionLevel = 'Report'
    BEGIN
        SELECT @UserId = ura.UserId, @TargetId = ura.ReportId, @TargetName = r.ReportName
        FROM portal.UserReportAccess ura
        JOIN portal.Reports r ON ura.ReportId = r.ReportId
        WHERE ura.UserReportAccessId = @PermissionId;

        DELETE FROM portal.UserReportAccess WHERE UserReportAccessId = @PermissionId;
    END

    SELECT @UserEmail = Email FROM portal.Users WHERE UserId = @UserId;

    -- Audit log
    INSERT INTO portal.AuditLog (UserId, UserEmail, EventType, EventDescription, TargetType, TargetId)
    VALUES (@RevokedByUserId, @AdminEmail, 'PERMISSION_REVOKED',
            CONCAT('Revoked ', @PermissionLevel, ' access from ', @UserEmail, ' for ', @TargetName),
            @PermissionLevel, @TargetId);
END;
GO
```

---

## 4. Accessible Content Procedures

### 4.1 usp_Hubs_GetAccessible

Returns hubs the user can access based on their permission hierarchy (including department-based access).

```sql
CREATE OR ALTER PROCEDURE portal.usp_Hubs_GetAccessible
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if admin
    DECLARE @IsAdmin BIT = 0;
    IF EXISTS (
        SELECT 1 FROM portal.UserRoles ur
        JOIN portal.Roles r ON ur.RoleId = r.RoleId
        WHERE ur.UserId = @UserId AND r.RoleName = 'Admin'
    )
    BEGIN
        SET @IsAdmin = 1;
    END

    IF @IsAdmin = 1
    BEGIN
        -- Admin sees all active hubs
        SELECT
            h.HubId,
            h.HubCode,
            h.HubName,
            h.Description,
            h.IconName,
            h.BackgroundImage,
            h.SortOrder,
            (SELECT COUNT(*) FROM portal.Reports r JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId WHERE rg.HubId = h.HubId AND r.IsActive = 1) AS ReportCount
        FROM portal.ReportingHubs h
        WHERE h.IsActive = 1
        ORDER BY h.SortOrder;
    END
    ELSE
    BEGIN
        -- User sees hubs they have access to (via department, hub, group, or report access)
        SELECT DISTINCT
            h.HubId,
            h.HubCode,
            h.HubName,
            h.Description,
            h.IconName,
            h.BackgroundImage,
            h.SortOrder,
            (SELECT COUNT(DISTINCT r.ReportId)
             FROM portal.Reports r
             JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId
             WHERE rg.HubId = h.HubId AND r.IsActive = 1
               AND (
                   -- Department-based access
                   EXISTS (SELECT 1 FROM portal.UserDepartments ud JOIN portal.ReportDepartments rd ON ud.DepartmentId = rd.DepartmentId JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId WHERE ud.UserId = @UserId AND rd.ReportId = r.ReportId AND d.IsActive = 1)
                   -- Hub-level access
                   OR EXISTS (SELECT 1 FROM portal.UserHubAccess WHERE UserId = @UserId AND HubId = h.HubId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
                   -- Group-level access
                   OR EXISTS (SELECT 1 FROM portal.UserReportGroupAccess WHERE UserId = @UserId AND ReportGroupId = rg.ReportGroupId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
                   -- Report-level ad-hoc access
                   OR EXISTS (SELECT 1 FROM portal.UserReportAccess WHERE UserId = @UserId AND ReportId = r.ReportId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
               )
            ) AS ReportCount
        FROM portal.ReportingHubs h
        WHERE h.IsActive = 1
          AND (
              -- Department-based access (user has access to at least one report in hub via department)
              EXISTS (SELECT 1 FROM portal.UserDepartments ud JOIN portal.ReportDepartments rd ON ud.DepartmentId = rd.DepartmentId JOIN portal.Reports r ON rd.ReportId = r.ReportId JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId WHERE ud.UserId = @UserId AND rg.HubId = h.HubId AND d.IsActive = 1)
              -- Hub-level access
              OR EXISTS (SELECT 1 FROM portal.UserHubAccess WHERE UserId = @UserId AND HubId = h.HubId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
              -- Group-level access
              OR EXISTS (SELECT 1 FROM portal.UserReportGroupAccess urga JOIN portal.ReportGroups rg ON urga.ReportGroupId = rg.ReportGroupId WHERE urga.UserId = @UserId AND rg.HubId = h.HubId AND (urga.ExpiresAt IS NULL OR urga.ExpiresAt > GETUTCDATE()))
              -- Report-level ad-hoc access
              OR EXISTS (SELECT 1 FROM portal.UserReportAccess ura JOIN portal.Reports r ON ura.ReportId = r.ReportId JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId WHERE ura.UserId = @UserId AND rg.HubId = h.HubId AND (ura.ExpiresAt IS NULL OR ura.ExpiresAt > GETUTCDATE()))
          )
        ORDER BY h.SortOrder;
    END
END;
GO
```

### 4.2 usp_Reports_GetAccessible

Returns reports the user can access (including department-based access), optionally filtered by hub or group.

```sql
CREATE OR ALTER PROCEDURE portal.usp_Reports_GetAccessible
    @UserId INT,
    @HubId INT = NULL,
    @ReportGroupId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IsAdmin BIT = 0;
    IF EXISTS (
        SELECT 1 FROM portal.UserRoles ur
        JOIN portal.Roles r ON ur.RoleId = r.RoleId
        WHERE ur.UserId = @UserId AND r.RoleName = 'Admin'
    )
    BEGIN
        SET @IsAdmin = 1;
    END

    SELECT
        r.ReportId,
        r.ReportCode,
        r.ReportName,
        r.Description,
        r.ReportType,
        r.SortOrder,
        rg.ReportGroupId,
        rg.GroupName,
        h.HubId,
        h.HubName,
        CASE
            WHEN @IsAdmin = 1 THEN 'Admin'
            WHEN EXISTS (SELECT 1 FROM portal.UserDepartments ud JOIN portal.ReportDepartments rd ON ud.DepartmentId = rd.DepartmentId JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId WHERE ud.UserId = @UserId AND rd.ReportId = r.ReportId AND d.IsActive = 1) THEN 'Department'
            WHEN EXISTS (SELECT 1 FROM portal.UserHubAccess WHERE UserId = @UserId AND HubId = h.HubId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())) THEN 'Hub'
            WHEN EXISTS (SELECT 1 FROM portal.UserReportGroupAccess WHERE UserId = @UserId AND ReportGroupId = rg.ReportGroupId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())) THEN 'Group'
            ELSE 'Report'
        END AS AccessLevel
    FROM portal.Reports r
    JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId
    JOIN portal.ReportingHubs h ON rg.HubId = h.HubId
    WHERE r.IsActive = 1
      AND (@HubId IS NULL OR h.HubId = @HubId)
      AND (@ReportGroupId IS NULL OR rg.ReportGroupId = @ReportGroupId)
      AND (
          @IsAdmin = 1
          -- Department-based access
          OR EXISTS (SELECT 1 FROM portal.UserDepartments ud JOIN portal.ReportDepartments rd ON ud.DepartmentId = rd.DepartmentId JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId WHERE ud.UserId = @UserId AND rd.ReportId = r.ReportId AND d.IsActive = 1)
          -- Hub-level access
          OR EXISTS (SELECT 1 FROM portal.UserHubAccess WHERE UserId = @UserId AND HubId = h.HubId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
          -- Group-level access
          OR EXISTS (SELECT 1 FROM portal.UserReportGroupAccess WHERE UserId = @UserId AND ReportGroupId = rg.ReportGroupId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
          -- Report-level ad-hoc access
          OR EXISTS (SELECT 1 FROM portal.UserReportAccess WHERE UserId = @UserId AND ReportId = r.ReportId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
      )
    ORDER BY h.SortOrder, rg.SortOrder, r.SortOrder;
END;
GO
```

---

## 5. Bulk Operations

### 5.1 usp_Report_BulkImport

Bulk imports reports from JSON array, skipping duplicates.

```sql
CREATE OR ALTER PROCEDURE portal.usp_Report_BulkImport
    @ReportGroupId INT,
    @Reports NVARCHAR(MAX),  -- JSON array of report objects
    @CreatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @AdminEmail NVARCHAR(256);
    DECLARE @GroupName NVARCHAR(100);
    DECLARE @ImportedCount INT = 0;
    DECLARE @SkippedCount INT = 0;
    DECLARE @MaxSortOrder INT;

    SELECT @AdminEmail = Email FROM portal.Users WHERE UserId = @CreatedByUserId;
    SELECT @GroupName = GroupName FROM portal.ReportGroups WHERE ReportGroupId = @ReportGroupId;

    -- Validate group exists
    IF NOT EXISTS (SELECT 1 FROM portal.ReportGroups WHERE ReportGroupId = @ReportGroupId)
    BEGIN
        RAISERROR('Report group not found', 16, 1);
        RETURN;
    END

    -- Get current max sort order
    SELECT @MaxSortOrder = ISNULL(MAX(SortOrder), 0) FROM portal.Reports WHERE ReportGroupId = @ReportGroupId;

    -- Parse JSON and insert reports
    INSERT INTO portal.Reports (
        ReportGroupId, ReportCode, ReportName, Description, ReportType,
        PowerBIWorkspaceId, PowerBIReportId,
        SSRSReportPath, SSRSReportServer,
        SortOrder, CreatedBy
    )
    SELECT
        @ReportGroupId,
        JSON_VALUE(r.value, '$.reportCode'),
        JSON_VALUE(r.value, '$.reportName'),
        JSON_VALUE(r.value, '$.description'),
        JSON_VALUE(r.value, '$.reportType'),
        JSON_VALUE(r.value, '$.powerBIWorkspaceId'),
        JSON_VALUE(r.value, '$.powerBIReportId'),
        JSON_VALUE(r.value, '$.ssrsReportPath'),
        JSON_VALUE(r.value, '$.ssrsReportServer'),
        @MaxSortOrder + ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
        @CreatedByUserId
    FROM OPENJSON(@Reports) r
    WHERE NOT EXISTS (
        SELECT 1 FROM portal.Reports
        WHERE ReportGroupId = @ReportGroupId
          AND ReportCode = JSON_VALUE(r.value, '$.reportCode')
    );

    SET @ImportedCount = @@ROWCOUNT;

    -- Count skipped (duplicates)
    SELECT @SkippedCount = COUNT(*)
    FROM OPENJSON(@Reports) r
    WHERE EXISTS (
        SELECT 1 FROM portal.Reports
        WHERE ReportGroupId = @ReportGroupId
          AND ReportCode = JSON_VALUE(r.value, '$.reportCode')
    );

    -- Audit log
    INSERT INTO portal.AuditLog (UserId, UserEmail, EventType, EventDescription, TargetType, TargetId, NewValues)
    VALUES (@CreatedByUserId, @AdminEmail, 'REPORTS_BULK_IMPORTED',
            CONCAT('Bulk imported ', @ImportedCount, ' reports to group: ', @GroupName, ' (', @SkippedCount, ' skipped)'),
            'ReportGroup', @ReportGroupId,
            (SELECT @ImportedCount AS Imported, @SkippedCount AS Skipped FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    -- Return summary
    SELECT @ImportedCount AS ImportedCount, @SkippedCount AS SkippedCount;
END;
GO
```

---

## 6. Audit Procedures

### 6.1 usp_AuditLog_Insert

Standard audit logging procedure for consistent format.

```sql
CREATE OR ALTER PROCEDURE portal.usp_AuditLog_Insert
    @UserId INT,
    @EventType NVARCHAR(50),
    @EventDescription NVARCHAR(500) = NULL,
    @TargetType NVARCHAR(50) = NULL,
    @TargetId INT = NULL,
    @OldValues NVARCHAR(MAX) = NULL,
    @NewValues NVARCHAR(MAX) = NULL,
    @IPAddress NVARCHAR(50) = NULL,
    @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserEmail NVARCHAR(256);
    DECLARE @UserDisplayName NVARCHAR(200);

    SELECT @UserEmail = u.Email, @UserDisplayName = up.DisplayName
    FROM portal.Users u
    LEFT JOIN portal.UserProfiles up ON u.UserId = up.UserId
    WHERE u.UserId = @UserId;

    INSERT INTO portal.AuditLog (UserId, UserEmail, UserDisplayName, EventType, EventDescription, TargetType, TargetId, OldValues, NewValues, IPAddress, UserAgent)
    VALUES (@UserId, @UserEmail, @UserDisplayName, @EventType, @EventDescription, @TargetType, @TargetId, @OldValues, @NewValues, @IPAddress, @UserAgent);
END;
GO
```

### 6.2 usp_ReportAccess_Log

Logs report views for analytics and audit trail.

```sql
CREATE OR ALTER PROCEDURE portal.usp_ReportAccess_Log
    @UserId INT,
    @ReportId INT,
    @AccessType NVARCHAR(20) = 'VIEW',
    @IPAddress NVARCHAR(50) = NULL,
    @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserEmail NVARCHAR(256);
    DECLARE @ReportName NVARCHAR(200);
    DECLARE @HubName NVARCHAR(100);

    SELECT @UserEmail = Email FROM portal.Users WHERE UserId = @UserId;

    SELECT @ReportName = r.ReportName, @HubName = h.HubName
    FROM portal.Reports r
    JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId
    JOIN portal.ReportingHubs h ON rg.HubId = h.HubId
    WHERE r.ReportId = @ReportId;

    INSERT INTO portal.ReportAccessLog (UserId, UserEmail, ReportId, ReportName, HubName, AccessType, IPAddress, UserAgent)
    VALUES (@UserId, @UserEmail, @ReportId, @ReportName, @HubName, @AccessType, @IPAddress, @UserAgent);
END;
GO
```

---

## 7. User Statistics

### 7.1 usp_UserStats_GetDashboard

Returns dashboard statistics for a user (report counts, favorites, recent views). Includes department-based access.

```sql
CREATE OR ALTER PROCEDURE portal.usp_UserStats_GetDashboard
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IsAdmin BIT = 0;
    DECLARE @AvailableReports INT = 0;
    DECLARE @PinnedFavorites INT = 0;
    DECLARE @RecentViews INT = 0;

    -- Check if admin
    IF EXISTS (
        SELECT 1 FROM portal.UserRoles ur
        JOIN portal.Roles r ON ur.RoleId = r.RoleId
        WHERE ur.UserId = @UserId AND r.RoleName = 'Admin'
    )
    BEGIN
        SET @IsAdmin = 1;
    END

    -- Count accessible reports
    IF @IsAdmin = 1
    BEGIN
        SELECT @AvailableReports = COUNT(*) FROM portal.Reports WHERE IsActive = 1;
    END
    ELSE
    BEGIN
        SELECT @AvailableReports = COUNT(DISTINCT r.ReportId)
        FROM portal.Reports r
        JOIN portal.ReportGroups rg ON r.ReportGroupId = rg.ReportGroupId
        JOIN portal.ReportingHubs h ON rg.HubId = h.HubId
        WHERE r.IsActive = 1
          AND (
              -- Department-based access
              EXISTS (SELECT 1 FROM portal.UserDepartments ud JOIN portal.ReportDepartments rd ON ud.DepartmentId = rd.DepartmentId JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId WHERE ud.UserId = @UserId AND rd.ReportId = r.ReportId AND d.IsActive = 1)
              -- Hub-level access
              OR EXISTS (SELECT 1 FROM portal.UserHubAccess WHERE UserId = @UserId AND HubId = h.HubId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
              -- Group-level access
              OR EXISTS (SELECT 1 FROM portal.UserReportGroupAccess WHERE UserId = @UserId AND ReportGroupId = rg.ReportGroupId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
              -- Report-level ad-hoc access
              OR EXISTS (SELECT 1 FROM portal.UserReportAccess WHERE UserId = @UserId AND ReportId = r.ReportId AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()))
          );
    END

    -- Count pinned favorites
    SELECT @PinnedFavorites = COUNT(*)
    FROM portal.UserFavorites uf
    JOIN portal.Reports r ON uf.ReportId = r.ReportId
    WHERE uf.UserId = @UserId AND r.IsActive = 1;

    -- Count recent views (last 30 days)
    SELECT @RecentViews = COUNT(*)
    FROM portal.ReportAccessLog
    WHERE UserId = @UserId
      AND CreatedAt >= DATEADD(DAY, -30, GETUTCDATE());

    SELECT
        @AvailableReports AS AvailableReports,
        @PinnedFavorites AS PinnedFavorites,
        @RecentViews AS RecentViews;
END;
GO
```

---

## 8. Announcement Read Tracking

### 8.1 usp_AnnouncementReads_GetUnreadCount

Returns count of unread published announcements for a user.

```sql
CREATE OR ALTER PROCEDURE portal.usp_AnnouncementReads_GetUnreadCount
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(*) AS UnreadCount
    FROM portal.Announcements a
    WHERE a.IsPublished = 1
      AND a.IsDeleted = 0
      AND NOT EXISTS (
          SELECT 1 FROM portal.UserAnnouncementReads uar
          WHERE uar.UserId = @UserId AND uar.AnnouncementId = a.AnnouncementId
      );
END;
GO
```

### 8.2 usp_AnnouncementReads_MarkAsRead

Marks a single announcement as read for a user.

```sql
CREATE OR ALTER PROCEDURE portal.usp_AnnouncementReads_MarkAsRead
    @UserId INT,
    @AnnouncementId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Only insert if not already read (upsert pattern)
    IF NOT EXISTS (
        SELECT 1 FROM portal.UserAnnouncementReads
        WHERE UserId = @UserId AND AnnouncementId = @AnnouncementId
    )
    BEGIN
        INSERT INTO portal.UserAnnouncementReads (UserId, AnnouncementId)
        VALUES (@UserId, @AnnouncementId);
    END

    SELECT 1 AS Success;
END;
GO
```

### 8.3 usp_AnnouncementReads_MarkAllAsRead

Marks all current published announcements as read for a user.

```sql
CREATE OR ALTER PROCEDURE portal.usp_AnnouncementReads_MarkAllAsRead
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Insert read records for all published announcements not yet read
    INSERT INTO portal.UserAnnouncementReads (UserId, AnnouncementId)
    SELECT @UserId, a.AnnouncementId
    FROM portal.Announcements a
    WHERE a.IsPublished = 1
      AND a.IsDeleted = 0
      AND NOT EXISTS (
          SELECT 1 FROM portal.UserAnnouncementReads uar
          WHERE uar.UserId = @UserId AND uar.AnnouncementId = a.AnnouncementId
      );

    SELECT @@ROWCOUNT AS MarkedCount;
END;
GO
```

### 8.4 usp_AnnouncementReads_GetReadStatus

Returns read/unread status for all published announcements for a user.

```sql
CREATE OR ALTER PROCEDURE portal.usp_AnnouncementReads_GetReadStatus
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        a.AnnouncementId,
        a.Title,
        a.PublishedAt,
        CASE WHEN uar.UserId IS NOT NULL THEN 1 ELSE 0 END AS IsRead,
        uar.ReadAt
    FROM portal.Announcements a
    LEFT JOIN portal.UserAnnouncementReads uar
        ON a.AnnouncementId = uar.AnnouncementId AND uar.UserId = @UserId
    WHERE a.IsPublished = 1
      AND a.IsDeleted = 0
    ORDER BY a.PublishedAt DESC;
END;
GO
```

---

## Summary

| Category | Procedures | Count |
|----------|------------|-------|
| User Authentication | GetByEntraId, CreateFromEntra, UpdateLastLogin, RecordFailedLogin | 4 |
| Session Validation | Validate | 1 |
| Permissions | GetByUserId, CheckReportAccess, GrantHub, GrantReportGroup, GrantReport, Revoke | 6 |
| Accessible Content | Hubs_GetAccessible, Reports_GetAccessible | 2 |
| Bulk Operations | Report_BulkImport | 1 |
| Audit | AuditLog_Insert, ReportAccess_Log | 2 |
| User Statistics | UserStats_GetDashboard | 1 |
| Announcement Reads | GetUnreadCount, MarkAsRead, MarkAllAsRead, GetReadStatus | 4 |

**Total Stored Procedures: 21**

### EF Core Handles (Not Stored Procedures)

| Entity | Operations |
|--------|------------|
| UserProfile | Update display name, avatar |
| UserPreferences | Update theme, table row size |
| UserSession | Create, end, cleanup |
| RefreshToken | Store, validate, revoke |
| UserFavorites | Add, remove, reorder |
| Announcement | Full CRUD |
| ReportingHub | Create, update, delete, reorder |
| ReportGroup | Create, update, delete, move, reorder |
| Report | Create, update, delete, move, reorder |
| Department | Create, update, delete |
| UserDepartments | Assign user to department, remove user from department |
| ReportDepartments | Tag report with department access, remove tag |
| User (admin ops) | Activate, deactivate, unlock, expire, restore |
