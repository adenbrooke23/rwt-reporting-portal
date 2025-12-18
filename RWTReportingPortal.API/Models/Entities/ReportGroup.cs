namespace RWTReportingPortal.API.Models.Entities;

public class ReportGroup
{
    public int ReportGroupId { get; set; }
    public int HubId { get; set; }
    public string GroupCode { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }

    // Navigation properties
    public ReportingHub Hub { get; set; } = null!;
    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
    public ICollection<Report> Reports { get; set; } = new List<Report>();
    public ICollection<UserReportGroupAccess> UserReportGroupAccess { get; set; } = new List<UserReportGroupAccess>();
}
