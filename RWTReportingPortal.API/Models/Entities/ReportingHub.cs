namespace RWTReportingPortal.API.Models.Entities;

public class ReportingHub
{
    public int HubId { get; set; }
    public string HubCode { get; set; } = string.Empty;
    public string HubName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ColorClass { get; set; }
    public string? BackgroundImage { get; set; }
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedBy { get; set; }

    // Navigation properties
    public ICollection<ReportGroup> ReportGroups { get; set; } = new List<ReportGroup>();
    public ICollection<UserHubAccess> UserHubAccess { get; set; } = new List<UserHubAccess>();
}
