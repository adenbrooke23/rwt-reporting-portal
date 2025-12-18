namespace RWTReportingPortal.API.Services.Interfaces;

public interface ISSRSService
{
    string GetReportUrl(string reportPath, string reportServer);
    Task<List<SSRSParameter>> GetReportParametersAsync(string reportPath, string reportServer);
}

public class SSRSParameter
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Required { get; set; }
    public List<string>? ValidValues { get; set; }
    public string? DefaultValue { get; set; }
}
