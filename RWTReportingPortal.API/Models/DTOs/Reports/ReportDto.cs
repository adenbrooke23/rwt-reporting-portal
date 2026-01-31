namespace RWTReportingPortal.API.Models.DTOs.Reports;

public class ReportDto
{
    public int ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public int HubId { get; set; }
    public string HubName { get; set; } = string.Empty;
    public int ReportGroupId { get; set; }
    public string ReportGroupName { get; set; } = string.Empty;
    public ReportEmbedConfigDto? EmbedConfig { get; set; }
}

public class ReportEmbedConfigDto
{
    public string? WorkspaceId { get; set; }
    public string? ReportId { get; set; }
    public string? EmbedUrl { get; set; }
    public string? ServerUrl { get; set; }
    public string? ReportPath { get; set; }
}

public class ReportEmbedResponse
{
    public int ReportId { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public string? EmbedUrl { get; set; }
    public string? EmbedToken { get; set; }
    public DateTime? TokenExpiry { get; set; }
    public string? ReportUrl { get; set; }
    public List<ReportParameterDto>? Parameters { get; set; }
}

public class ReportParameterDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Required { get; set; }
}

public class FavoriteDto
{
    public int UserFavoriteId { get; set; }
    public int ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public string HubName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class PinnedReportDto
{
    public int UserPinnedReportId { get; set; }
    public int ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public int HubId { get; set; }
    public string HubName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}
