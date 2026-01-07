namespace RWTReportingPortal.API.Models.Entities;

public class AuditLog
{
    public long AuditLogId { get; set; }
    public int? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserDisplayName { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string? EventDescription { get; set; }
    public string? TargetType { get; set; }
    public int? TargetId { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? IPAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
