using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
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

            // Read request body for POST/PUT/PATCH
            string? requestBody = null;
            if (method != "DELETE" && context.Request.ContentLength > 0)
            {
                context.Request.EnableBuffering();
                using var reader = new StreamReader(
                    context.Request.Body,
                    Encoding.UTF8,
                    detectEncodingFromByteOrderMarks: false,
                    leaveOpen: true);
                requestBody = await reader.ReadToEndAsync();
                context.Request.Body.Position = 0; // Reset for controller
            }

            // Parse the path and body to extract entity info and build description
            var (entityType, entityId, description, newValues) = ParsePathForAudit(method, path, requestBody, userEmail);

            try
            {
                await auditService.LogAsync(
                    userId: userId,
                    userEmail: userEmail,
                    action: $"{method} {path}",
                    entityType: entityType,
                    entityId: entityId,
                    newValues: newValues,
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
    /// Parse the API path and request body to extract entity information and build a meaningful description.
    /// </summary>
    private static (string? entityType, int? entityId, string description, object? newValues) ParsePathForAudit(
        string method, string path, string? requestBody, string? performedByEmail)
    {
        // Try to parse request body as JSON for newValues
        JsonElement? bodyJson = null;
        if (!string.IsNullOrEmpty(requestBody))
        {
            try
            {
                bodyJson = JsonSerializer.Deserialize<JsonElement>(requestBody);
            }
            catch
            {
                // Body isn't valid JSON, that's ok
            }
        }

        // Build a structured audit record
        object? BuildNewValues(object additionalData) => new
        {
            PerformedBy = performedByEmail,
            Timestamp = DateTime.UtcNow,
            RequestData = bodyJson,
            Details = additionalData
        };

        // Pattern: /api/admin/users/{userId}/departments/{deptId}
        var userDeptMatch = Regex.Match(path, @"/api/admin/users/(\d+)/departments/(\d+)", RegexOptions.IgnoreCase);
        if (userDeptMatch.Success)
        {
            var targetUserId = int.Parse(userDeptMatch.Groups[1].Value);
            var deptId = int.Parse(userDeptMatch.Groups[2].Value);
            var action = method == "POST" ? "Added user to department" : "Removed user from department";
            var details = new { TargetUserId = targetUserId, DepartmentId = deptId, Action = action };
            return ("UserDepartment", targetUserId, $"{action} - TargetUserId: {targetUserId}, DepartmentId: {deptId}", BuildNewValues(details));
        }

        // Pattern: /api/admin/users/{userId}/hubs/{hubId}
        var userHubMatch = Regex.Match(path, @"/api/admin/users/(\d+)/hubs/(\d+)", RegexOptions.IgnoreCase);
        if (userHubMatch.Success)
        {
            var targetUserId = int.Parse(userHubMatch.Groups[1].Value);
            var hubId = int.Parse(userHubMatch.Groups[2].Value);
            var action = method == "POST" ? "Granted hub access" : "Revoked hub access";
            var details = new { TargetUserId = targetUserId, HubId = hubId, Action = action };
            return ("UserHubAccess", targetUserId, $"{action} - TargetUserId: {targetUserId}, HubId: {hubId}", BuildNewValues(details));
        }

        // Pattern: /api/admin/users/{userId}/reports/{reportId}
        var userReportMatch = Regex.Match(path, @"/api/admin/users/(\d+)/reports/(\d+)", RegexOptions.IgnoreCase);
        if (userReportMatch.Success)
        {
            var targetUserId = int.Parse(userReportMatch.Groups[1].Value);
            var reportId = int.Parse(userReportMatch.Groups[2].Value);
            var action = method == "POST" ? "Granted report access" : "Revoked report access";
            var details = new { TargetUserId = targetUserId, ReportId = reportId, Action = action };
            return ("UserReportAccess", targetUserId, $"{action} - TargetUserId: {targetUserId}, ReportId: {reportId}", BuildNewValues(details));
        }

        // Pattern: /api/admin/users/{userId}/admin
        var userAdminMatch = Regex.Match(path, @"/api/admin/users/(\d+)/admin", RegexOptions.IgnoreCase);
        if (userAdminMatch.Success)
        {
            var targetUserId = int.Parse(userAdminMatch.Groups[1].Value);
            var isAdmin = bodyJson?.TryGetProperty("isAdmin", out var isAdminProp) == true ? isAdminProp.GetBoolean() : (bool?)null;
            var action = isAdmin == true ? "Granted admin role" : isAdmin == false ? "Revoked admin role" : "Modified admin role";
            var details = new { TargetUserId = targetUserId, IsAdmin = isAdmin, Action = action };
            return ("User", targetUserId, $"{action} - TargetUserId: {targetUserId}", BuildNewValues(details));
        }

        // Pattern: /api/admin/users/{userId}/lock
        var userLockMatch = Regex.Match(path, @"/api/admin/users/(\d+)/lock", RegexOptions.IgnoreCase);
        if (userLockMatch.Success)
        {
            var targetUserId = int.Parse(userLockMatch.Groups[1].Value);
            var reason = bodyJson?.TryGetProperty("reason", out var reasonProp) == true ? reasonProp.GetString() : null;
            var details = new { TargetUserId = targetUserId, Reason = reason, Action = "Locked" };
            return ("User", targetUserId, $"Locked user account - TargetUserId: {targetUserId}, Reason: {reason ?? "Not specified"}", BuildNewValues(details));
        }

        // Pattern: /api/admin/users/{userId}/unlock
        var userUnlockMatch = Regex.Match(path, @"/api/admin/users/(\d+)/unlock", RegexOptions.IgnoreCase);
        if (userUnlockMatch.Success)
        {
            var targetUserId = int.Parse(userUnlockMatch.Groups[1].Value);
            var details = new { TargetUserId = targetUserId, Action = "Unlocked" };
            return ("User", targetUserId, $"Unlocked user account - TargetUserId: {targetUserId}", BuildNewValues(details));
        }

        // Pattern: /api/admin/users/{userId}/expire
        var userExpireMatch = Regex.Match(path, @"/api/admin/users/(\d+)/expire", RegexOptions.IgnoreCase);
        if (userExpireMatch.Success)
        {
            var targetUserId = int.Parse(userExpireMatch.Groups[1].Value);
            var reason = bodyJson?.TryGetProperty("reason", out var reasonProp) == true ? reasonProp.GetString() : null;
            var ticketNumber = bodyJson?.TryGetProperty("ticketNumber", out var ticketProp) == true ? ticketProp.GetString() : null;
            var details = new { TargetUserId = targetUserId, Reason = reason, TicketNumber = ticketNumber, Action = "Expired" };
            return ("User", targetUserId, $"Expired user account - TargetUserId: {targetUserId}, Reason: {reason ?? "Not specified"}, Ticket: {ticketNumber ?? "None"}", BuildNewValues(details));
        }

        // Pattern: /api/admin/users/{userId}/restore
        var userRestoreMatch = Regex.Match(path, @"/api/admin/users/(\d+)/restore", RegexOptions.IgnoreCase);
        if (userRestoreMatch.Success)
        {
            var targetUserId = int.Parse(userRestoreMatch.Groups[1].Value);
            var details = new { TargetUserId = targetUserId, Action = "Restored" };
            return ("User", targetUserId, $"Restored user account - TargetUserId: {targetUserId}", BuildNewValues(details));
        }

        // Pattern: /api/admin/hubs/{id}
        var hubMatch = Regex.Match(path, @"/api/admin/hubs/?(\d+)?", RegexOptions.IgnoreCase);
        if (hubMatch.Success && path.Contains("/hubs"))
        {
            var hubId = hubMatch.Groups[1].Success && !string.IsNullOrEmpty(hubMatch.Groups[1].Value)
                ? int.Parse(hubMatch.Groups[1].Value) : (int?)null;
            var hubName = bodyJson?.TryGetProperty("hubName", out var nameProp) == true ? nameProp.GetString() : null;
            var action = method switch
            {
                "POST" => "Created hub",
                "PUT" => "Updated hub",
                "DELETE" => "Deleted hub",
                _ => "Modified hub"
            };
            var details = new { HubId = hubId, HubName = hubName, Action = action };
            var desc = hubName != null ? $"{action} - HubId: {hubId}, Name: {hubName}" : $"{action} - HubId: {hubId}";
            return ("Hub", hubId, desc, BuildNewValues(details));
        }

        // Pattern: /api/admin/departments/{id}
        var deptMatch = Regex.Match(path, @"/api/admin/departments/?(\d+)?", RegexOptions.IgnoreCase);
        if (deptMatch.Success && path.Contains("/departments"))
        {
            var deptId = deptMatch.Groups[1].Success && !string.IsNullOrEmpty(deptMatch.Groups[1].Value)
                ? int.Parse(deptMatch.Groups[1].Value) : (int?)null;
            var deptName = bodyJson?.TryGetProperty("name", out var nameProp) == true ? nameProp.GetString() : null;
            var action = method switch
            {
                "POST" => "Created department",
                "PUT" => "Updated department",
                "DELETE" => "Deleted department",
                _ => "Modified department"
            };
            var details = new { DepartmentId = deptId, DepartmentName = deptName, Action = action };
            var desc = deptName != null ? $"{action} - DepartmentId: {deptId}, Name: {deptName}" : $"{action} - DepartmentId: {deptId}";
            return ("Department", deptId, desc, BuildNewValues(details));
        }

        // Pattern: /api/admin/reports/{id}
        var reportMatch = Regex.Match(path, @"/api/admin/reports/?(\d+)?", RegexOptions.IgnoreCase);
        if (reportMatch.Success && path.Contains("/reports"))
        {
            var reportId = reportMatch.Groups[1].Success && !string.IsNullOrEmpty(reportMatch.Groups[1].Value)
                ? int.Parse(reportMatch.Groups[1].Value) : (int?)null;
            var reportName = bodyJson?.TryGetProperty("name", out var nameProp) == true ? nameProp.GetString() : null;
            var reportType = bodyJson?.TryGetProperty("type", out var typeProp) == true ? typeProp.GetString() : null;
            var action = method switch
            {
                "POST" => "Created report",
                "PUT" => "Updated report",
                "DELETE" => "Deleted report",
                _ => "Modified report"
            };
            var details = new { ReportId = reportId, ReportName = reportName, ReportType = reportType, Action = action };
            var desc = reportName != null ? $"{action} - ReportId: {reportId}, Name: {reportName}, Type: {reportType}" : $"{action} - ReportId: {reportId}";
            return ("Report", reportId, desc, BuildNewValues(details));
        }

        // Pattern: /api/auth/login or /api/auth/logout
        if (path.Contains("/api/auth/login"))
        {
            var email = bodyJson?.TryGetProperty("email", out var emailProp) == true ? emailProp.GetString() : null;
            var details = new { Email = email, Action = "Login" };
            return ("Auth", null, $"User login attempt - Email: {email}", BuildNewValues(details));
        }
        if (path.Contains("/api/auth/logout"))
        {
            var details = new { Action = "Logout" };
            return ("Auth", null, "User logout", BuildNewValues(details));
        }

        // Default fallback - still capture the request body
        var defaultDetails = new { Path = path, Method = method };
        return (null, null, $"{method} operation on {path}", BuildNewValues(defaultDetails));
    }
}
