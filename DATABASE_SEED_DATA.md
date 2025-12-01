# Database Seed Data - T-SQL Scripts

This file contains all INSERT scripts for initial/reference data in the RWT Reporting Portal database.

**Server:** DEVSQLGEN01
**Database:** REDWOOD_SOLUTIONS
**Schema:** portal

---

## Execution Order

Run these scripts in order after creating tables:

1. Companies
2. Roles
3. AppSettings
4. Departments
5. Sample Hubs (optional - for development/testing)
6. Sample Report Groups (optional)
7. Sample Reports (optional)
8. Sample Report Department Access (optional - tags reports with department access)

---

## 1. Companies

```sql
USE REDWOOD_SOLUTIONS;
GO

-- Insert company records
INSERT INTO portal.Companies (CompanyCode, CompanyName, IsActive)
VALUES
    ('RWT', 'Redwood Trust', 1),
    ('CVT', 'CoreVest', 1);
GO

-- Verify
SELECT * FROM portal.Companies;
GO
```

---

## 2. Roles

```sql
-- Insert system roles
INSERT INTO portal.Roles (RoleName, Description, IsSystemRole)
VALUES
    ('Admin', 'Full system access - can manage users, permissions, and all settings', 1),
    ('User', 'Standard user - can view assigned reports and manage own profile', 1);
GO

-- Verify
SELECT * FROM portal.Roles;
GO
```

---

## 3. AppSettings - Security Configuration

```sql
-- Security Settings
INSERT INTO portal.AppSettings (SettingKey, SettingValue, SettingType, Description, Category, IsReadOnly)
VALUES
    -- Session & Token Settings
    ('Security.SessionTimeoutMinutes', '480', 'INT', 'Maximum session duration in minutes (default: 8 hours)', 'Security', 0),
    ('Security.IdleTimeoutMinutes', '30', 'INT', 'Minutes of inactivity before showing idle warning', 'Security', 0),
    ('Security.IdleLogoutMinutes', '35', 'INT', 'Minutes of inactivity before automatic logout', 'Security', 0),
    ('Security.AccessTokenMinutes', '15', 'INT', 'Access token validity in minutes', 'Security', 0),
    ('Security.RefreshTokenDays', '7', 'INT', 'Refresh token validity in days', 'Security', 0),

    -- Lockout Settings
    ('Security.MaxFailedLoginAttempts', '5', 'INT', 'Failed login attempts before account lockout', 'Security', 0),
    ('Security.LockoutDurationMinutes', '30', 'INT', 'Auto-unlock duration (0 = manual unlock only)', 'Security', 0),
    ('Security.ResetFailedAttemptsMinutes', '15', 'INT', 'Reset failed attempt counter after this many minutes', 'Security', 0),

    -- Entra/SSO Settings
    ('Entra.TenantId', '', 'STRING', 'Microsoft Entra tenant ID', 'Authentication', 0),
    ('Entra.ClientId', '', 'STRING', 'Application client ID registered in Entra', 'Authentication', 0),
    ('Entra.RequiredSecurityGroup', 'RWT-ReportingPortal-Access', 'STRING', 'Entra security group required for login', 'Authentication', 0),
    ('Entra.AdminSecurityGroup', 'RWT-ReportingPortal-Admins', 'STRING', 'Entra security group that grants admin role', 'Authentication', 0);
GO

-- Application Settings
INSERT INTO portal.AppSettings (SettingKey, SettingValue, SettingType, Description, Category, IsReadOnly)
VALUES
    -- General App Settings
    ('App.Name', 'RWT Reporting Portal', 'STRING', 'Application display name', 'Application', 1),
    ('App.Version', '1.0.0', 'STRING', 'Current application version', 'Application', 1),
    ('App.DefaultTheme', 'white', 'STRING', 'Default theme for new users', 'Application', 0),
    ('App.DefaultTableRowSize', 'md', 'STRING', 'Default table row size for new users', 'Application', 0),

    -- Power BI Settings
    ('PowerBI.WorkspaceId', '', 'STRING', 'Default Power BI workspace ID', 'PowerBI', 0),
    ('PowerBI.TenantId', '', 'STRING', 'Power BI tenant ID (if different from Entra)', 'PowerBI', 0),
    ('PowerBI.ClientId', '', 'STRING', 'Power BI app registration client ID', 'PowerBI', 0),

    -- SSRS Settings
    ('SSRS.ReportServerUrl', '', 'STRING', 'SSRS Report Server URL', 'SSRS', 0),
    ('SSRS.ReportServerPath', '/Reports', 'STRING', 'Base path for SSRS reports', 'SSRS', 0);
GO

-- Audit Settings
INSERT INTO portal.AppSettings (SettingKey, SettingValue, SettingType, Description, Category, IsReadOnly)
VALUES
    ('Audit.RetentionDays', '365', 'INT', 'Days to retain audit log entries', 'Audit', 0),
    ('Audit.LoginHistoryRetentionDays', '90', 'INT', 'Days to retain login history', 'Audit', 0),
    ('Audit.ReportAccessRetentionDays', '180', 'INT', 'Days to retain report access logs', 'Audit', 0);
GO

-- Verify
SELECT * FROM portal.AppSettings ORDER BY Category, SettingKey;
GO
```

