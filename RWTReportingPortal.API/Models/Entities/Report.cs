namespace RWTReportingPortal.API.Models.Entities;

public class Report
{
    public int ReportId { get; set; }
    public int ReportGroupId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = "SSRS"; // SSRS or POWERBI
    public string? PowerBIWorkspaceId { get; set; }
    public string? PowerBIReportId { get; set; }
    public string? SSRSReportPath { get; set; }
    public string? SSRSReportServer { get; set; }
    public string? Parameters { get; set; } // JSON string
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }

    // Navigation properties
    public ReportGroup ReportGroup { get; set; } = null!;
    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
    public ICollection<ReportDepartment> ReportDepartments { get; set; } = new List<ReportDepartment>();
    public ICollection<UserReportAccess> UserReportAccess { get; set; } = new List<UserReportAccess>();
    public ICollection<UserFavorite> UserFavorites { get; set; } = new List<UserFavorite>();
    public ICollection<ReportAccessLog> AccessLogs { get; set; } = new List<ReportAccessLog>();
}
