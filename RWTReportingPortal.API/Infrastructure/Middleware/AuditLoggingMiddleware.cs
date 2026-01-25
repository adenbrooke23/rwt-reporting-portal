using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace RWTReportingPortal.API.Infrastructure.Middleware;

public class AuditLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditLoggingMiddleware> _logger;

    // Paths that require audit logging
    private static readonly string[] AuditablePaths = new[]
    {
        "/api/admin/",
        "/api/auth/login",
        "/api/auth/logout"
    };

    public AuditLoggingMiddleware(RequestDelegate next, ILogger<AuditLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IAuditService auditService)
    {
        var path = context.Request.Path.Value?.ToLower() ?? string.Empty;
        var method = context.Request.Method;

        // Only audit modifying operations on auditable paths
        var shouldAudit = AuditablePaths.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase))
            && (method == "POST" || method == "PUT" || method == "DELETE" || method == "PATCH");

        if (shouldAudit)
        {
            var userId = GetUserId(context);
            var userEmail = context.User.FindFirst(ClaimTypes.Email)?.Value;
            var ipAddress = context.Connection.RemoteIpAddress?.ToString();
            var userAgent = context.Request.Headers.UserAgent.ToString();

            // Parse the path to extract entity type and ID for meaningful descriptions
            var (entityType, entityId, description) = ParsePathForAudit(method, path);

            try
            {
                await auditService.LogAsync(
                    userId: userId,
                    userEmail: userEmail,
                    action: $"{method} {path}",
                    entityType: entityType,
                    entityId: entityId,
                    description: description,
                    ipAddress: ipAddress,
                    userAgent: userAgent
                );
            }
            catch (Exception ex)
            {
                // Don't fail the request if audit logging fails
                _logger.LogWarning(ex, "Failed to write audit log for {Method} {Path}", method, path);
            }
        }

        await _next(context);
    }

    private static int? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    /// <summary>
    /// Parse the API path to extract entity information and build a meaningful description.
    /// </summary>
    private static (string? entityType, int? entityId, string description) ParsePathForAudit(string method, string path)
    {
        // Pattern: /api/admin/users/{userId}/departments/{deptId}
        var userDeptMatch = Regex.Match(path, @"/api/admin/users/(\d+)/departments/(\d+)", RegexOptions.IgnoreCase);
        if (userDeptMatch.Success)
        {
            var targetUserId = int.Parse(userDeptMatch.Groups[1].Value);
            var deptId = int.Parse(userDeptMatch.Groups[2].Value);
            var action = method == "POST" ? "Added user to department" : "Removed user from department";
            return ("UserDepartment", deptId, $"{action} (UserId: {targetUserId}, DepartmentId: {deptId})");
        }

        // Pattern: /api/admin/users/{userId}/hubs/{hubId}
        var userHubMatch = Regex.Match(path, @"/api/admin/users/(\d+)/hubs/(\d+)", RegexOptions.IgnoreCase);
        if (userHubMatch.Success)
        {
            var targetUserId = int.Parse(userHubMatch.Groups[1].Value);
            var hubId = int.Parse(userHubMatch.Groups[2].Value);
            var action = method == "POST" ? "Granted hub access" : "Revoked hub access";
            return ("UserHubAccess", hubId, $"{action} (UserId: {targetUserId}, HubId: {hubId})");
        }

        // Pattern: /api/admin/users/{userId}/reports/{reportId}
        var userReportMatch = Regex.Match(path, @"/api/admin/users/(\d+)/reports/(\d+)", RegexOptions.IgnoreCase);
        if (userReportMatch.Success)
        {
            var targetUserId = int.Parse(userReportMatch.Groups[1].Value);
            var reportId = int.Parse(userReportMatch.Groups[2].Value);
            var action = method == "POST" ? "Granted report access" : "Revoked report access";
            return ("UserReportAccess", reportId, $"{action} (UserId: {targetUserId}, ReportId: {reportId})");
        }

        // Pattern: /api/admin/users/{userId}/admin
        var userAdminMatch = Regex.Match(path, @"/api/admin/users/(\d+)/admin", RegexOptions.IgnoreCase);
        if (userAdminMatch.Success)
        {
            var targetUserId = int.Parse(userAdminMatch.Groups[1].Value);
            return ("User", targetUserId, $"Modified admin role (UserId: {targetUserId})");
        }

        // Pattern: /api/admin/users/{userId}/lock
        var userLockMatch = Regex.Match(path, @"/api/admin/users/(\d+)/lock", RegexOptions.IgnoreCase);
        if (userLockMatch.Success)
        {
            var targetUserId = int.Parse(userLockMatch.Groups[1].Value);
            return ("User", targetUserId, $"Locked user account (UserId: {targetUserId})");
        }

        // Pattern: /api/admin/users/{userId}/unlock
        var userUnlockMatch = Regex.Match(path, @"/api/admin/users/(\d+)/unlock", RegexOptions.IgnoreCase);
        if (userUnlockMatch.Success)
        {
            var targetUserId = int.Parse(userUnlockMatch.Groups[1].Value);
            return ("User", targetUserId, $"Unlocked user account (UserId: {targetUserId})");
        }

        // Pattern: /api/admin/users/{userId}/expire
        var userExpireMatch = Regex.Match(path, @"/api/admin/users/(\d+)/expire", RegexOptions.IgnoreCase);
        if (userExpireMatch.Success)
        {
            var targetUserId = int.Parse(userExpireMatch.Groups[1].Value);
            return ("User", targetUserId, $"Expired user account (UserId: {targetUserId})");
        }

        // Pattern: /api/admin/users/{userId}/restore
        var userRestoreMatch = Regex.Match(path, @"/api/admin/users/(\d+)/restore", RegexOptions.IgnoreCase);
        if (userRestoreMatch.Success)
        {
            var targetUserId = int.Parse(userRestoreMatch.Groups[1].Value);
            return ("User", targetUserId, $"Restored user account (UserId: {targetUserId})");
        }

        // Pattern: /api/admin/hubs/{id}
        var hubMatch = Regex.Match(path, @"/api/admin/hubs/(\d+)?", RegexOptions.IgnoreCase);
        if (hubMatch.Success)
        {
            var hubId = hubMatch.Groups[1].Success ? int.Parse(hubMatch.Groups[1].Value) : (int?)null;
            var action = method switch
            {
                "POST" => "Created hub",
                "PUT" => "Updated hub",
                "DELETE" => "Deleted hub",
                _ => "Modified hub"
            };
            return ("Hub", hubId, hubId.HasValue ? $"{action} (HubId: {hubId})" : action);
        }

        // Pattern: /api/admin/departments/{id}
        var deptMatch = Regex.Match(path, @"/api/admin/departments/(\d+)?", RegexOptions.IgnoreCase);
        if (deptMatch.Success)
        {
            var deptId = deptMatch.Groups[1].Success ? int.Parse(deptMatch.Groups[1].Value) : (int?)null;
            var action = method switch
            {
                "POST" => "Created department",
                "PUT" => "Updated department",
                "DELETE" => "Deleted department",
                _ => "Modified department"
            };
            return ("Department", deptId, deptId.HasValue ? $"{action} (DepartmentId: {deptId})" : action);
        }

        // Pattern: /api/admin/reports/{id}
        var reportMatch = Regex.Match(path, @"/api/admin/reports/(\d+)?", RegexOptions.IgnoreCase);
        if (reportMatch.Success)
        {
            var reportId = reportMatch.Groups[1].Success ? int.Parse(reportMatch.Groups[1].Value) : (int?)null;
            var action = method switch
            {
                "POST" => "Created report",
                "PUT" => "Updated report",
                "DELETE" => "Deleted report",
                _ => "Modified report"
            };
            return ("Report", reportId, reportId.HasValue ? $"{action} (ReportId: {reportId})" : action);
        }

        // Pattern: /api/auth/login or /api/auth/logout
        if (path.Contains("/api/auth/login"))
            return ("Auth", null, "User login");
        if (path.Contains("/api/auth/logout"))
            return ("Auth", null, "User logout");

        // Default fallback
        return (null, null, $"{method} operation on {path}");
    }
}
