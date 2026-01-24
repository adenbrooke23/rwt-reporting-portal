namespace RWTReportingPortal.API.Models.DTOs.SSRS;

/// <summary>
/// Represents a folder or report item from SSRS catalog
/// </summary>
public class SSRSCatalogItem
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string TypeName { get; set; } = string.Empty; // "Folder" or "Report"
    public string? Description { get; set; }
    public DateTime? ModifiedDate { get; set; }
    public bool Hidden { get; set; }
}

/// <summary>
/// Response for folder/report listing
/// </summary>
public class SSRSFolderListResponse
{
    public string CurrentPath { get; set; } = "/";
    public List<SSRSCatalogItem> Folders { get; set; } = new();
    public List<SSRSCatalogItem> Reports { get; set; } = new();
    public bool Success { get; set; } = true;
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Response for SSRS server configuration
/// </summary>
public class SSRSConfigResponse
{
    public string ServerUrl { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Selected report from browser (for frontend)
/// </summary>
public class SSRSReportSelection
{
    public string ReportPath { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ServerUrl { get; set; } = string.Empty;
}