---

## 4. Departments

Organizational departments for group-based report access.

```sql
-- Insert standard departments
INSERT INTO portal.Departments (DepartmentCode, DepartmentName, Description, SortOrder, IsActive)
VALUES
    ('ADMIN', 'Admin', 'System administrators with full access', 1, 1),
    ('IT', 'IT', 'Information Technology department', 2, 1),
    ('TREASURY', 'Treasury', 'Treasury and cash management', 3, 1),
    ('FINANCE', 'Finance', 'Financial planning and analysis', 4, 1),
    ('ACCOUNTING', 'Accounting', 'General accounting and bookkeeping', 5, 1),
    ('ENTERPRISE', 'Enterprise', 'Enterprise-wide access', 6, 1),
    ('LENDING', 'Lending', 'Loan origination and servicing', 7, 1),
    ('OPERATIONS', 'Operations', 'Business operations', 8, 1),
    ('COMPLIANCE', 'Compliance', 'Regulatory compliance', 9, 1),
    ('HR', 'Human Resources', 'Human resources department', 10, 1),
    ('EXECUTIVE', 'Executive', 'Executive leadership team', 11, 1);
GO

-- Verify
SELECT * FROM portal.Departments ORDER BY SortOrder;
GO
```

---

## 5. Sample Reporting Hubs (Development/Testing)

```sql
-- Sample hubs for development - modify or remove for production
INSERT INTO portal.ReportingHubs (HubCode, HubName, Description, IconName, SortOrder, IsActive)
VALUES
    ('FINANCE', 'Finance Hub', 'Financial reports, budgets, and accounting analytics', 'finance', 1, 1),
    ('OPERATIONS', 'Operations Hub', 'Operational metrics, pipeline, and workflow reports', 'analytics', 2, 1),
    ('EXECUTIVE', 'Executive Hub', 'Executive dashboards and KPI summaries', 'dashboard', 3, 1),
    ('LENDING', 'Lending Hub', 'Loan origination, servicing, and portfolio reports', 'document', 4, 1),
    ('COMPLIANCE', 'Compliance Hub', 'Regulatory and compliance reporting', 'policy', 5, 1),
    ('HR', 'Human Resources Hub', 'HR metrics, headcount, and workforce analytics', 'group', 6, 1);
GO

-- Verify
SELECT * FROM portal.ReportingHubs ORDER BY SortOrder;
GO
```

---

## 6. Sample Report Groups (Development/Testing)

