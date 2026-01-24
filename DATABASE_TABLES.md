# Database Tables - T-SQL Scripts

This file contains all CREATE TABLE scripts for the RWT Reporting Portal database.

---

## Database Setup

**Server:** DEVSQLGEN01
**Database:** REDWOOD_SOLUTIONS
**Schema:** portal

```sql
-- Connect to the database
USE REDWOOD_SOLUTIONS;
GO

-- Create the portal schema (run once)
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'portal')
BEGIN
    EXEC('CREATE SCHEMA portal');
END
GO
```

---

## 1. Company & Organization Tables

### 1.1 Companies

```sql
CREATE TABLE portal.Companies (
    CompanyId           INT IDENTITY(1,1) PRIMARY KEY,
    CompanyCode         NVARCHAR(50) NOT NULL UNIQUE,
    CompanyName         NVARCHAR(100) NOT NULL,
    IsActive            BIT NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,

    INDEX IX_Companies_Code (CompanyCode)
);
GO
```

---

## 2. User Tables

### 2.1 Users

```sql
CREATE TABLE portal.Users (
    UserId              INT IDENTITY(1,1) PRIMARY KEY,
    EntraObjectId       NVARCHAR(50) NOT NULL UNIQUE,      -- Entra (Azure AD) Object ID
    Email               NVARCHAR(256) NOT NULL,
    FirstName           NVARCHAR(100) NULL,
    LastName            NVARCHAR(100) NULL,
    CompanyId           INT NULL,
    EntraGroups         NVARCHAR(MAX) NULL,                 -- JSON array of Entra group IDs

    -- Account Status
    IsActive            BIT NOT NULL DEFAULT 1,

    -- Expiration (replaces soft delete - account is expired but preserved)
    IsExpired           BIT NOT NULL DEFAULT 0,             -- Account expired flag
    ExpiredAt           DATETIME2 NULL,
    ExpiredBy           INT NULL,
    ExpirationReason    NVARCHAR(500) NULL,

    -- Login Tracking
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,
    LastLoginAt         DATETIME2 NULL,
    LoginCount          INT NOT NULL DEFAULT 0,

    -- Deactivation (admin disabled account temporarily)
    DeactivatedAt       DATETIME2 NULL,
    DeactivatedBy       INT NULL,
    DeactivationReason  NVARCHAR(500) NULL,

    -- Lockout (security - too many failed attempts)
    IsLockedOut         BIT NOT NULL DEFAULT 0,
    LockedOutAt         DATETIME2 NULL,
    LockedOutUntil      DATETIME2 NULL,                     -- NULL = locked indefinitely until admin unlocks
    LockoutReason       NVARCHAR(200) NULL,
    FailedLoginAttempts INT NOT NULL DEFAULT 0,
    LastFailedLoginAt   DATETIME2 NULL,
    UnlockedAt          DATETIME2 NULL,
    UnlockedBy          INT NULL,

    CONSTRAINT FK_Users_Company FOREIGN KEY (CompanyId) REFERENCES portal.Companies(CompanyId),
    CONSTRAINT FK_Users_DeactivatedBy FOREIGN KEY (DeactivatedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT FK_Users_ExpiredBy FOREIGN KEY (ExpiredBy) REFERENCES portal.Users(UserId),
    CONSTRAINT FK_Users_UnlockedBy FOREIGN KEY (UnlockedBy) REFERENCES portal.Users(UserId),

    INDEX IX_Users_EntraObjectId (EntraObjectId),
    INDEX IX_Users_Email (Email),
    INDEX IX_Users_CompanyId (CompanyId),
    INDEX IX_Users_IsActive (IsActive),
    INDEX IX_Users_IsExpired (IsExpired),
    INDEX IX_Users_IsLockedOut (IsLockedOut)
);
GO
```

### 2.2 UserProfiles

