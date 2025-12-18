using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Infrastructure.Middleware;

public class ActivityTrackingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ActivityTrackingMiddleware> _logger;

    public ActivityTrackingMiddleware(RequestDelegate next, ILogger<ActivityTrackingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IUserService userService)
    {
        await _next(context);

        // Update user's last activity timestamp for authenticated requests
        if (context.User.Identity?.IsAuthenticated == true)
        {
            try
            {
                var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdClaim, out var userId))
                {
                    await userService.UpdateLastActivityAsync(userId);
                }
            }
            catch (Exception ex)
            {
                // Don't fail the request if activity tracking fails
                _logger.LogWarning(ex, "Failed to update user activity");
            }
        }
    }
}
