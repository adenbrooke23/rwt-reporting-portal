using RWTReportingPortal.API.Models.DTOs.SSRS;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface ISSRSService
{
    // Existing methods
    string GetReportUrl(string reportPath, string reportServer);
    Task<List<SSRSParameter>> GetReportParametersAsync(string reportPath, string reportServer);

    // Browsing methods
    Task<SSRSFolderListResponse> ListChildrenAsync(string folderPath);
    Task<SSRSConfigResponse> GetServerConfigAsync();
    Task<bool> TestConnectionAsync();
}

public class SSRSParameter
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Required { get; set; }
    public List<string>? ValidValues { get; set; }
    public string? DefaultValue { get; set; }
}