```sql
CREATE TABLE portal.UserProfiles (
    UserProfileId       INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL UNIQUE,
    DisplayName         NVARCHAR(200) NULL,                 -- Override for Entra display name
    AvatarId            NVARCHAR(50) NULL,                  -- Avatar selection ID
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,

    CONSTRAINT FK_UserProfiles_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,

    INDEX IX_UserProfiles_UserId (UserId)
);
GO
```

### 2.3 UserPreferences

```sql
CREATE TABLE portal.UserPreferences (
    UserPreferenceId    INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL UNIQUE,
    ThemeId             NVARCHAR(50) NULL DEFAULT 'white',  -- white, g10, g90, g100, sequoia, corevest, enterprise
    TableRowSize        NVARCHAR(10) NULL DEFAULT 'md',     -- xs, sm, md, lg
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,

    CONSTRAINT FK_UserPreferences_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,

    INDEX IX_UserPreferences_UserId (UserId)
);
GO
```

---

## 3. Authentication Tables

### 3.1 UserSessions

```sql
CREATE TABLE portal.UserSessions (
    SessionId           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId              INT NOT NULL,
    AccessTokenHash     NVARCHAR(256) NOT NULL,
    IPAddress           NVARCHAR(50) NULL,
    UserAgent           NVARCHAR(500) NULL,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ExpiresAt           DATETIME2 NOT NULL,
    LastActivityAt      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),  -- For idle timeout tracking
    RevokedAt           DATETIME2 NULL,
    RevokedReason       NVARCHAR(50) NULL,                        -- 'LOGOUT', 'TIMEOUT', 'IDLE', 'ADMIN', 'SECURITY'
    IsActive            AS (CASE WHEN RevokedAt IS NULL AND ExpiresAt > GETUTCDATE() THEN 1 ELSE 0 END),

    CONSTRAINT FK_UserSessions_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,

    INDEX IX_UserSessions_UserId (UserId),
    INDEX IX_UserSessions_ExpiresAt (ExpiresAt),
    INDEX IX_UserSessions_LastActivityAt (LastActivityAt)
);
GO
```

### 3.2 RefreshTokens

```sql
CREATE TABLE portal.RefreshTokens (
    RefreshTokenId      INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL,
    TokenHash           NVARCHAR(256) NOT NULL,             -- Hashed refresh token
    SessionId           UNIQUEIDENTIFIER NOT NULL,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ExpiresAt           DATETIME2 NOT NULL,
    RevokedAt           DATETIME2 NULL,
    ReplacedByTokenId   INT NULL,                           -- For token rotation

    CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_RefreshTokens_Session FOREIGN KEY (SessionId) REFERENCES portal.UserSessions(SessionId),
    CONSTRAINT FK_RefreshTokens_ReplacedBy FOREIGN KEY (ReplacedByTokenId) REFERENCES portal.RefreshTokens(RefreshTokenId),

    INDEX IX_RefreshTokens_UserId (UserId),
    INDEX IX_RefreshTokens_TokenHash (TokenHash),
    INDEX IX_RefreshTokens_ExpiresAt (ExpiresAt)
);
GO
```

### 3.3 LoginHistory

```sql
CREATE TABLE portal.LoginHistory (
    LoginHistoryId      BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NULL,                           -- NULL if user deleted (preserves history)
    UserEmail           NVARCHAR(256) NULL,                 -- Denormalized for history preservation
    LoginMethod         NVARCHAR(20) NOT NULL,              -- 'SSO' or 'PASSWORD'
    IPAddress           NVARCHAR(50) NULL,
    UserAgent           NVARCHAR(500) NULL,
    IsSuccess           BIT NOT NULL,
    FailureReason       NVARCHAR(200) NULL,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    -- SET NULL on delete to preserve login history
    CONSTRAINT FK_LoginHistory_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE SET NULL,

    INDEX IX_LoginHistory_UserId (UserId),
    INDEX IX_LoginHistory_UserEmail (UserEmail),
    INDEX IX_LoginHistory_CreatedAt (CreatedAt DESC),
    INDEX IX_LoginHistory_IsSuccess (IsSuccess)
);
GO
```