```sql
-- Get hub IDs
DECLARE @FinanceHubId INT = (SELECT HubId FROM portal.ReportingHubs WHERE HubCode = 'FINANCE');
DECLARE @OperationsHubId INT = (SELECT HubId FROM portal.ReportingHubs WHERE HubCode = 'OPERATIONS');
DECLARE @ExecutiveHubId INT = (SELECT HubId FROM portal.ReportingHubs WHERE HubCode = 'EXECUTIVE');
DECLARE @LendingHubId INT = (SELECT HubId FROM portal.ReportingHubs WHERE HubCode = 'LENDING');

-- Finance Hub Groups
INSERT INTO portal.ReportGroups (HubId, GroupCode, GroupName, Description, SortOrder, IsActive)
VALUES
    (@FinanceHubId, 'MONTHLY', 'Monthly Reports', 'End of month financial reports', 1, 1),
    (@FinanceHubId, 'QUARTERLY', 'Quarterly Reports', 'Quarterly financial summaries', 2, 1),
    (@FinanceHubId, 'ANNUAL', 'Annual Reports', 'Year-end financial reports', 3, 1),
    (@FinanceHubId, 'ADHOC', 'Ad-Hoc Analysis', 'Custom financial analysis reports', 4, 1);

-- Operations Hub Groups
INSERT INTO portal.ReportGroups (HubId, GroupCode, GroupName, Description, SortOrder, IsActive)
VALUES
    (@OperationsHubId, 'DAILY', 'Daily Operations', 'Daily operational metrics and KPIs', 1, 1),
    (@OperationsHubId, 'PIPELINE', 'Pipeline Reports', 'Deal pipeline and workflow status', 2, 1),
    (@OperationsHubId, 'PERFORMANCE', 'Performance Metrics', 'Team and process performance', 3, 1);

-- Executive Hub Groups
INSERT INTO portal.ReportGroups (HubId, GroupCode, GroupName, Description, SortOrder, IsActive)
VALUES
    (@ExecutiveHubId, 'DASHBOARDS', 'Executive Dashboards', 'High-level KPI dashboards', 1, 1),
    (@ExecutiveHubId, 'BOARD', 'Board Reports', 'Board meeting presentations and reports', 2, 1);

-- Lending Hub Groups
INSERT INTO portal.ReportGroups (HubId, GroupCode, GroupName, Description, SortOrder, IsActive)
VALUES
    (@LendingHubId, 'ORIGINATION', 'Origination Reports', 'Loan origination volume and metrics', 1, 1),
    (@LendingHubId, 'SERVICING', 'Servicing Reports', 'Loan servicing and payment reports', 2, 1),
    (@LendingHubId, 'PORTFOLIO', 'Portfolio Analysis', 'Portfolio composition and risk analysis', 3, 1);
GO

-- Verify
SELECT
    h.HubName,
    g.GroupCode,
    g.GroupName,
    g.SortOrder
FROM portal.ReportGroups g
JOIN portal.ReportingHubs h ON g.HubId = h.HubId
ORDER BY h.SortOrder, g.SortOrder;
GO
```

---

## 7. Sample Reports (Development/Testing)

