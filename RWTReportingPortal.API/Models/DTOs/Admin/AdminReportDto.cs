namespace RWTReportingPortal.API.Models.DTOs.Admin;

/// <summary>
/// Report DTO for admin management
/// </summary>
public class AdminReportDto
{
    public int ReportId { get; set; }
    public int ReportGroupId { get; set; }
    public string ReportGroupName { get; set; } = string.Empty;
    public int HubId { get; set; }
    public string HubName { get; set; } = string.Empty;
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = "SSRS";
    public string? PowerBIWorkspaceId { get; set; }
    public string? PowerBIReportId { get; set; }
    public string? PowerBIEmbedUrl { get; set; }
    public string? SSRSReportPath { get; set; }
    public string? SSRSReportServer { get; set; }
    public string? Parameters { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByEmail { get; set; }
    public List<int> DepartmentIds { get; set; } = new();
}

/// <summary>
/// Request DTO for creating a new report
/// </summary>
public class CreateReportRequest
{
    public int ReportGroupId { get; set; }
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = "SSRS";
    public string? PowerBIWorkspaceId { get; set; }
    public string? PowerBIReportId { get; set; }
    public string? PowerBIEmbedUrl { get; set; }
    public string? SSRSReportPath { get; set; }
    public string? SSRSReportServer { get; set; }
    public string? Parameters { get; set; }
    public List<int>? DepartmentIds { get; set; }
}

/// <summary>
/// Request DTO for updating a report
/// </summary>
public class UpdateReportRequest
{
    public int? ReportGroupId { get; set; }
    public string? ReportName { get; set; }
    public string? Description { get; set; }
    public string? ReportType { get; set; }
    public string? PowerBIWorkspaceId { get; set; }
    public string? PowerBIReportId { get; set; }
    public string? PowerBIEmbedUrl { get; set; }
    public string? SSRSReportPath { get; set; }
    public string? SSRSReportServer { get; set; }
    public string? Parameters { get; set; }
    public bool? IsActive { get; set; }
    public List<int>? DepartmentIds { get; set; }
}

/// <summary>
/// Response for report list
/// </summary>
public class AdminReportListResponse
{
    public List<AdminReportDto> Reports { get; set; } = new();
    public int TotalCount { get; set; }
}
