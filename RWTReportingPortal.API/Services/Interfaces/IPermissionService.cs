using RWTReportingPortal.API.Models.DTOs.Admin;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IPermissionService
{
    Task<bool> CanAccessReportAsync(int userId, int reportId);
    Task<bool> CanAccessHubAsync(int userId, int hubId);
    Task<bool> IsAdminAsync(int userId);
    Task<UserPermissionsResponse> GetUserPermissionsAsync(int userId);
    Task GrantHubAccessAsync(int userId, int hubId, int grantedBy, DateTime? expiresAt = null);
    Task GrantReportGroupAccessAsync(int userId, int reportGroupId, int grantedBy, DateTime? expiresAt = null);
    Task GrantReportAccessAsync(int userId, int reportId, int grantedBy, DateTime? expiresAt = null);
    Task RevokePermissionAsync(int permissionId, string permissionType);
    Task UpdateUserAdminRoleAsync(int userId, bool isAdmin, int grantedBy);
}
