using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

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

            try
            {
                await auditService.LogAsync(
                    userId: userId,
                    userEmail: userEmail,
                    action: $"{method} {path}",
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
}