---

## 4. Authorization Tables

### 4.1 Roles

```sql
CREATE TABLE portal.Roles (
    RoleId              INT IDENTITY(1,1) PRIMARY KEY,
    RoleName            NVARCHAR(50) NOT NULL UNIQUE,
    Description         NVARCHAR(200) NULL,
    IsSystemRole        BIT NOT NULL DEFAULT 0,             -- System roles cannot be deleted
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    INDEX IX_Roles_RoleName (RoleName)
);
GO
```

### 4.2 UserRoles

```sql
CREATE TABLE portal.UserRoles (
    UserRoleId          INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL,
    RoleId              INT NOT NULL,
    GrantedBy           INT NULL,
    GrantedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_UserRoles_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES portal.Roles(RoleId),
    CONSTRAINT FK_UserRoles_GrantedBy FOREIGN KEY (GrantedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT UQ_UserRoles_UserRole UNIQUE (UserId, RoleId),

    INDEX IX_UserRoles_UserId (UserId),
    INDEX IX_UserRoles_RoleId (RoleId)
);
GO
```

---

## 5. Reporting Tables

### 5.1 ReportingHubs

```sql
CREATE TABLE portal.ReportingHubs (
    HubId               INT IDENTITY(1,1) PRIMARY KEY,
    HubCode             NVARCHAR(50) NOT NULL UNIQUE,
    HubName             NVARCHAR(100) NOT NULL,
    Description         NVARCHAR(500) NULL,
    IconName            NVARCHAR(50) NULL,                  -- Carbon icon name
    ColorClass          NVARCHAR(50) NULL,                  -- CSS color class for hub card styling
    BackgroundImage     NVARCHAR(500) NULL,                 -- URL to background image
    SortOrder           INT NOT NULL DEFAULT 0,
    IsActive            BIT NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,
    CreatedBy           INT NULL,

    CONSTRAINT FK_ReportingHubs_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES portal.Users(UserId),

    INDEX IX_ReportingHubs_HubCode (HubCode),
    INDEX IX_ReportingHubs_IsActive (IsActive),
    INDEX IX_ReportingHubs_SortOrder (SortOrder)
);
GO
```

### 5.2 ReportGroups

```sql
CREATE TABLE portal.ReportGroups (
    ReportGroupId       INT IDENTITY(1,1) PRIMARY KEY,
    HubId               INT NOT NULL,
    GroupCode           NVARCHAR(50) NOT NULL,
    GroupName           NVARCHAR(100) NOT NULL,
    Description         NVARCHAR(500) NULL,
    SortOrder           INT NOT NULL DEFAULT 0,
    IsActive            BIT NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,
    CreatedBy           INT NULL,

    CONSTRAINT FK_ReportGroups_Hub FOREIGN KEY (HubId) REFERENCES portal.ReportingHubs(HubId) ON DELETE CASCADE,
    CONSTRAINT FK_ReportGroups_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT UQ_ReportGroups_HubGroup UNIQUE (HubId, GroupCode),

    INDEX IX_ReportGroups_HubId (HubId),
    INDEX IX_ReportGroups_IsActive (IsActive),
    INDEX IX_ReportGroups_SortOrder (SortOrder)
);
GO
```

### 5.3 Reports

