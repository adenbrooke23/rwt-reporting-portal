namespace RWTReportingPortal.API.Models.Entities;

public class ReportAccessLog
{
    public long ReportAccessLogId { get; set; }
    public int UserId { get; set; }
    public int ReportId { get; set; }
    public string AccessType { get; set; } = "View";
    public string? IpAddress { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Report Report { get; set; } = null!;
}
