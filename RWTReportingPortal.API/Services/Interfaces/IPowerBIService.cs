namespace RWTReportingPortal.API.Services.Interfaces;

public interface IPowerBIService
{

    Task<PowerBIEmbedInfo> GetEmbedInfoAsync(string workspaceId, string reportId);

    Task<List<PowerBIWorkspace>> GetWorkspacesAsync();

    Task<List<PowerBIReport>> GetWorkspaceReportsAsync(string workspaceId);

    Task<PowerBIConfigResponse> GetConfigAsync();

    Task<bool> TestConnectionAsync();
}

public class PowerBIEmbedInfo
{
    public string EmbedUrl { get; set; } = string.Empty;
    public string EmbedToken { get; set; } = string.Empty;
    public string ReportId { get; set; } = string.Empty;
    public DateTime TokenExpiry { get; set; }
}

public class PowerBIWorkspace
{
    public string WorkspaceId { get; set; } = string.Empty;
    public string WorkspaceName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = string.Empty;
    public int ReportCount { get; set; }
    public int PaginatedReportCount { get; set; }
}

public class PowerBIReport
{
    public string ReportId { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string DatasetId { get; set; } = string.Empty;
    public string EmbedUrl { get; set; } = string.Empty;
    public string ReportType { get; set; } = "PowerBIReport";
    public DateTime? ModifiedDateTime { get; set; }
    public bool AlreadyImported { get; set; }
    public int? ExistingReportId { get; set; }
}

public class PowerBIConfigResponse
{
    public bool IsConfigured { get; set; }
    public bool IsConnected { get; set; }
    public string? TenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ErrorMessage { get; set; }
}
