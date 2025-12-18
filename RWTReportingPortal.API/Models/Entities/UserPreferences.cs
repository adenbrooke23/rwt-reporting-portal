namespace RWTReportingPortal.API.Models.Entities;

public class UserPreferences
{
    public int UserPreferencesId { get; set; }
    public int UserId { get; set; }
    public string ThemeId { get; set; } = "white";
    public string TableRowSize { get; set; } = "md";
    public bool ShowWelcomeBanner { get; set; } = true;
    public string? DefaultHubId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
}
