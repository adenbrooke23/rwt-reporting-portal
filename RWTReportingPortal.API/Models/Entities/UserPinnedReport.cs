namespace RWTReportingPortal.API.Models.Entities;

public class UserPinnedReport
{
    public int UserPinnedReportId { get; set; }
    public int UserId { get; set; }
    public int ReportId { get; set; }
    public int SortOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Report Report { get; set; } = null!;
}
