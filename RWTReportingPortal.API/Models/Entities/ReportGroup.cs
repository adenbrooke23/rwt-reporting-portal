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
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedBy { get; set; }

    public ReportingHub Hub { get; set; } = null!;
    public ICollection<Report> Reports { get; set; } = new List<Report>();
}
