# API Documentation

This document outlines the .NET API endpoints, authentication flows, and integration patterns for the RWT Reporting Portal.

---

## Table of Contents

1. [Authentication Flows](#1-authentication-flows)
2. [API Endpoints](#2-api-endpoints)
3. [Request/Response Formats](#3-requestresponse-formats)
4. [Error Handling](#4-error-handling)
5. [.NET Project Structure](#5-net-project-structure)
6. [Entra Configuration](#6-entra-configuration)

---

## 1. Authentication Flows

### 1.1 SSO Flow (Primary - OIDC)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Angular    │     │   .NET API   │     │  MS Entra    │     │  SQL Server  │
│   Frontend   │     │   Backend    │     │   (Azure AD) │     │   Database   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. Click Login     │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │ 2. Redirect to     │                    │                    │
       │    /api/auth/login │                    │                    │
       │<───────────────────│                    │                    │
       │                    │                    │                    │
       │ 3. Redirect to Entra login page         │                    │
       │─────────────────────────────────────────>                    │
       │                    │                    │                    │
       │ 4. User enters credentials              │                    │
       │    (Entra validates)                    │                    │
       │<─────────────────────────────────────────                    │
       │                    │                    │                    │
       │ 5. Redirect to /api/auth/callback       │                    │
       │    with authorization code              │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ 6. Exchange code   │                    │
       │                    │    for tokens      │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │ 7. Return ID token │                    │
       │                    │    + access token  │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │                    │ 8. Extract user info from token         │
       │                    │    (ObjectId, email, name, groups)      │
       │                    │                    │                    │
       │                    │ 9. Check if user   │                    │
       │                    │    exists locally  │                    │
       │                    │────────────────────────────────────────>│
       │                    │                    │                    │
       │                    │ 10. If new user,   │                    │
       │                    │     JIT provision  │                    │
       │                    │────────────────────────────────────────>│
       │                    │                    │                    │
       │                    │ 11. Create session │                    │
       │                    │────────────────────────────────────────>│
       │                    │                    │                    │
       │ 12. Return app JWT │                    │                    │
       │    + user data     │                    │                    │
       │<───────────────────│                    │                    │
       │                    │                    │                    │
       │ 13. Store JWT,     │                    │                    │
       │     redirect to    │                    │                    │
       │     dashboard      │                    │                    │
       └────────────────────┴────────────────────┴────────────────────┘
```

### 1.2 Password Fallback Flow (ROPC)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Angular    │     │   .NET API   │     │  MS Entra    │     │  SQL Server  │
│   Frontend   │     │   Backend    │     │   (Azure AD) │     │   Database   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. POST /api/auth/login                 │                    │
       │    {email, password}                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ 2. ROPC token      │                    │
       │                    │    request to Entra│                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │ 3. Validate creds, │                    │
       │                    │    return tokens   │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │                    │ 4-11. Same as SSO  │                    │
       │                    │    (extract info,  │                    │
       │                    │    JIT provision,  │                    │
       │                    │    create session) │                    │
       │                    │────────────────────────────────────────>│
       │                    │                    │                    │
       │ 12. Return app JWT │                    │                    │
       │    + user data     │                    │                    │
       │<───────────────────│                    │                    │
       └────────────────────┴────────────────────┴────────────────────┘
```

### 1.3 Token Refresh Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Angular    │     │   .NET API   │     │  SQL Server  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. Access token    │                    │
       │    expired         │                    │
       │                    │                    │
       │ 2. POST /api/auth/refresh               │
       │    {refreshToken}  │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ 3. Validate        │
       │                    │    refresh token   │
       │                    │───────────────────>│
       │                    │                    │
       │                    │ 4. Check user      │
       │                    │    still active    │
       │                    │───────────────────>│
       │                    │                    │
       │                    │ 5. Rotate refresh  │
       │                    │    token           │
       │                    │───────────────────>│
       │                    │                    │
       │ 6. Return new      │                    │
       │    access + refresh│                    │
       │    tokens          │                    │
       │<───────────────────│                    │
       └────────────────────┴────────────────────┘
```

---

## 2. API Endpoints

### 2.1 Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/auth/login` | Initiate SSO login (redirect to Entra) | No |
| `GET` | `/api/auth/callback` | Handle Entra SSO callback | No |
| `POST` | `/api/auth/login` | Password fallback login (ROPC) | No |
| `POST` | `/api/auth/logout` | End session, revoke tokens | Yes |
| `POST` | `/api/auth/refresh` | Refresh access token | No (refresh token) |
| `GET` | `/api/auth/me` | Get current user info | Yes |

### 2.2 User Profile

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/users/profile` | Get current user's profile | Yes |
| `PUT` | `/api/users/profile/avatar` | Update avatar | Yes |
| `PUT` | `/api/users/profile/display-name` | Update display name | Yes |
| `GET` | `/api/users/preferences` | Get user preferences | Yes |
| `PUT` | `/api/users/preferences` | Update preferences (theme, etc.) | Yes |

### 2.3 Reporting Hubs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/hubs` | List accessible hubs | Yes |
| `GET` | `/api/hubs/{hubId}` | Get hub details | Yes |
| `GET` | `/api/hubs/{hubId}/groups` | List report groups in hub | Yes |
| `GET` | `/api/hubs/{hubId}/reports` | List all reports in hub | Yes |

### 2.4 Report Groups

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/groups/{groupId}` | Get report group details | Yes |
| `GET` | `/api/groups/{groupId}/reports` | List reports in group | Yes |

### 2.5 Reports

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/reports/{reportId}` | Get report details | Yes |
| `GET` | `/api/reports/{reportId}/embed` | Get embed token/URL | Yes |
| `POST` | `/api/reports/{reportId}/access` | Log report access | Yes |

### 2.6 Favorites

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/favorites` | Get user's pinned reports | Yes |
| `POST` | `/api/favorites/{reportId}` | Pin a report | Yes |
| `DELETE` | `/api/favorites/{reportId}` | Unpin a report | Yes |
| `PUT` | `/api/favorites/reorder` | Reorder favorites | Yes |

### 2.7 Admin - Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/users` | List all users | Admin |
| `GET` | `/api/admin/users/{userId}` | Get user details | Admin |
| `PUT` | `/api/admin/users/{userId}/activate` | Activate user | Admin |
| `PUT` | `/api/admin/users/{userId}/deactivate` | Deactivate user | Admin |
| `PUT` | `/api/admin/users/{userId}/unlock` | Unlock user account | Admin |
| `PUT` | `/api/admin/users/{userId}/expire` | Expire user account | Admin |
| `PUT` | `/api/admin/users/{userId}/restore` | Restore expired user | Admin |

### 2.8 Admin - Permissions

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/users/{userId}/permissions` | Get user permissions | Admin |
| `POST` | `/api/admin/users/{userId}/permissions/hub` | Grant hub access | Admin |
| `POST` | `/api/admin/users/{userId}/permissions/group` | Grant group access | Admin |
| `POST` | `/api/admin/users/{userId}/permissions/report` | Grant report access | Admin |
| `DELETE` | `/api/admin/permissions/{permissionId}` | Revoke permission | Admin |

### 2.9 Admin - Content Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/hubs` | List all hubs | Admin |
| `POST` | `/api/admin/hubs` | Create hub | Admin |
| `PUT` | `/api/admin/hubs/{hubId}` | Update hub | Admin |
| `DELETE` | `/api/admin/hubs/{hubId}` | Delete hub | Admin |
| `PUT` | `/api/admin/hubs/reorder` | Reorder hubs | Admin |
| `GET` | `/api/admin/groups` | List all report groups | Admin |
| `POST` | `/api/admin/groups` | Create report group | Admin |
| `PUT` | `/api/admin/groups/{groupId}` | Update report group | Admin |
| `DELETE` | `/api/admin/groups/{groupId}` | Delete report group | Admin |
| `PUT` | `/api/admin/groups/{groupId}/move` | Move group to different hub | Admin |
| `PUT` | `/api/admin/groups/reorder` | Reorder groups within hub | Admin |
| `GET` | `/api/admin/reports` | List all reports | Admin |
| `POST` | `/api/admin/reports` | Create report | Admin |
| `PUT` | `/api/admin/reports/{reportId}` | Update report | Admin |
| `DELETE` | `/api/admin/reports/{reportId}` | Delete report | Admin |
| `PUT` | `/api/admin/reports/{reportId}/move` | Move report to different group | Admin |
| `PUT` | `/api/admin/reports/reorder` | Reorder reports within group | Admin |
| `POST` | `/api/admin/reports/bulk-import` | Bulk import reports | Admin |

### 2.10 Admin - Departments

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/departments` | List all departments | Admin |
| `POST` | `/api/admin/departments` | Create department | Admin |
| `PUT` | `/api/admin/departments/{departmentId}` | Update department | Admin |
| `DELETE` | `/api/admin/departments/{departmentId}` | Delete department | Admin |
| `PUT` | `/api/admin/departments/reorder` | Reorder departments | Admin |
| `GET` | `/api/admin/departments/{departmentId}/users` | List users in department | Admin |
| `GET` | `/api/admin/departments/{departmentId}/reports` | List reports with department access | Admin |

### 2.11 Admin - User Departments

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/users/{userId}/departments` | Get user's department memberships | Admin |
| `POST` | `/api/admin/users/{userId}/departments` | Assign user to department | Admin |
| `DELETE` | `/api/admin/users/{userId}/departments/{departmentId}` | Remove user from department | Admin |

### 2.12 Admin - Report Department Access

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/reports/{reportId}/departments` | Get report's department access | Admin |
| `POST` | `/api/admin/reports/{reportId}/departments` | Add department access to report | Admin |
| `DELETE` | `/api/admin/reports/{reportId}/departments/{departmentId}` | Remove department access from report | Admin |
| `PUT` | `/api/admin/reports/{reportId}/departments` | Replace all department access | Admin |

### 2.13 Power BI Discovery

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/powerbi/workspaces` | List Power BI workspaces | Admin |
| `GET` | `/api/admin/powerbi/workspaces/{id}/reports` | List reports in workspace | Admin |
| `POST` | `/api/admin/powerbi/import` | Import Power BI reports | Admin |

### 2.14 Admin - Audit

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/audit-log` | Search audit logs | Admin |
| `GET` | `/api/admin/login-history` | View login history | Admin |
| `GET` | `/api/admin/report-access` | View report access logs | Admin |

### 2.15 User Statistics

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/users/stats` | Get dashboard statistics | Yes |

### 2.16 Announcements (Public)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/announcements` | Get published announcements | Yes |
| `GET` | `/api/announcements/{id}` | Get announcement details | Yes |

### 2.17 Admin - Announcements

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/announcements` | List all announcements | Admin |
| `GET` | `/api/admin/announcements/{id}` | Get announcement details | Admin |
| `POST` | `/api/admin/announcements` | Create announcement | Admin |
| `PUT` | `/api/admin/announcements/{id}` | Update announcement | Admin |
| `PUT` | `/api/admin/announcements/{id}/publish` | Publish announcement | Admin |
| `PUT` | `/api/admin/announcements/{id}/unpublish` | Unpublish announcement | Admin |
| `DELETE` | `/api/admin/announcements/{id}` | Soft delete announcement | Admin |
| `PUT` | `/api/admin/announcements/{id}/restore` | Restore deleted announcement | Admin |

---

## 3. Request/Response Formats

### 3.1 Authentication

#### POST /api/auth/login (Password Fallback)

**Request:**
```json
{
  "email": "user@redwoodtrust.com",
  "password": "********"
}
```

**Response (Success):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl...",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "userId": 123,
    "email": "user@redwoodtrust.com",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "John Doe",
    "avatarId": "blue",
    "company": "Redwood Trust",
    "roles": ["User"],
    "isAdmin": false
  }
}
```

**Response (Error - Invalid Credentials):**
```json
{
  "error": "invalid_credentials",
  "message": "Invalid email or password",
  "remainingAttempts": 3
}
```

**Response (Error - Account Locked):**
```json
{
  "error": "account_locked",
  "message": "Account is locked due to too many failed attempts",
  "lockedUntil": "2024-01-15T10:30:00Z"
}
```

**Response (Error - Account Expired):**
```json
{
  "error": "account_expired",
  "message": "Your account has been expired. Please contact an administrator to restore access.",
  "expiredAt": "2024-01-10T09:00:00Z"
}
```

#### GET /api/auth/me

**Response:**
```json
{
  "userId": 123,
  "email": "user@redwoodtrust.com",
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "John Doe",
  "avatarId": "blue",
  "company": "Redwood Trust",
  "companyId": 1,
  "roles": ["User"],
  "isAdmin": false,
  "preferences": {
    "themeId": "white",
    "tableRowSize": "md"
  },
  "departments": [
    {
      "departmentId": 3,
      "departmentCode": "FINANCE",
      "departmentName": "Finance"
    }
  ],
  "permissions": {
    "hubs": [1, 2, 3],
    "reportGroups": [5, 6],
    "reports": [10, 11, 12]
  }
}
```

#### POST /api/auth/refresh

**Request:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "bmV3IHJlZnJlc2ggdG9r...",
  "expiresIn": 900
}
```

### 3.2 User Profile

#### PUT /api/users/profile/avatar

**Request:**
```json
{
  "avatarId": "teal"
}
```

**Response:**
```json
{
  "success": true,
  "avatarId": "teal"
}
```

#### PUT /api/users/preferences

**Request:**
```json
{
  "themeId": "g100",
  "tableRowSize": "sm"
}
```

**Response:**
```json
{
  "success": true,
  "preferences": {
    "themeId": "g100",
    "tableRowSize": "sm"
  }
}
```

### 3.3 Hubs & Reports

#### GET /api/hubs

**Response:**
```json
{
  "hubs": [
    {
      "hubId": 1,
      "hubCode": "FINANCE",
      "hubName": "Finance Hub",
      "description": "Financial reports and analytics",
      "iconName": "finance",
      "backgroundImage": "/assets/images/finance-bg.jpg",
      "reportCount": 15
    },
    {
      "hubId": 2,
      "hubCode": "OPERATIONS",
      "hubName": "Operations Hub",
      "description": "Operational metrics and KPIs",
      "iconName": "analytics",
      "backgroundImage": "/assets/images/ops-bg.jpg",
      "reportCount": 8
    }
  ]
}
```

#### GET /api/hubs/{hubId}/reports

**Response:**
```json
{
  "hubId": 1,
  "hubName": "Finance Hub",
  "reports": [
    {
      "reportId": 101,
      "reportCode": "PL-MONTHLY",
      "reportName": "Monthly P&L Statement",
      "description": "Profit and loss for the month",
      "reportType": "SSRS",
      "groupId": 1,
      "groupName": "Monthly Reports",
      "accessLevel": "Hub"
    },
    {
      "reportId": 102,
      "reportCode": "EXEC-KPI",
      "reportName": "Executive KPI Dashboard",
      "description": "Key performance indicators",
      "reportType": "POWERBI",
      "groupId": 2,
      "groupName": "Dashboards",
      "accessLevel": "Report"
    }
  ]
}
```

#### GET /api/reports/{reportId}/embed

**Response (Power BI):**
```json
{
  "reportId": 102,
  "reportType": "POWERBI",
  "embedUrl": "https://app.powerbi.com/reportEmbed?reportId=...",
  "embedToken": "H4sIAAAAAAAEAB2W...",
  "tokenExpiry": "2024-01-15T11:00:00Z"
}
```

**Response (SSRS):**
```json
{
  "reportId": 101,
  "reportType": "SSRS",
  "reportUrl": "https://ssrs.redwoodtrust.com/ReportServer?/Finance/Monthly/PL_Statement&rs:Embed=true",
  "parameters": [
    {
      "name": "ReportMonth",
      "type": "DateTime",
      "required": true
    }
  ]
}
```

### 3.4 Admin - Users

#### GET /api/admin/users

**Query Parameters:**
- `page` (int, default: 1)
- `pageSize` (int, default: 50)
- `search` (string, optional)
- `companyId` (int, optional)
- `includeInactive` (bool, default: true)
- `includeExpired` (bool, default: false)

**Response:**
```json
{
  "users": [
    {
      "userId": 123,
      "email": "john.doe@redwoodtrust.com",
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "John Doe",
      "company": "Redwood Trust",
      "roles": ["User"],
      "isActive": true,
      "isExpired": false,
      "expiredAt": null,
      "expirationReason": null,
      "isLockedOut": false,
      "lastLoginAt": "2024-01-14T15:30:00Z",
      "loginCount": 45,
      "createdAt": "2023-06-01T09:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 50,
    "totalCount": 150,
    "totalPages": 3
  }
}
```

#### GET /api/admin/users/{userId}/permissions

**Response:**
```json
{
  "userId": 123,
  "email": "john.doe@redwoodtrust.com",
  "isAdmin": false,
  "departments": [
    {
      "userDepartmentId": 1,
      "departmentId": 3,
      "departmentCode": "FINANCE",
      "departmentName": "Finance",
      "grantedAt": "2024-01-05T09:00:00Z",
      "grantedBy": "admin@redwoodtrust.com"
    },
    {
      "userDepartmentId": 2,
      "departmentId": 4,
      "departmentCode": "TREASURY",
      "departmentName": "Treasury",
      "grantedAt": "2024-01-05T09:00:00Z",
      "grantedBy": "admin@redwoodtrust.com"
    }
  ],
  "permissions": {
    "hubs": [
      {
        "permissionId": 1,
        "hubId": 1,
        "hubName": "Finance Hub",
        "grantedAt": "2024-01-10T09:00:00Z",
        "grantedBy": "admin@redwoodtrust.com",
        "expiresAt": null
      }
    ],
    "reportGroups": [
      {
        "permissionId": 5,
        "reportGroupId": 3,
        "groupName": "Executive Reports",
        "hubName": "Executive Hub",
        "grantedAt": "2024-01-12T14:00:00Z",
        "grantedBy": "admin@redwoodtrust.com",
        "expiresAt": "2024-12-31T23:59:59Z"
      }
    ],
    "reports": []
  }
}
```

#### POST /api/admin/users/{userId}/permissions/hub

**Request:**
```json
{
  "hubId": 2,
  "expiresAt": null
}
```

**Response:**
```json
{
  "success": true,
  "permissionId": 10,
  "message": "Hub access granted successfully"
}
```

#### PUT /api/admin/users/{userId}/expire

Expires a user account. The account is preserved but the user cannot login until restored.

**Request:**
```json
{
  "reason": "Employee no longer with company"
}
```

**Response:**
```json
{
  "success": true,
  "userId": 123,
  "isExpired": true,
  "expiredAt": "2024-01-15T10:00:00Z",
  "message": "User account has been expired"
}
```

#### PUT /api/admin/users/{userId}/restore

Restores a previously expired user account, allowing them to login again.

**Response:**
```json
{
  "success": true,
  "userId": 123,
  "isExpired": false,
  "isActive": true,
  "message": "User account has been restored"
}
```

### 3.5 User Statistics

#### GET /api/users/stats

**Response:**
```json
{
  "availableReports": 89,
  "pinnedFavorites": 12,
  "recentViews": 24
}
```

### 3.6 Announcements

#### GET /api/announcements

**Query Parameters:**
- `limit` (int, default: 10) - Number of announcements to return

**Response:**
```json
{
  "announcements": [
    {
      "announcementId": 1,
      "title": "Scheduled System Maintenance This Weekend",
      "subtitle": "System Update",
      "content": "We will be performing scheduled maintenance...",
      "imagePath": "/assets/images/announcements/maintenance.jpg",
      "readTimeMinutes": 2,
      "isFeatured": true,
      "authorName": "IT Operations",
      "publishedAt": "2025-11-18T09:00:00Z"
    },
    {
      "announcementId": 2,
      "title": "Enhanced Dashboard Capabilities Now Available",
      "subtitle": "New Feature",
      "content": "We're excited to announce new dashboard features...",
      "imagePath": "/assets/images/announcements/feature.jpg",
      "readTimeMinutes": 4,
      "isFeatured": false,
      "authorName": "Product Team",
      "publishedAt": "2025-11-15T14:00:00Z"
    }
  ]
}
```

#### GET /api/admin/announcements

**Query Parameters:**
- `page` (int, default: 1)
- `pageSize` (int, default: 20)
- `includeUnpublished` (bool, default: true)
- `includeDeleted` (bool, default: false)

**Response:**
```json
{
  "announcements": [
    {
      "announcementId": 1,
      "title": "Scheduled System Maintenance This Weekend",
      "subtitle": "System Update",
      "content": "We will be performing scheduled maintenance...",
      "imagePath": "/assets/images/announcements/maintenance.jpg",
      "readTimeMinutes": 2,
      "isFeatured": true,
      "isPublished": true,
      "publishedAt": "2025-11-18T09:00:00Z",
      "authorId": 5,
      "authorName": "IT Operations",
      "authorEmail": "admin@redwoodtrust.com",
      "createdAt": "2025-11-17T10:00:00Z",
      "updatedAt": "2025-11-17T15:30:00Z",
      "isDeleted": false
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalCount": 8,
    "totalPages": 1
  }
}
```

#### POST /api/admin/announcements

**Request:**
```json
{
  "title": "New Report Dashboard Available",
  "subtitle": "New Feature",
  "content": "We are excited to announce a new reporting dashboard...",
  "imagePath": "/assets/images/announcements/dashboard.jpg",
  "readTimeMinutes": 3,
  "isFeatured": false,
  "isPublished": false,
  "authorName": "Product Team"
}
```

**Response:**
```json
{
  "announcementId": 9,
  "title": "New Report Dashboard Available",
  "subtitle": "New Feature",
  "content": "We are excited to announce a new reporting dashboard...",
  "imagePath": "/assets/images/announcements/dashboard.jpg",
  "readTimeMinutes": 3,
  "isFeatured": false,
  "isPublished": false,
  "publishedAt": null,
  "authorId": 5,
  "authorName": "Product Team",
  "createdAt": "2025-11-28T10:00:00Z"
}
```

#### PUT /api/admin/announcements/{id}

**Request:**
```json
{
  "title": "Updated: New Report Dashboard Available",
  "content": "Updated content here...",
  "isFeatured": true
}
```

**Response:**
```json
{
  "announcementId": 9,
  "title": "Updated: New Report Dashboard Available",
  "subtitle": "New Feature",
  "content": "Updated content here...",
  "imagePath": "/assets/images/announcements/dashboard.jpg",
  "readTimeMinutes": 3,
  "isFeatured": true,
  "isPublished": false,
  "publishedAt": null,
  "authorId": 5,
  "authorName": "Product Team",
  "createdAt": "2025-11-28T10:00:00Z",
  "updatedAt": "2025-11-28T11:00:00Z"
}
```

#### PUT /api/admin/announcements/{id}/publish

**Response:**
```json
{
  "success": true,
  "announcementId": 9,
  "isPublished": true,
  "publishedAt": "2025-11-28T12:00:00Z"
}
```

### 3.7 Admin - Hubs

#### GET /api/admin/hubs

**Query Parameters:**
- `includeInactive` (bool, default: false)
- `search` (string, optional)

**Response:**
```json
{
  "hubs": [
    {
      "hubId": 1,
      "hubCode": "FINANCE",
      "hubName": "Finance Hub",
      "description": "Financial reports and analytics",
      "iconName": "finance",
      "backgroundImage": "/assets/images/finance-bg.jpg",
      "sortOrder": 1,
      "isActive": true,
      "groupCount": 3,
      "reportCount": 15,
      "createdAt": "2024-01-01T09:00:00Z",
      "createdByEmail": "admin@redwoodtrust.com"
    }
  ]
}
```

#### POST /api/admin/hubs

**Request:**
```json
{
  "hubCode": "OPERATIONS",
  "hubName": "Operations Hub",
  "description": "Operational metrics and KPIs",
  "iconName": "analytics",
  "backgroundImage": "/assets/images/ops-bg.jpg"
}
```

**Response:**
```json
{
  "hubId": 2,
  "hubCode": "OPERATIONS",
  "hubName": "Operations Hub",
  "description": "Operational metrics and KPIs",
  "iconName": "analytics",
  "backgroundImage": "/assets/images/ops-bg.jpg",
  "sortOrder": 2,
  "isActive": true,
  "groupCount": 0,
  "reportCount": 0,
  "createdAt": "2024-01-15T10:00:00Z",
  "createdByEmail": "admin@redwoodtrust.com"
}
```

#### PUT /api/admin/hubs/{hubId}

**Request:**
```json
{
  "hubName": "Operations & Analytics Hub",
  "description": "Updated description",
  "isActive": true
}
```

**Response:** Same as POST response with updated values.

#### DELETE /api/admin/hubs/{hubId}

**Query Parameters:**
- `hardDelete` (bool, default: false) - If true, permanently deletes (only if no groups/reports exist)

**Response:**
```json
{
  "success": true
}
```

#### PUT /api/admin/hubs/reorder

**Request:**
```json
{
  "hubIds": [3, 1, 2, 5]
}
```

**Response:** Returns updated hub list.

### 3.8 Admin - Report Groups

#### GET /api/admin/groups

**Query Parameters:**
- `hubId` (int, optional) - Filter by hub
- `includeInactive` (bool, default: false)
- `search` (string, optional)

**Response:**
```json
{
  "groups": [
    {
      "reportGroupId": 1,
      "hubId": 1,
      "hubName": "Finance Hub",
      "groupCode": "MONTHLY",
      "groupName": "Monthly Reports",
      "description": "End of month financial reports",
      "sortOrder": 1,
      "isActive": true,
      "reportCount": 5,
      "createdAt": "2024-01-01T09:00:00Z",
      "createdByEmail": "admin@redwoodtrust.com"
    }
  ]
}
```

#### POST /api/admin/groups

**Request:**
```json
{
  "hubId": 1,
  "groupCode": "QUARTERLY",
  "groupName": "Quarterly Reports",
  "description": "Quarterly financial summaries"
}
```

**Response:**
```json
{
  "reportGroupId": 2,
  "hubId": 1,
  "hubName": "Finance Hub",
  "groupCode": "QUARTERLY",
  "groupName": "Quarterly Reports",
  "description": "Quarterly financial summaries",
  "sortOrder": 2,
  "isActive": true,
  "reportCount": 0,
  "createdAt": "2024-01-15T10:00:00Z",
  "createdByEmail": "admin@redwoodtrust.com"
}
```

#### PUT /api/admin/groups/{groupId}

**Request:**
```json
{
  "groupName": "Quarterly Financial Reports",
  "description": "Updated description"
}
```

**Response:** Same as POST response with updated values.

#### DELETE /api/admin/groups/{groupId}

**Query Parameters:**
- `hardDelete` (bool, default: false)

**Response:**
```json
{
  "success": true
}
```

#### PUT /api/admin/groups/{groupId}/move

**Request:**
```json
{
  "newHubId": 2
}
```

**Response:** Returns updated group.

#### PUT /api/admin/groups/reorder

**Request:**
```json
{
  "hubId": 1,
  "groupIds": [3, 1, 2]
}
```

**Response:** Returns updated group list for the hub.

### 3.9 Admin - Reports

#### GET /api/admin/reports

**Query Parameters:**
- `hubId` (int, optional)
- `reportGroupId` (int, optional)
- `reportType` (string, optional) - "POWERBI" or "SSRS"
- `includeInactive` (bool, default: false)
- `search` (string, optional)
- `page` (int, default: 1)
- `pageSize` (int, default: 50)

**Response:**
```json
{
  "reports": [
    {
      "reportId": 101,
      "reportGroupId": 1,
      "groupName": "Monthly Reports",
      "hubId": 1,
      "hubName": "Finance Hub",
      "reportCode": "PL-MONTHLY",
      "reportName": "Monthly P&L Statement",
      "description": "Profit and loss for the month",
      "reportType": "SSRS",
      "powerBIWorkspaceId": null,
      "powerBIReportId": null,
      "ssrsReportPath": "/Finance/Monthly/PL_Statement",
      "ssrsReportServer": "https://ssrs.redwoodtrust.com/ReportServer",
      "parameters": null,
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2024-01-01T09:00:00Z",
      "createdByEmail": "admin@redwoodtrust.com"
    },
    {
      "reportId": 102,
      "reportGroupId": 2,
      "groupName": "Dashboards",
      "hubId": 1,
      "hubName": "Finance Hub",
      "reportCode": "EXEC-KPI",
      "reportName": "Executive KPI Dashboard",
      "description": "Key performance indicators",
      "reportType": "POWERBI",
      "powerBIWorkspaceId": "abc123-workspace-id",
      "powerBIReportId": "def456-report-id",
      "ssrsReportPath": null,
      "ssrsReportServer": null,
      "parameters": null,
      "sortOrder": 1,
      "isActive": true,
      "departmentAccess": [
        {
          "departmentId": 6,
          "departmentCode": "EXECUTIVE",
          "departmentName": "Executive"
        }
      ],
      "createdAt": "2024-01-02T09:00:00Z",
      "createdByEmail": "admin@redwoodtrust.com"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 50,
    "totalCount": 2,
    "totalPages": 1
  }
}
```

#### POST /api/admin/reports

**Request (Power BI):**
```json
{
  "reportGroupId": 2,
  "reportCode": "SALES-DASH",
  "reportName": "Sales Dashboard",
  "description": "Real-time sales analytics",
  "reportType": "POWERBI",
  "powerBIWorkspaceId": "abc123-workspace-id",
  "powerBIReportId": "xyz789-report-id"
}
```

**Request (SSRS):**
```json
{
  "reportGroupId": 1,
  "reportCode": "BS-MONTHLY",
  "reportName": "Monthly Balance Sheet",
  "description": "End of month balance sheet",
  "reportType": "SSRS",
  "ssrsReportPath": "/Finance/Monthly/Balance_Sheet",
  "ssrsReportServer": "https://ssrs.redwoodtrust.com/ReportServer",
  "parameters": "[{\"name\": \"ReportMonth\", \"type\": \"DateTime\", \"required\": true}]"
}
```

**Response:** Returns created report object (same structure as GET response).

#### PUT /api/admin/reports/{reportId}

**Request:**
```json
{
  "reportName": "Updated Report Name",
  "description": "Updated description",
  "isActive": true
}
```

**Response:** Returns updated report object.

#### DELETE /api/admin/reports/{reportId}

**Query Parameters:**
- `hardDelete` (bool, default: false)

**Response:**
```json
{
  "success": true
}
```

#### PUT /api/admin/reports/{reportId}/move

**Request:**
```json
{
  "newReportGroupId": 3
}
```

**Response:** Returns updated report.

#### PUT /api/admin/reports/reorder

**Request:**
```json
{
  "reportGroupId": 1,
  "reportIds": [103, 101, 102]
}
```

**Response:** Returns updated report list for the group.

#### POST /api/admin/reports/bulk-import

**Request:**
```json
{
  "reportGroupId": 2,
  "reports": [
    {
      "reportCode": "REPORT-001",
      "reportName": "Sales Report",
      "description": "Weekly sales data",
      "reportType": "POWERBI",
      "powerBIWorkspaceId": "workspace-id",
      "powerBIReportId": "report-id-1"
    },
    {
      "reportCode": "REPORT-002",
      "reportName": "Inventory Report",
      "description": "Current inventory levels",
      "reportType": "POWERBI",
      "powerBIWorkspaceId": "workspace-id",
      "powerBIReportId": "report-id-2"
    }
  ]
}
```

**Response:**
```json
{
  "importedCount": 2,
  "skippedCount": 0,
  "reports": [...]
}
```

### 3.10 Admin - Departments

#### GET /api/admin/departments

**Query Parameters:**
- `includeInactive` (bool, default: false)
- `search` (string, optional)

**Response:**
```json
{
  "departments": [
    {
      "departmentId": 1,
      "departmentCode": "ADMIN",
      "departmentName": "Admin",
      "description": "System administrators with full access",
      "sortOrder": 1,
      "isActive": true,
      "userCount": 3,
      "reportCount": 0,
      "createdAt": "2024-01-01T09:00:00Z",
      "createdByEmail": "system"
    },
    {
      "departmentId": 2,
      "departmentCode": "FINANCE",
      "departmentName": "Finance",
      "description": "Financial planning and analysis",
      "sortOrder": 2,
      "isActive": true,
      "userCount": 15,
      "reportCount": 12,
      "createdAt": "2024-01-01T09:00:00Z",
      "createdByEmail": "admin@redwoodtrust.com"
    }
  ]
}
```

#### POST /api/admin/departments

**Request:**
```json
{
  "departmentCode": "COMPLIANCE",
  "departmentName": "Compliance",
  "description": "Regulatory compliance team"
}
```

**Response:**
```json
{
  "departmentId": 10,
  "departmentCode": "COMPLIANCE",
  "departmentName": "Compliance",
  "description": "Regulatory compliance team",
  "sortOrder": 10,
  "isActive": true,
  "userCount": 0,
  "reportCount": 0,
  "createdAt": "2024-01-15T10:00:00Z",
  "createdByEmail": "admin@redwoodtrust.com"
}
```

#### PUT /api/admin/departments/{departmentId}

**Request:**
```json
{
  "departmentName": "Compliance & Risk",
  "description": "Updated description",
  "isActive": true
}
```

**Response:** Same as POST response with updated values.

#### DELETE /api/admin/departments/{departmentId}

**Query Parameters:**
- `hardDelete` (bool, default: false) - If true, permanently deletes (only if no users/reports assigned)

**Response:**
```json
{
  "success": true
}
```

#### PUT /api/admin/departments/reorder

**Request:**
```json
{
  "departmentIds": [3, 1, 2, 5, 4]
}
```

**Response:** Returns updated department list.

#### GET /api/admin/departments/{departmentId}/users

**Response:**
```json
{
  "departmentId": 2,
  "departmentName": "Finance",
  "users": [
    {
      "userId": 123,
      "email": "john.doe@redwoodtrust.com",
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "John Doe",
      "grantedAt": "2024-01-10T09:00:00Z",
      "grantedBy": "admin@redwoodtrust.com"
    }
  ]
}
```

#### GET /api/admin/departments/{departmentId}/reports

**Response:**
```json
{
  "departmentId": 2,
  "departmentName": "Finance",
  "reports": [
    {
      "reportId": 101,
      "reportCode": "PL-MONTHLY",
      "reportName": "Monthly P&L Statement",
      "hubName": "Finance Hub",
      "groupName": "Monthly Reports",
      "grantedAt": "2024-01-10T09:00:00Z",
      "grantedBy": "admin@redwoodtrust.com"
    }
  ]
}
```

### 3.11 Admin - User Departments

#### GET /api/admin/users/{userId}/departments

**Response:**
```json
{
  "userId": 123,
  "email": "john.doe@redwoodtrust.com",
  "departments": [
    {
      "userDepartmentId": 1,
      "departmentId": 2,
      "departmentCode": "FINANCE",
      "departmentName": "Finance",
      "grantedAt": "2024-01-10T09:00:00Z",
      "grantedBy": "admin@redwoodtrust.com"
    }
  ]
}
```

#### POST /api/admin/users/{userId}/departments

**Request:**
```json
{
  "departmentId": 3
}
```

**Response:**
```json
{
  "success": true,
  "userDepartmentId": 5,
  "message": "User assigned to department successfully"
}
```

#### DELETE /api/admin/users/{userId}/departments/{departmentId}

**Response:**
```json
{
  "success": true,
  "message": "User removed from department successfully"
}
```

### 3.12 Admin - Report Department Access

#### GET /api/admin/reports/{reportId}/departments

**Response:**
```json
{
  "reportId": 101,
  "reportName": "Monthly P&L Statement",
  "departments": [
    {
      "reportDepartmentId": 1,
      "departmentId": 2,
      "departmentCode": "FINANCE",
      "departmentName": "Finance",
      "grantedAt": "2024-01-10T09:00:00Z",
      "grantedBy": "admin@redwoodtrust.com"
    },
    {
      "reportDepartmentId": 2,
      "departmentId": 3,
      "departmentCode": "TREASURY",
      "departmentName": "Treasury",
      "grantedAt": "2024-01-10T09:00:00Z",
      "grantedBy": "admin@redwoodtrust.com"
    }
  ]
}
```

#### POST /api/admin/reports/{reportId}/departments

**Request:**
```json
{
  "departmentId": 4
}
```

**Response:**
```json
{
  "success": true,
  "reportDepartmentId": 10,
  "message": "Department access added to report"
}
```

#### DELETE /api/admin/reports/{reportId}/departments/{departmentId}

**Response:**
```json
{
  "success": true,
  "message": "Department access removed from report"
}
```

#### PUT /api/admin/reports/{reportId}/departments

Replaces all department access for a report.

**Request:**
```json
{
  "departmentIds": [2, 3, 5]
}
```

**Response:**
```json
{
  "success": true,
  "reportId": 101,
  "departments": [
    {
      "reportDepartmentId": 11,
      "departmentId": 2,
      "departmentName": "Finance"
    },
    {
      "reportDepartmentId": 12,
      "departmentId": 3,
      "departmentName": "Treasury"
    },
    {
      "reportDepartmentId": 13,
      "departmentId": 5,
      "departmentName": "Accounting"
    }
  ]
}
```

### 3.13 Power BI Discovery

#### GET /api/admin/powerbi/workspaces

Lists all Power BI workspaces accessible by the service principal.

**Response:**
```json
{
  "workspaces": [
    {
      "workspaceId": "abc123-workspace-id",
      "workspaceName": "Finance Reports",
      "reportCount": 15
    },
    {
      "workspaceId": "def456-workspace-id",
      "workspaceName": "Operations Reports",
      "reportCount": 8
    }
  ]
}
```

#### GET /api/admin/powerbi/workspaces/{workspaceId}/reports

Lists all reports in a Power BI workspace.

**Response:**
```json
{
  "workspaceId": "abc123-workspace-id",
  "workspaceName": "Finance Reports",
  "reports": [
    {
      "reportId": "report-guid-1",
      "reportName": "Monthly P&L",
      "datasetId": "dataset-guid-1",
      "embedUrl": "https://app.powerbi.com/reportEmbed?reportId=...",
      "alreadyImported": false
    },
    {
      "reportId": "report-guid-2",
      "reportName": "Executive Dashboard",
      "datasetId": "dataset-guid-2",
      "embedUrl": "https://app.powerbi.com/reportEmbed?reportId=...",
      "alreadyImported": true,
      "existingReportId": 102
    }
  ]
}
```

#### POST /api/admin/powerbi/import

Imports selected Power BI reports to a report group.

**Request:**
```json
{
  "reportGroupId": 2,
  "reports": [
    {
      "workspaceId": "abc123-workspace-id",
      "reportId": "report-guid-1",
      "reportCode": "PL-MONTHLY",
      "reportName": "Monthly P&L",
      "description": "Optional description override"
    },
    {
      "workspaceId": "abc123-workspace-id",
      "reportId": "report-guid-3",
      "reportCode": "CASHFLOW",
      "reportName": "Cash Flow Analysis"
    }
  ]
}
```

**Response:**
```json
{
  "importedCount": 2,
  "skippedCount": 0,
  "reports": [...]
}
```

---

## 4. Error Handling

### 4.1 Standard Error Response

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {},
  "traceId": "abc123"
}
```

### 4.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_credentials` | 401 | Invalid email or password |
| `account_locked` | 403 | Account is locked |
| `account_inactive` | 403 | Account is deactivated |
| `account_expired` | 403 | Account has been expired (contact admin to restore) |
| `token_expired` | 401 | Access token has expired |
| `token_invalid` | 401 | Token is invalid or malformed |
| `refresh_token_expired` | 401 | Refresh token has expired |
| `session_expired` | 401 | Session has expired (idle timeout) |
| `unauthorized` | 401 | Not authenticated |
| `forbidden` | 403 | Not authorized for this resource |
| `not_found` | 404 | Resource not found |
| `validation_error` | 400 | Request validation failed |
| `server_error` | 500 | Internal server error |

### 4.3 Validation Error Response

```json
{
  "error": "validation_error",
  "message": "One or more validation errors occurred",
  "details": {
    "email": ["Email is required", "Invalid email format"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

---

## 5. .NET Project Structure

### 5.1 Recommended Structure

```
RWTReportingPortal.API/
├── Controllers/
│   ├── AuthController.cs
│   ├── UsersController.cs
│   ├── HubsController.cs
│   ├── ReportsController.cs
│   ├── FavoritesController.cs
│   ├── AnnouncementsController.cs
│   └── Admin/
│       ├── AdminUsersController.cs
│       ├── AdminPermissionsController.cs
│       ├── AdminHubsController.cs
│       ├── AdminAnnouncementsController.cs
│       └── AdminAuditController.cs
├── Services/
│   ├── IAuthService.cs
│   ├── AuthService.cs
│   ├── IUserService.cs
│   ├── UserService.cs
│   ├── IPermissionService.cs
│   ├── PermissionService.cs
│   ├── IReportService.cs
│   ├── ReportService.cs
│   ├── IAnnouncementService.cs
│   ├── AnnouncementService.cs
│   ├── IUserStatsService.cs
│   ├── UserStatsService.cs
│   ├── IPowerBIService.cs
│   ├── PowerBIService.cs
│   ├── ISSRSService.cs
│   └── SSRSService.cs
├── Models/
│   ├── DTOs/
│   │   ├── Auth/
│   │   ├── Users/
│   │   ├── Reports/
│   │   ├── Announcements/
│   │   ├── Statistics/
│   │   └── Admin/
│   ├── Entities/
│   └── Enums/
├── Data/
│   ├── ApplicationDbContext.cs
│   └── Repositories/
│       ├── IUserRepository.cs
│       ├── UserRepository.cs
│       ├── IReportRepository.cs
│       └── ReportRepository.cs
├── Infrastructure/
│   ├── Auth/
│   │   ├── JwtTokenService.cs
│   │   ├── EntraAuthService.cs
│   │   └── TokenValidationMiddleware.cs
│   ├── Middleware/
│   │   ├── ErrorHandlingMiddleware.cs
│   │   ├── ActivityTrackingMiddleware.cs
│   │   └── AuditLoggingMiddleware.cs
│   └── Extensions/
│       └── ServiceCollectionExtensions.cs
├── appsettings.json
├── appsettings.Development.json
└── Program.cs
```

### 5.2 Key NuGet Packages

```xml
<!-- Authentication -->
<PackageReference Include="Microsoft.Identity.Web" Version="2.x" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.x" />

<!-- Database -->
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.x" />
<PackageReference Include="Dapper" Version="2.x" />

<!-- Power BI -->
<PackageReference Include="Microsoft.PowerBI.Api" Version="4.x" />

<!-- Utilities -->
<PackageReference Include="Swashbuckle.AspNetCore" Version="6.x" />
<PackageReference Include="Serilog.AspNetCore" Version="8.x" />
```

### 5.3 appsettings.json Structure

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=RWTReportingPortal;..."
  },
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "your-tenant-id",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret",
    "CallbackPath": "/api/auth/callback",
    "RequiredSecurityGroup": "RWT-ReportingPortal-Access",
    "AdminSecurityGroup": "RWT-ReportingPortal-Admins"
  },
  "Jwt": {
    "Issuer": "RWTReportingPortal",
    "Audience": "RWTReportingPortal",
    "AccessTokenExpirationMinutes": 15,
    "RefreshTokenExpirationDays": 7,
    "SecretKey": "your-secret-key-min-32-chars"
  },
  "PowerBI": {
    "WorkspaceId": "your-workspace-id",
    "TenantId": "your-tenant-id",
    "ClientId": "your-powerbi-app-client-id",
    "ClientSecret": "your-powerbi-app-secret"
  },
  "SSRS": {
    "ReportServerUrl": "https://ssrs.redwoodtrust.com/ReportServer",
    "ReportServerPath": "/Reports"
  },
  "Security": {
    "SessionTimeoutMinutes": 480,
    "IdleTimeoutMinutes": 30,
    "MaxFailedLoginAttempts": 5,
    "LockoutDurationMinutes": 30
  },
  "Cors": {
    "AllowedOrigins": [
      "https://reporting.redwoodtrust.com",
      "http://localhost:4200"
    ]
  }
}
```

---

## 6. Entra Configuration

### 6.1 App Registration Steps

1. **Navigate to Azure Portal** → Microsoft Entra ID → App registrations

2. **Create New Registration:**
   - Name: `RWT Reporting Portal`
   - Supported account types: Single tenant
   - Redirect URI: `https://your-api-url/api/auth/callback`

3. **Configure Authentication:**
   - Add redirect URIs for all environments
   - Enable "ID tokens" under Implicit grant
   - Enable "Allow public client flows" for ROPC fallback

4. **API Permissions:**
   - Microsoft Graph:
     - `User.Read` (Delegated)
     - `GroupMember.Read.All` (Delegated)
   - Click "Grant admin consent"

5. **Certificates & Secrets:**
   - Create a client secret
   - Note the value (won't be shown again)

6. **Token Configuration:**
   - Add optional claims: `email`, `family_name`, `given_name`
   - Add group claims: Security groups

### 6.2 Security Groups

Create these groups in Entra:

| Group Name | Purpose |
|------------|---------|
| `RWT-ReportingPortal-Access` | Base access - required to log in |
| `RWT-ReportingPortal-Admins` | Admin role - full system access |

### 6.3 Group Claims Configuration

In the App Registration → Token configuration:
1. Add groups claim
2. Select "Security groups"
3. Customize token properties if needed

---

## 7. Implementation Checklist

### Phase 1: Core API
- [ ] Set up .NET 8 Web API project
- [ ] Configure Entity Framework Core
- [ ] Implement database repositories (call stored procedures)
- [ ] Set up Dapper for complex queries
- [ ] Implement JWT token service
- [ ] Configure CORS

### Phase 2: Authentication
- [ ] Register app in Entra
- [ ] Implement SSO flow (OIDC)
- [ ] Implement ROPC fallback
- [ ] Implement JIT user provisioning
- [ ] Implement token refresh
- [ ] Add session management

### Phase 3: Authorization
- [ ] Implement permission checking middleware
- [ ] Add role-based authorization attributes
- [ ] Implement hub/group/report access checks

### Phase 4: Endpoints
- [ ] Auth endpoints
- [ ] User profile endpoints
- [ ] Hub/Report endpoints
- [ ] Favorites endpoints
- [ ] Admin endpoints

### Phase 5: Integrations
- [ ] Power BI embed token generation
- [ ] SSRS report URL generation
- [ ] Audit logging

### Phase 6: Testing & Documentation
- [ ] Unit tests
- [ ] Integration tests
- [ ] Swagger/OpenAPI documentation
- [ ] Postman collection

---

## 8. Security Considerations

### 8.1 Token Security
- Store JWT secret securely (Azure Key Vault recommended)
- Use short-lived access tokens (15 min)
- Implement refresh token rotation
- Hash refresh tokens in database

### 8.2 API Security
- Always use HTTPS
- Implement rate limiting on auth endpoints
- Validate all input
- Use parameterized queries (prevent SQL injection)
- Log security events

### 8.3 Session Security
- Track session activity for idle timeout
- Revoke all sessions on password change
- Allow admins to terminate user sessions
- Implement concurrent session limits (optional)

