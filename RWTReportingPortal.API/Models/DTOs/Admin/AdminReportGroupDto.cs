namespace RWTReportingPortal.API.Models.DTOs.Admin;

/// <summary>
/// Report Group DTO for admin management
/// </summary>
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

/// <summary>
/// Request DTO for creating a new report group
/// </summary>
public class CreateReportGroupRequest
{
    public int HubId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string? Description { get; set; }
}

/// <summary>
/// Request DTO for updating a report group
/// </summary>
public class UpdateReportGroupRequest
{
    public int? HubId { get; set; }
    public string? GroupName { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>
/// Response for report group list
/// </summary>
public class AdminReportGroupListResponse
{
    public List<AdminReportGroupDto> ReportGroups { get; set; } = new();
    public int TotalCount { get; set; }
}
