namespace RWTReportingPortal.API.Models.Entities;

public class UserReportAccess
{
    public int UserReportAccessId { get; set; }
    public int UserId { get; set; }
    public int ReportId { get; set; }
    public int? GrantedBy { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
    public Report Report { get; set; } = null!;
}
