namespace RWTReportingPortal.API.Services.Interfaces;

public interface IAuditService
{
    Task LogAsync(int? userId, string? userEmail, string action, string? entityType = null,
        int? entityId = null, object? oldValues = null, object? newValues = null,
        string? ipAddress = null, string? userAgent = null);

    Task LogLoginAsync(int? userId, string? email, string loginMethod, bool success,
        string? failureReason = null, string? ipAddress = null, string? userAgent = null);
}
