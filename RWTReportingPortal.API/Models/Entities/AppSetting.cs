namespace RWTReportingPortal.API.Models.Entities;

public class AppSetting
{
    public int AppSettingId { get; set; }
    public string SettingKey { get; set; } = string.Empty;
    public string? SettingValue { get; set; }
    public string SettingType { get; set; } = "STRING"; // STRING, INT, BOOL, JSON
    public string? Description { get; set; }
    public string? Category { get; set; }
    public bool IsReadOnly { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }

    // Navigation properties
    public User? UpdatedByUser { get; set; }
}
