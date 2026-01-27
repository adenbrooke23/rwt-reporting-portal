namespace RWTReportingPortal.API.Models.DTOs.Admin;

public class AdminReportGroupDto
{
    public int ReportGroupId { get; set; }
    public int HubId { get; set; }
    public string HubName { get; set; } = string.Empty;
    public string GroupCode { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public int ReportCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByEmail { get; set; }
}

public class CreateReportGroupRequest
{
    public int HubId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateReportGroupRequest
{
    public int? HubId { get; set; }
    public string? GroupName { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
}

public class AdminReportGroupListResponse
{
    public List<AdminReportGroupDto> ReportGroups { get; set; } = new();
    public int TotalCount { get; set; }
}