```sql
-- Get group IDs
DECLARE @MonthlyGroupId INT = (SELECT ReportGroupId FROM portal.ReportGroups WHERE GroupCode = 'MONTHLY');
DECLARE @QuarterlyGroupId INT = (SELECT ReportGroupId FROM portal.ReportGroups WHERE GroupCode = 'QUARTERLY');
DECLARE @DashboardsGroupId INT = (SELECT ReportGroupId FROM portal.ReportGroups WHERE GroupCode = 'DASHBOARDS');
DECLARE @OriginationGroupId INT = (SELECT ReportGroupId FROM portal.ReportGroups WHERE GroupCode = 'ORIGINATION');

-- Monthly Finance Reports (SSRS examples)
INSERT INTO portal.Reports (ReportGroupId, ReportCode, ReportName, Description, ReportType, SSRSReportPath, SortOrder, IsActive)
VALUES
    (@MonthlyGroupId, 'PL-MONTHLY', 'Monthly P&L Statement', 'Profit and loss statement for the month', 'SSRS', '/Finance/Monthly/PL_Statement', 1, 1),
    (@MonthlyGroupId, 'BS-MONTHLY', 'Monthly Balance Sheet', 'Balance sheet as of month end', 'SSRS', '/Finance/Monthly/Balance_Sheet', 2, 1),
    (@MonthlyGroupId, 'CF-MONTHLY', 'Monthly Cash Flow', 'Cash flow statement for the month', 'SSRS', '/Finance/Monthly/Cash_Flow', 3, 1);

-- Quarterly Finance Reports (SSRS examples)
INSERT INTO portal.Reports (ReportGroupId, ReportCode, ReportName, Description, ReportType, SSRSReportPath, SortOrder, IsActive)
VALUES
    (@QuarterlyGroupId, 'QTR-SUMMARY', 'Quarterly Summary', 'Quarterly financial summary', 'SSRS', '/Finance/Quarterly/Summary', 1, 1),
    (@QuarterlyGroupId, 'QTR-VARIANCE', 'Budget vs Actual', 'Quarterly budget variance analysis', 'SSRS', '/Finance/Quarterly/Variance', 2, 1);

-- Executive Dashboards (Power BI examples)
INSERT INTO portal.Reports (ReportGroupId, ReportCode, ReportName, Description, ReportType, PowerBIWorkspaceId, PowerBIReportId, SortOrder, IsActive)
VALUES
    (@DashboardsGroupId, 'EXEC-KPI', 'Executive KPI Dashboard', 'Key performance indicators at a glance', 'POWERBI', 'workspace-guid-here', 'report-guid-here', 1, 1),
    (@DashboardsGroupId, 'EXEC-FINANCIAL', 'Financial Overview', 'Financial metrics dashboard', 'POWERBI', 'workspace-guid-here', 'report-guid-here', 2, 1);

-- Origination Reports (Mixed examples)
INSERT INTO portal.Reports (ReportGroupId, ReportCode, ReportName, Description, ReportType, SSRSReportPath, SortOrder, IsActive)
VALUES
    (@OriginationGroupId, 'ORIG-VOLUME', 'Origination Volume', 'Daily/weekly origination volume', 'SSRS', '/Lending/Origination/Volume', 1, 1),
    (@OriginationGroupId, 'ORIG-PIPELINE', 'Pipeline Report', 'Current pipeline status', 'SSRS', '/Lending/Origination/Pipeline', 2, 1);

INSERT INTO portal.Reports (ReportGroupId, ReportCode, ReportName, Description, ReportType, PowerBIWorkspaceId, PowerBIReportId, SortOrder, IsActive)
VALUES
    (@OriginationGroupId, 'ORIG-ANALYTICS', 'Origination Analytics', 'Interactive origination analytics', 'POWERBI', 'workspace-guid-here', 'report-guid-here', 3, 1);
GO

-- Verify
SELECT
    h.HubName,
    g.GroupName,
    r.ReportCode,
    r.ReportName,
    r.ReportType
FROM portal.Reports r
JOIN portal.ReportGroups g ON r.ReportGroupId = g.ReportGroupId
JOIN portal.ReportingHubs h ON g.HubId = h.HubId
ORDER BY h.SortOrder, g.SortOrder, r.SortOrder;
GO
```

---

## 8. Sample Report Department Access (Development/Testing)

Tags reports with department access, allowing users in those departments to view the reports.