```sql
CREATE TABLE portal.Reports (
    ReportId            INT IDENTITY(1,1) PRIMARY KEY,
    ReportGroupId       INT NOT NULL,
    ReportCode          NVARCHAR(50) NOT NULL,
    ReportName          NVARCHAR(200) NOT NULL,
    Description         NVARCHAR(1000) NULL,
    ReportType          NVARCHAR(20) NOT NULL,              -- 'POWERBI' or 'SSRS'

    -- Power BI specific fields
    PowerBIWorkspaceId  NVARCHAR(50) NULL,
    PowerBIReportId     NVARCHAR(50) NULL,

    -- SSRS specific fields
    SSRSReportPath      NVARCHAR(500) NULL,
    SSRSReportServer    NVARCHAR(500) NULL,

    -- Common fields
    Parameters          NVARCHAR(MAX) NULL,                 -- JSON definition of report parameters
    SortOrder           INT NOT NULL DEFAULT 0,
    IsActive            BIT NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,
    CreatedBy           INT NULL,

    CONSTRAINT FK_Reports_ReportGroup FOREIGN KEY (ReportGroupId) REFERENCES portal.ReportGroups(ReportGroupId) ON DELETE CASCADE,
    CONSTRAINT FK_Reports_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT CK_Reports_ReportType CHECK (ReportType IN ('POWERBI', 'SSRS')),
    CONSTRAINT UQ_Reports_GroupReport UNIQUE (ReportGroupId, ReportCode),

    INDEX IX_Reports_ReportGroupId (ReportGroupId),
    INDEX IX_Reports_ReportType (ReportType),
    INDEX IX_Reports_IsActive (IsActive),
    INDEX IX_Reports_SortOrder (SortOrder)
);
GO
```

---

## 6. Department Tables

### 6.1 Departments

Organizational departments for group-based report access (Treasury, Finance, IT, etc.)

```sql
CREATE TABLE portal.Departments (
    DepartmentId        INT IDENTITY(1,1) PRIMARY KEY,
    DepartmentCode      NVARCHAR(50) NOT NULL UNIQUE,
    DepartmentName      NVARCHAR(100) NOT NULL,
    Description         NVARCHAR(500) NULL,
    SortOrder           INT NOT NULL DEFAULT 0,
    IsActive            BIT NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,
    CreatedBy           INT NULL,

    CONSTRAINT FK_Departments_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES portal.Users(UserId),

    INDEX IX_Departments_DepartmentCode (DepartmentCode),
    INDEX IX_Departments_IsActive (IsActive),
    INDEX IX_Departments_SortOrder (SortOrder)
);
GO
```

### 6.2 UserDepartments

Junction table linking users to their organizational departments.

```sql
CREATE TABLE portal.UserDepartments (
    UserDepartmentId    INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL,
    DepartmentId        INT NOT NULL,
    GrantedBy           INT NULL,
    GrantedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_UserDepartments_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserDepartments_Department FOREIGN KEY (DepartmentId) REFERENCES portal.Departments(DepartmentId) ON DELETE CASCADE,
    CONSTRAINT FK_UserDepartments_GrantedBy FOREIGN KEY (GrantedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT UQ_UserDepartments_UserDept UNIQUE (UserId, DepartmentId),

    INDEX IX_UserDepartments_UserId (UserId),
    INDEX IX_UserDepartments_DepartmentId (DepartmentId)
);
GO
```

### 6.3 ReportDepartments

Junction table linking reports to departments for department-based access control.
Users in a tagged department automatically get access to the report.

```sql
CREATE TABLE portal.ReportDepartments (
    ReportDepartmentId  INT IDENTITY(1,1) PRIMARY KEY,
    ReportId            INT NOT NULL,
    DepartmentId        INT NOT NULL,
    GrantedBy           INT NULL,
    GrantedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_ReportDepartments_Report FOREIGN KEY (ReportId) REFERENCES portal.Reports(ReportId) ON DELETE CASCADE,
    CONSTRAINT FK_ReportDepartments_Department FOREIGN KEY (DepartmentId) REFERENCES portal.Departments(DepartmentId) ON DELETE CASCADE,
    CONSTRAINT FK_ReportDepartments_GrantedBy FOREIGN KEY (GrantedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT UQ_ReportDepartments_ReportDept UNIQUE (ReportId, DepartmentId),

    INDEX IX_ReportDepartments_ReportId (ReportId),
    INDEX IX_ReportDepartments_DepartmentId (DepartmentId)
);
GO
```

---

