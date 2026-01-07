namespace RWTReportingPortal.API.Models.Entities;

public class LoginHistory
{
    public long LoginHistoryId { get; set; }
    public int? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string LoginMethod { get; set; } = "SSO";
    public string? IPAddress { get; set; }
    public string? UserAgent { get; set; }
    public bool IsSuccess { get; set; }
    public string? FailureReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