```sql
-- Get department IDs
DECLARE @FinanceDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'FINANCE');
DECLARE @TreasuryDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'TREASURY');
DECLARE @AccountingDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'ACCOUNTING');
DECLARE @LendingDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'LENDING');
DECLARE @OperationsDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'OPERATIONS');
DECLARE @ExecutiveDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'EXECUTIVE');
DECLARE @EnterpriseDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'ENTERPRISE');

-- Get report IDs (assuming sample reports exist)
DECLARE @PLMonthlyId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'PL-MONTHLY');
DECLARE @BSMonthlyId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'BS-MONTHLY');
DECLARE @CFMonthlyId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'CF-MONTHLY');
DECLARE @QtrSummaryId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'QTR-SUMMARY');
DECLARE @QtrVarianceId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'QTR-VARIANCE');
DECLARE @ExecKPIId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'EXEC-KPI');
DECLARE @ExecFinancialId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'EXEC-FINANCIAL');
DECLARE @OrigVolumeId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'ORIG-VOLUME');
DECLARE @OrigPipelineId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'ORIG-PIPELINE');
DECLARE @OrigAnalyticsId INT = (SELECT ReportId FROM portal.Reports WHERE ReportCode = 'ORIG-ANALYTICS');

-- Finance department gets access to financial reports
IF @PLMonthlyId IS NOT NULL AND @FinanceDeptId IS NOT NULL
BEGIN
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@PLMonthlyId, @FinanceDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@BSMonthlyId, @FinanceDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@CFMonthlyId, @FinanceDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@QtrSummaryId, @FinanceDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@QtrVarianceId, @FinanceDeptId);
END

-- Treasury also gets P&L and Cash Flow
IF @PLMonthlyId IS NOT NULL AND @TreasuryDeptId IS NOT NULL
BEGIN
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@PLMonthlyId, @TreasuryDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@CFMonthlyId, @TreasuryDeptId);
END

-- Accounting gets Balance Sheet
IF @BSMonthlyId IS NOT NULL AND @AccountingDeptId IS NOT NULL
BEGIN
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@BSMonthlyId, @AccountingDeptId);
END

-- Lending department gets origination reports
IF @OrigVolumeId IS NOT NULL AND @LendingDeptId IS NOT NULL
BEGIN
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@OrigVolumeId, @LendingDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@OrigPipelineId, @LendingDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@OrigAnalyticsId, @LendingDeptId);
END

-- Operations also gets pipeline
IF @OrigPipelineId IS NOT NULL AND @OperationsDeptId IS NOT NULL
BEGIN
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@OrigPipelineId, @OperationsDeptId);
END

-- Executive gets executive dashboards
IF @ExecKPIId IS NOT NULL AND @ExecutiveDeptId IS NOT NULL
BEGIN
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@ExecKPIId, @ExecutiveDeptId);
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId) VALUES (@ExecFinancialId, @ExecutiveDeptId);
END

-- Enterprise gets all reports (enterprise-wide access)
IF @EnterpriseDeptId IS NOT NULL
BEGIN
    INSERT INTO portal.ReportDepartments (ReportId, DepartmentId)
    SELECT ReportId, @EnterpriseDeptId FROM portal.Reports WHERE IsActive = 1;
END
GO

-- Verify
SELECT
    r.ReportName,
    d.DepartmentName,
    rd.GrantedAt
FROM portal.ReportDepartments rd
JOIN portal.Reports r ON rd.ReportId = r.ReportId
JOIN portal.Departments d ON rd.DepartmentId = d.DepartmentId
ORDER BY r.ReportName, d.DepartmentName;
GO
```

---

## 9. Theme Options Reference

```sql
-- Reference: Available themes (not stored in DB, but for documentation)
-- These are defined in the Angular app (avatars.config.ts and theme.service.ts)

/*
Theme IDs:
- white     : Carbon White (light)
- g10       : Carbon Gray 10 (light)
- g90       : Carbon Gray 90 (dark)
- g100      : Carbon Gray 100 (dark)
- sequoia   : Sequoia brand theme
- corevest  : CoreVest brand theme
- enterprise: Enterprise brand theme

Avatar IDs:
- blue      : Blue avatar
- teal      : Teal avatar
- purple    : Purple avatar
- magenta   : Magenta avatar
- cyan      : Cyan avatar (initials)
- green     : Green avatar (initials)
*/
```

---

## 10. Create Initial Admin User (After First SSO Login)

```sql
-- After your first admin user logs in via SSO, grant them admin role:
-- Replace the EntraObjectId with the actual value from the Users table

/*
-- Find the user
SELECT UserId, EntraObjectId, Email, FirstName, LastName
FROM portal.Users
WHERE Email = 'admin@redwoodtrust.com';

-- Grant admin role
DECLARE @UserId INT = (SELECT UserId FROM portal.Users WHERE Email = 'admin@redwoodtrust.com');
DECLARE @AdminRoleId INT = (SELECT RoleId FROM portal.Roles WHERE RoleName = 'Admin');

INSERT INTO portal.UserRoles (UserId, RoleId, GrantedBy, GrantedAt)
VALUES (@UserId, @AdminRoleId, @UserId, GETUTCDATE());

-- Verify
SELECT u.Email, r.RoleName
FROM portal.UserRoles ur
JOIN portal.Users u ON ur.UserId = u.UserId
JOIN portal.Roles r ON ur.RoleId = r.RoleId;
*/
```

---

## 11. Grant Hub Access (Example)