## 7. Access Control Tables

### 7.1 UserHubAccess

```sql
CREATE TABLE portal.UserHubAccess (
    UserHubAccessId     INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL,
    HubId               INT NOT NULL,
    GrantedBy           INT NULL,
    GrantedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ExpiresAt           DATETIME2 NULL,                     -- NULL = never expires

    CONSTRAINT FK_UserHubAccess_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserHubAccess_Hub FOREIGN KEY (HubId) REFERENCES portal.ReportingHubs(HubId) ON DELETE CASCADE,
    CONSTRAINT FK_UserHubAccess_GrantedBy FOREIGN KEY (GrantedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT UQ_UserHubAccess_UserHub UNIQUE (UserId, HubId),

    INDEX IX_UserHubAccess_UserId (UserId),
    INDEX IX_UserHubAccess_HubId (HubId)
);
GO
```

### 7.2 UserReportGroupAccess

```sql
CREATE TABLE portal.UserReportGroupAccess (
    UserReportGroupAccessId INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL,
    ReportGroupId       INT NOT NULL,
    GrantedBy           INT NULL,
    GrantedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ExpiresAt           DATETIME2 NULL,                     -- NULL = never expires

    CONSTRAINT FK_UserReportGroupAccess_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserReportGroupAccess_Group FOREIGN KEY (ReportGroupId) REFERENCES portal.ReportGroups(ReportGroupId) ON DELETE CASCADE,
    CONSTRAINT FK_UserReportGroupAccess_GrantedBy FOREIGN KEY (GrantedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT UQ_UserReportGroupAccess_UserGroup UNIQUE (UserId, ReportGroupId),

    INDEX IX_UserReportGroupAccess_UserId (UserId),
    INDEX IX_UserReportGroupAccess_ReportGroupId (ReportGroupId)
);
GO
```

### 7.3 UserReportAccess

```sql
CREATE TABLE portal.UserReportAccess (
    UserReportAccessId  INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL,
    ReportId            INT NOT NULL,
    GrantedBy           INT NULL,
    GrantedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ExpiresAt           DATETIME2 NULL,                     -- NULL = never expires

    CONSTRAINT FK_UserReportAccess_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserReportAccess_Report FOREIGN KEY (ReportId) REFERENCES portal.Reports(ReportId) ON DELETE CASCADE,
    CONSTRAINT FK_UserReportAccess_GrantedBy FOREIGN KEY (GrantedBy) REFERENCES portal.Users(UserId),
    CONSTRAINT UQ_UserReportAccess_UserReport UNIQUE (UserId, ReportId),

    INDEX IX_UserReportAccess_UserId (UserId),
    INDEX IX_UserReportAccess_ReportId (ReportId)
);
GO
```

---

## 8. User Favorites

### 8.1 UserFavorites

```sql
CREATE TABLE portal.UserFavorites (
    UserFavoriteId      INT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NOT NULL,
    ReportId            INT NOT NULL,
    SortOrder           INT NOT NULL DEFAULT 0,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_UserFavorites_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserFavorites_Report FOREIGN KEY (ReportId) REFERENCES portal.Reports(ReportId) ON DELETE CASCADE,
    CONSTRAINT UQ_UserFavorites_UserReport UNIQUE (UserId, ReportId),

    INDEX IX_UserFavorites_UserId (UserId),
    INDEX IX_UserFavorites_SortOrder (SortOrder)
);
GO
```

---

## 9. Audit Tables

### 9.1 AuditLog

