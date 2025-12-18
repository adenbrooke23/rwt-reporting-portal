namespace RWTReportingPortal.API.Models.DTOs.Users;

public class UpdatePreferencesRequest
{
    public string? ThemeId { get; set; }
    public string? TableRowSize { get; set; }
}

public class UpdatePreferencesResponse
{
    public bool Success { get; set; }
    public PreferencesDto Preferences { get; set; } = new();
}

public class PreferencesDto
{
    public string ThemeId { get; set; } = "white";
    public string TableRowSize { get; set; } = "md";
}