```sql
-- Example: Grant a user access to specific hubs
/*
DECLARE @UserId INT = (SELECT UserId FROM portal.Users WHERE Email = 'user@redwoodtrust.com');
DECLARE @AdminUserId INT = (SELECT UserId FROM portal.Users WHERE Email = 'admin@redwoodtrust.com');
DECLARE @FinanceHubId INT = (SELECT HubId FROM portal.ReportingHubs WHERE HubCode = 'FINANCE');
DECLARE @OperationsHubId INT = (SELECT HubId FROM portal.ReportingHubs WHERE HubCode = 'OPERATIONS');

-- Grant access to Finance Hub (all reports in hub)
INSERT INTO portal.UserHubAccess (UserId, HubId, GrantedBy)
VALUES (@UserId, @FinanceHubId, @AdminUserId);

-- Grant access to Operations Hub
INSERT INTO portal.UserHubAccess (UserId, HubId, GrantedBy)
VALUES (@UserId, @OperationsHubId, @AdminUserId);

-- Verify user's hub access
SELECT
    u.Email,
    h.HubName,
    uha.GrantedAt
FROM portal.UserHubAccess uha
JOIN portal.Users u ON uha.UserId = u.UserId
JOIN portal.ReportingHubs h ON uha.HubId = h.HubId
WHERE u.UserId = @UserId;
*/
```

---

## 12. Assign User to Department (Example)

```sql
-- Example: Assign a user to departments
/*
DECLARE @UserId INT = (SELECT UserId FROM portal.Users WHERE Email = 'user@redwoodtrust.com');
DECLARE @AdminUserId INT = (SELECT UserId FROM portal.Users WHERE Email = 'admin@redwoodtrust.com');
DECLARE @FinanceDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'FINANCE');
DECLARE @TreasuryDeptId INT = (SELECT DepartmentId FROM portal.Departments WHERE DepartmentCode = 'TREASURY');

-- Assign user to Finance department
INSERT INTO portal.UserDepartments (UserId, DepartmentId, GrantedBy)
VALUES (@UserId, @FinanceDeptId, @AdminUserId);

-- Assign user to Treasury department
INSERT INTO portal.UserDepartments (UserId, DepartmentId, GrantedBy)
VALUES (@UserId, @TreasuryDeptId, @AdminUserId);

-- Verify user's department assignments
SELECT
    u.Email,
    d.DepartmentName,
    ud.GrantedAt,
    g.Email AS GrantedBy
FROM portal.UserDepartments ud
JOIN portal.Users u ON ud.UserId = u.UserId
JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId
LEFT JOIN portal.Users g ON ud.GrantedBy = g.UserId
WHERE u.UserId = @UserId;

-- View what reports the user can access via departments
SELECT DISTINCT
    r.ReportName,
    d.DepartmentName AS AccessVia
FROM portal.UserDepartments ud
JOIN portal.ReportDepartments rd ON ud.DepartmentId = rd.DepartmentId
JOIN portal.Reports r ON rd.ReportId = r.ReportId
JOIN portal.Departments d ON ud.DepartmentId = d.DepartmentId
WHERE ud.UserId = @UserId
ORDER BY r.ReportName;
*/
```

---

## 13. Sample Announcements (Development/Testing)