```sql
CREATE TABLE portal.AuditLog (
    AuditLogId          BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NULL,                           -- NULL if user deleted (preserves history)
    UserEmail           NVARCHAR(256) NULL,                 -- Denormalized for history preservation
    UserDisplayName     NVARCHAR(200) NULL,                 -- Denormalized for history preservation
    EventType           NVARCHAR(50) NOT NULL,
    EventDescription    NVARCHAR(500) NULL,
    TargetType          NVARCHAR(50) NULL,                  -- 'User', 'Hub', 'Report', etc.
    TargetId            INT NULL,
    OldValues           NVARCHAR(MAX) NULL,                 -- JSON of previous values
    NewValues           NVARCHAR(MAX) NULL,                 -- JSON of new values
    IPAddress           NVARCHAR(50) NULL,
    UserAgent           NVARCHAR(500) NULL,
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    -- SET NULL on delete to preserve audit history
    CONSTRAINT FK_AuditLog_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE SET NULL,

    INDEX IX_AuditLog_UserId (UserId),
    INDEX IX_AuditLog_UserEmail (UserEmail),
    INDEX IX_AuditLog_EventType (EventType),
    INDEX IX_AuditLog_CreatedAt (CreatedAt DESC),
    INDEX IX_AuditLog_TargetType_TargetId (TargetType, TargetId)
);
GO
```

### 9.2 ReportAccessLog

```sql
CREATE TABLE portal.ReportAccessLog (
    ReportAccessLogId   BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId              INT NULL,                           -- NULL if user deleted (preserves history)
    UserEmail           NVARCHAR(256) NULL,                 -- Denormalized for history preservation
    ReportId            INT NULL,                           -- NULL if report deleted
    ReportName          NVARCHAR(200) NULL,                 -- Denormalized for history preservation
    HubName             NVARCHAR(100) NULL,                 -- Denormalized for history preservation
    AccessType          NVARCHAR(20) NOT NULL DEFAULT 'VIEW', -- 'VIEW', 'EXPORT', 'PRINT'
    IPAddress           NVARCHAR(50) NULL,
    UserAgent           NVARCHAR(500) NULL,
    DurationSeconds     INT NULL,                           -- How long they viewed
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    -- SET NULL on delete to preserve access history
    CONSTRAINT FK_ReportAccessLog_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE SET NULL,
    CONSTRAINT FK_ReportAccessLog_Report FOREIGN KEY (ReportId) REFERENCES portal.Reports(ReportId) ON DELETE SET NULL,

    INDEX IX_ReportAccessLog_UserId (UserId),
    INDEX IX_ReportAccessLog_UserEmail (UserEmail),
    INDEX IX_ReportAccessLog_ReportId (ReportId),
    INDEX IX_ReportAccessLog_CreatedAt (CreatedAt DESC)
);
GO
```

---

## 10. Configuration Tables

### 10.1 AppSettings

```sql
CREATE TABLE portal.AppSettings (
    SettingId           INT IDENTITY(1,1) PRIMARY KEY,
    SettingKey          NVARCHAR(100) NOT NULL UNIQUE,
    SettingValue        NVARCHAR(MAX) NULL,
    SettingType         NVARCHAR(20) NOT NULL DEFAULT 'STRING', -- STRING, INT, BOOL, JSON
    Description         NVARCHAR(500) NULL,
    Category            NVARCHAR(50) NULL,                  -- For grouping in admin UI
    IsEncrypted         BIT NOT NULL DEFAULT 0,
    IsReadOnly          BIT NOT NULL DEFAULT 0,             -- System settings that can't be changed via UI
    UpdatedAt           DATETIME2 NULL,
    UpdatedBy           INT NULL,

    CONSTRAINT FK_AppSettings_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES portal.Users(UserId) ON DELETE SET NULL,

    INDEX IX_AppSettings_SettingKey (SettingKey),
    INDEX IX_AppSettings_Category (Category)
);
GO
```

---

## 11. Content Management Tables

### 11.1 Announcements

