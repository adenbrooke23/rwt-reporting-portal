using RWTReportingPortal.API.Models.DTOs.SSRS;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface ISSRSService
{

    string GetReportUrl(string reportPath, string reportServer);
    Task<List<SSRSParameter>> GetReportParametersAsync(string reportPath, string reportServer);

    Task<SSRSFolderListResponse> ListChildrenAsync(string folderPath);
    Task<SSRSConfigResponse> GetServerConfigAsync();
    Task<bool> TestConnectionAsync();

    Task<SSRSRenderResult> RenderReportAsync(string reportPath, string? reportServer = null, Dictionary<string, string>? parameters = null, string? proxyBaseUrl = null);

    Task<SSRSRenderResult> ProxyResourceAsync(string resourcePath, string? queryString = null, string method = "GET", byte[]? requestBody = null, string? contentType = null, string? sessionKey = null);
}

public class SSRSRenderResult
{
    public bool Success { get; set; }
    public byte[]? Content { get; set; }
    public string ContentType { get; set; } = "text/html";
    public string? ErrorMessage { get; set; }
    public List<string>? Cookies { get; set; }
}

public class SSRSParameter
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Required { get; set; }
    public List<string>? ValidValues { get; set; }
    public string? DefaultValue { get; set; }
}
