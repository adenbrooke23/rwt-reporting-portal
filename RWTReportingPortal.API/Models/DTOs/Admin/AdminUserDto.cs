namespace RWTReportingPortal.API.Models.DTOs.Admin;

public class AdminUserDto
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Company { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public bool IsActive { get; set; }
    public bool IsExpired { get; set; }
    public DateTime? ExpiredAt { get; set; }
    public string? ExpirationReason { get; set; }
    public bool IsLockedOut { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public int LoginCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public int DepartmentCount { get; set; }
    public int ReportCount { get; set; }
    public int HubCount { get; set; }
}

public class AdminUserListResponse
{
    public List<AdminUserDto> Users { get; set; } = new();
    public PaginationInfo Pagination { get; set; } = new();
}

public class PaginationInfo
{
    public int CurrentPage { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class UserPermissionsResponse
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public List<UserDepartmentPermissionDto> Departments { get; set; } = new();
    public PermissionsDto Permissions { get; set; } = new();
}

public class UserDepartmentPermissionDto
{
    public int UserDepartmentId { get; set; }
    public int DepartmentId { get; set; }
    public string DepartmentCode { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public DateTime GrantedAt { get; set; }
    public string? GrantedBy { get; set; }
}

public class PermissionsDto
{
    public List<HubPermissionDto> Hubs { get; set; } = new();
    public List<ReportGroupPermissionDto> ReportGroups { get; set; } = new();
    public List<ReportPermissionDto> Reports { get; set; } = new();
}

public class HubPermissionDto
{
    public int PermissionId { get; set; }
    public int HubId { get; set; }
    public string HubName { get; set; } = string.Empty;
    public DateTime GrantedAt { get; set; }
    public string? GrantedBy { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class ReportGroupPermissionDto
{
    public int PermissionId { get; set; }
    public int ReportGroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string HubName { get; set; } = string.Empty;
    public DateTime GrantedAt { get; set; }
    public string? GrantedBy { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class ReportPermissionDto
{
    public int PermissionId { get; set; }
    public int ReportId { get; set; }
    public string ReportName { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public int HubId { get; set; }
    public string HubName { get; set; } = string.Empty;
    public DateTime GrantedAt { get; set; }
    public string? GrantedBy { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class ExpireUserRequest
{
    public string? Reason { get; set; }
}

public class LockUserRequest
{
    public string? Reason { get; set; }
}

public class GrantHubAccessRequest
{
    public int HubId { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class GrantDepartmentRequest
{
    public int DepartmentId { get; set; }
}

public class GrantReportDepartmentRequest
{
    public int DepartmentId { get; set; }
}

public class ReplaceReportDepartmentsRequest
{
    public List<int> DepartmentIds { get; set; } = new();
}

public class UpdateAdminRoleRequest
{
    public bool IsAdmin { get; set; }
}

public class GrantReportAccessRequest
{
    public int ReportId { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