```sql
-- Sample announcements for development - modify or remove for production

-- Get an admin user ID for authorship (run after users exist)
-- DECLARE @AdminUserId INT = (SELECT TOP 1 UserId FROM portal.Users WHERE Email LIKE '%admin%');

-- For initial seed without users, we'll use NULL for AuthorId
INSERT INTO portal.Announcements (
    Title,
    Subtitle,
    Content,
    ImagePath,
    ReadTimeMinutes,
    IsFeatured,
    IsPublished,
    PublishedAt,
    AuthorId,
    AuthorName,
    CreatedAt
)
VALUES
    -- Featured announcement (latest)
    (
        'New Executive Dashboard Now Available',
        'New Feature',
        'We are excited to announce the launch of our new Executive Dashboard, providing real-time KPIs and business metrics at a glance.

## Key Features

- **Real-time Data**: Metrics update every 15 minutes
- **Customizable Widgets**: Drag and drop to personalize your view
- **Export Options**: Download reports in PDF, Excel, or PowerPoint formats
- **Mobile Responsive**: Access your dashboard on any device

Visit the Executive Hub to explore the new dashboard.',
        '/assets/images/announcements/executive-dashboard.jpg',
        3,
        1,  -- IsFeatured = true
        1,  -- IsPublished = true
        DATEADD(DAY, -2, GETUTCDATE()),  -- Published 2 days ago
        NULL,
        'IT Operations',
        DATEADD(DAY, -3, GETUTCDATE())
    ),
    -- Regular announcements
    (
        'Q4 Financial Reports Ready for Review',
        'Finance Update',
        'All Q4 2024 financial reports are now available in the Finance Hub. Please review and submit any questions to the Finance team by end of week.',
        '/assets/images/announcements/finance-reports.jpg',
        2,
        0,  -- IsFeatured = false
        1,  -- IsPublished = true
        DATEADD(DAY, -5, GETUTCDATE()),
        NULL,
        'Finance Team',
        DATEADD(DAY, -6, GETUTCDATE())
    ),
    (
        'Scheduled Maintenance: January 15th',
        'System Update',
        'The reporting portal will undergo scheduled maintenance on January 15th from 2:00 AM to 6:00 AM PST. During this time, reports may be temporarily unavailable.

## What to Expect

- Brief service interruptions
- No data loss expected
- New performance improvements after maintenance

Thank you for your patience.',
        '/assets/images/announcements/maintenance.jpg',
        2,
        0,
        1,
        DATEADD(DAY, -7, GETUTCDATE()),
        NULL,
        'IT Operations',
        DATEADD(DAY, -8, GETUTCDATE())
    ),
    (
        'New Lending Analytics Suite Launched',
        'Product Update',
        'The Lending Hub now features a comprehensive analytics suite with enhanced visualization capabilities and drill-down functionality.

Key improvements include:
- Portfolio segmentation analysis
- Risk trend visualization
- Comparative period analysis
- Custom date range selectors',
        '/assets/images/announcements/lending-analytics.jpg',
        4,
        0,
        1,
        DATEADD(DAY, -14, GETUTCDATE()),
        NULL,
        'Product Team',
        DATEADD(DAY, -15, GETUTCDATE())
    ),
    -- Draft announcement (not published)
    (
        'Upcoming: Enhanced Search Functionality',
        'Coming Soon',
        'We are working on enhanced search capabilities that will allow you to search across all reports and hubs simultaneously. Stay tuned for more details.',
        '/assets/images/announcements/search-feature.jpg',
        1,
        0,
        0,  -- IsPublished = false (draft)
        NULL,
        NULL,
        'Product Team',
        GETUTCDATE()
    );
GO

-- Verify
SELECT
    AnnouncementId,
    Title,
    Subtitle,
    IsFeatured,
    IsPublished,
    PublishedAt,
    AuthorName
FROM portal.Announcements
ORDER BY IsFeatured DESC, PublishedAt DESC;
GO
```

---

## 14. Cleanup Scripts (Development Only)

```sql
-- WARNING: Only use in development environments!
/*
-- Delete all sample data
DELETE FROM portal.Announcements;
DELETE FROM portal.Reports;
DELETE FROM portal.ReportGroups;
DELETE FROM portal.ReportingHubs;

-- Reset identity seeds
DBCC CHECKIDENT ('portal.Announcements', RESEED, 0);
DBCC CHECKIDENT ('portal.Reports', RESEED, 0);
DBCC CHECKIDENT ('portal.ReportGroups', RESEED, 0);
DBCC CHECKIDENT ('portal.ReportingHubs', RESEED, 0);
*/
```

---

## Summary

| Category | Data Seeded |
|----------|-------------|
| Companies | Redwood Trust, CoreVest |
| Roles | Admin, User |
| AppSettings | Security, Authentication, Application, Power BI, SSRS, Audit |
| Departments | Admin, IT, Treasury, Finance, Accounting, Enterprise, Lending, Operations, Compliance, HR, Executive |
| Hubs | Finance, Operations, Executive, Lending, Compliance, HR |
| Report Groups | Multiple per hub |
| Reports | Sample SSRS and Power BI reports |
| Report Department Access | Department-based access tags on sample reports |
| Announcements | 5 sample announcements (4 published, 1 draft) |

