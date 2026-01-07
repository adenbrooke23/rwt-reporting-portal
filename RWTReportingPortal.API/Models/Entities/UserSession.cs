namespace RWTReportingPortal.API.Models.Entities;

public class UserSession
{
    public Guid SessionId { get; set; }
    public int UserId { get; set; }
    public string AccessTokenHash { get; set; } = string.Empty;
    public string? IPAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
    public string? RevokedReason { get; set; }
    public int IsActive { get; set; } = 1;

    // Navigation properties
    public User User { get; set; } = null!;
}
