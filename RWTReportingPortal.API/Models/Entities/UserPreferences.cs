namespace RWTReportingPortal.API.Models.Entities;

public class UserPreferences
{
    public int UserPreferenceId { get; set; }
    public int UserId { get; set; }
    public string? ThemeId { get; set; }
    public string? TableRowSize { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
