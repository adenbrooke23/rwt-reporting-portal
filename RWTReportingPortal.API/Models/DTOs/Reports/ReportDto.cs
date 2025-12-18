namespace RWTReportingPortal.API.Models.DTOs.Reports;

public class ReportDto
{
    public int ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = string.Empty;
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