```sql
CREATE TABLE portal.Announcements (
    AnnouncementId      INT IDENTITY(1,1) PRIMARY KEY,
    Title               NVARCHAR(200) NOT NULL,
    Subtitle            NVARCHAR(100) NULL,                 -- Category label (e.g., 'System Update', 'New Feature')
    Content             NVARCHAR(MAX) NULL,                 -- Markdown or plain text content
    ImagePath           NVARCHAR(200) NULL,                 -- Path to image in assets (e.g., '/assets/images/announcements/update-1.jpg')
    ReadTimeMinutes     INT NULL,                           -- Estimated read time

    -- Publishing
    IsFeatured          BIT NOT NULL DEFAULT 0,             -- Featured announcements appear prominently
    IsPublished         BIT NOT NULL DEFAULT 0,             -- Only published items appear on dashboard
    PublishedAt         DATETIME2 NULL,

    -- Authorship & Tracking
    AuthorId            INT NULL,
    AuthorName          NVARCHAR(200) NULL,                 -- Denormalized for display (e.g., 'IT Operations')
    CreatedAt           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2 NULL,
    UpdatedBy           INT NULL,

    -- Soft delete
    IsDeleted           BIT NOT NULL DEFAULT 0,
    DeletedAt           DATETIME2 NULL,
    DeletedBy           INT NULL,

    CONSTRAINT FK_Announcements_Author FOREIGN KEY (AuthorId) REFERENCES portal.Users(UserId) ON DELETE SET NULL,
    CONSTRAINT FK_Announcements_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES portal.Users(UserId) ON DELETE SET NULL,
    CONSTRAINT FK_Announcements_DeletedBy FOREIGN KEY (DeletedBy) REFERENCES portal.Users(UserId) ON DELETE SET NULL,

    INDEX IX_Announcements_IsPublished (IsPublished),
    INDEX IX_Announcements_IsFeatured (IsFeatured),
    INDEX IX_Announcements_PublishedAt (PublishedAt DESC),
    INDEX IX_Announcements_IsDeleted (IsDeleted),
    INDEX IX_Announcements_AuthorId (AuthorId)
);
GO
```

