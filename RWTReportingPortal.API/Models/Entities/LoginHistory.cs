namespace RWTReportingPortal.API.Models.Entities;

public class LoginHistory
{
    public long LoginHistoryId { get; set; }
    public int? UserId { get; set; }
    public string? Email { get; set; }
    public string LoginMethod { get; set; } = "SSO"; // SSO, ROPC
    public bool Success { get; set; }
    public string? FailureReason { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User? User { get; set; }
}
