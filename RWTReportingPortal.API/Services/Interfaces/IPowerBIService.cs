namespace RWTReportingPortal.API.Services.Interfaces;

public interface IPowerBIService
{
    Task<PowerBIEmbedInfo> GetEmbedInfoAsync(string workspaceId, string reportId);
    Task<List<PowerBIWorkspace>> GetWorkspacesAsync();
    Task<List<PowerBIReport>> GetWorkspaceReportsAsync(string workspaceId);
}

public class PowerBIEmbedInfo
{
    public string EmbedUrl { get; set; } = string.Empty;
    public string EmbedToken { get; set; } = string.Empty;
    public DateTime TokenExpiry { get; set; }
}

public class PowerBIWorkspace
{
    public string WorkspaceId { get; set; } = string.Empty;
    public string WorkspaceName { get; set; } = string.Empty;
    public int ReportCount { get; set; }
}

public class PowerBIReport
{
    public string ReportId { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string DatasetId { get; set; } = string.Empty;
    public string EmbedUrl { get; set; } = string.Empty;
    public bool AlreadyImported { get; set; }
    public int? ExistingReportId { get; set; }
}
