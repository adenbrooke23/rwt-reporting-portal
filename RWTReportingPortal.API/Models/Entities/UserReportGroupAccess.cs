namespace RWTReportingPortal.API.Models.Entities;

public class UserReportGroupAccess
{
    public int UserReportGroupAccessId { get; set; }
    public int UserId { get; set; }
    public int ReportGroupId { get; set; }
    public int? GrantedBy { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
    public ReportGroup ReportGroup { get; set; } = null!;
}