**Design Notes:**
- `ImagePath` stores the relative path to an image in the `/assets/images/` folder (no file upload needed)
- `AuthorName` is denormalized to allow custom author names (e.g., "IT Operations" instead of a user's name)
- Soft delete preserves history while hiding deleted announcements
- `IsFeatured` allows one or more announcements to appear prominently
- `ReadTimeMinutes` can be calculated based on content length or set manually

### 11.2 UserAnnouncementReads

Tracks which announcements each user has read, enabling unread notification badges.

```sql
CREATE TABLE portal.UserAnnouncementReads (
    UserId              INT NOT NULL,
    AnnouncementId      INT NOT NULL,
    ReadAt              DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_UserAnnouncementReads PRIMARY KEY (UserId, AnnouncementId),
    CONSTRAINT FK_UserAnnouncementReads_User FOREIGN KEY (UserId) REFERENCES portal.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserAnnouncementReads_Announcement FOREIGN KEY (AnnouncementId) REFERENCES portal.Announcements(AnnouncementId) ON DELETE CASCADE,

    INDEX IX_UserAnnouncementReads_UserId (UserId),
    INDEX IX_UserAnnouncementReads_AnnouncementId (AnnouncementId)
);
GO
```

**Design Notes:**
- Composite primary key ensures one read record per user per announcement
- CASCADE delete removes read records when user or announcement is deleted
- Used by the notification bell to show count of unread announcements
- Records are inserted when user views the Updates page or opens an announcement

---

## 12. Design Notes

### 12.1 User Expiration vs Hard Delete

**Users table uses expiration (`IsExpired` flag) instead of deletion:**
- Preserves complete audit trail and history
- Admin can "expire" a user account without losing data
- Expired users cannot login but their data is preserved
- Expired accounts can be restored by an admin if needed
- Queries should filter: `WHERE IsExpired = 0`
- Hard delete should only be done for GDPR/compliance via separate cleanup process

**Account States:**
- **Active** (`IsActive = 1`, `IsExpired = 0`) - Normal operating state
- **Deactivated** (`IsActive = 0`, `IsExpired = 0`) - Temporarily disabled, can be reactivated
- **Expired** (`IsExpired = 1`) - Permanently disabled, preserved for records, can be restored
- **Locked** (`IsLockedOut = 1`) - Security lockout, requires admin unlock

**Other tables use CASCADE or SET NULL:**
- User-owned data (profiles, preferences, favorites, sessions, tokens) → CASCADE (delete with user)
- Audit/history data (AuditLog, LoginHistory, ReportAccessLog) → SET NULL (preserve history)
- Access permissions → CASCADE (remove access when user expired)

### 12.2 Cascade Delete Behavior Summary

**Note:** These cascades apply if a hard delete is ever performed (e.g., GDPR compliance). Normal user removal uses the expiration flag instead.

| Table | On User Hard Delete | Reason |
|-------|---------------------|--------|
| UserProfiles | CASCADE | User data, no value without user |
| UserPreferences | CASCADE | User data, no value without user |
| UserSessions | CASCADE | Security: terminate all sessions |
| RefreshTokens | CASCADE | Security: invalidate all tokens |
| UserRoles | CASCADE | Remove all role assignments |
| UserDepartments | CASCADE | Remove all department memberships |
| UserHubAccess | CASCADE | Remove all access grants |
| UserReportGroupAccess | CASCADE | Remove all access grants |
| UserReportAccess | CASCADE | Remove all access grants |
| UserFavorites | CASCADE | User data, no value without user |
| LoginHistory | SET NULL | Preserve security audit trail |
| AuditLog | SET NULL | Preserve compliance audit trail |
| ReportAccessLog | SET NULL | Preserve usage analytics |

### 12.3 Timeout & Security Settings

The following settings should be seeded in AppSettings:

| Key | Default | Description |
|-----|---------|-------------|
| `Security.SessionTimeoutMinutes` | 480 | Max session duration (8 hours) |
| `Security.IdleTimeoutMinutes` | 30 | Idle timeout before warning |
| `Security.IdleLogoutMinutes` | 35 | Idle timeout before auto-logout |
| `Security.MaxFailedLoginAttempts` | 5 | Attempts before lockout |
| `Security.LockoutDurationMinutes` | 30 | Auto-unlock after (0 = manual only) |
| `Security.RefreshTokenDays` | 7 | Refresh token validity |
| `Security.AccessTokenMinutes` | 15 | Access token validity |

### 12.4 Account Status Logic

```
User can login when:
  - IsActive = 1 (not deactivated by admin)
  - IsExpired = 0 (account not expired)
  - IsLockedOut = 0 OR LockedOutUntil < GETUTCDATE() (not locked or lock expired)
  - User is in allowed Entra security group

Account Expiration:
  - Admin expires user account via Admin UI
  - Sets IsExpired = 1, IsActive = 0, ExpiredAt, ExpiredBy, ExpirationReason
  - All active sessions are revoked
  - User cannot login until restored

Account Restoration:
  - Admin can restore an expired account
  - Sets IsExpired = 0, clears ExpiredAt/ExpiredBy/ExpirationReason
  - User must login again (no automatic session restoration)

Lockout occurs when:
  - FailedLoginAttempts >= MaxFailedLoginAttempts
  - Admin manually locks account

Unlock occurs when:
  - Admin manually unlocks
  - LockedOutUntil time passes (if auto-unlock enabled)
```

---

## Summary

| Category | Tables |
|----------|--------|
| Organization | Companies |
| Users | Users, UserProfiles, UserPreferences |
| Authentication | UserSessions, RefreshTokens, LoginHistory |
| Authorization | Roles, UserRoles |
| Reporting | ReportingHubs, ReportGroups, Reports |
| Departments | Departments, UserDepartments, ReportDepartments |
| Access Control | UserHubAccess, UserReportGroupAccess, UserReportAccess |
| Favorites | UserFavorites |
| Audit | AuditLog, ReportAccessLog |
| Configuration | AppSettings |
| Content Management | Announcements |

**Total Tables: 20**

