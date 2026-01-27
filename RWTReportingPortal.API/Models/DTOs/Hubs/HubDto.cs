namespace RWTReportingPortal.API.Models.DTOs.Hubs;

public class HubDto
{
    public int HubId { get; set; }
    public string HubCode { get; set; } = string.Empty;
    public string HubName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ColorClass { get; set; }
    public string? BackgroundImage { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public int ReportGroupCount { get; set; }
    public int ReportCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByEmail { get; set; }
}

public class HubListResponse
{
    public List<HubDto> Hubs { get; set; } = new();
}

public class HubDetailResponse
{
    public int HubId { get; set; }
    public string HubName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<HubReportDto> Reports { get; set; } = new();
}

public class HubReportDto
{
    public int ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public int GroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string AccessLevel { get; set; } = string.Empty;
}

public class HubWithReportsDto
{
    public int HubId { get; set; }
    public string HubCode { get; set; } = string.Empty;
    public string HubName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<HubReportSimpleDto> Reports { get; set; } = new();
}

public class HubReportSimpleDto
{
    public int ReportId { get; set; }
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
}
