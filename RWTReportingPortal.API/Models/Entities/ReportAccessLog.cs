namespace RWTReportingPortal.API.Models.Entities;

public class ReportAccessLog
{
    public long ReportAccessLogId { get; set; }
    public int UserId { get; set; }
    public int ReportId { get; set; }
    public string AccessType { get; set; } = "View"; // View, Download, Export
    public string? IpAddress { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User User { get; set; } = null!;
    public Report Report { get; set; } = null!;
}
