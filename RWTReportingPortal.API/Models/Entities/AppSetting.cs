namespace RWTReportingPortal.API.Models.Entities;

public class AppSetting
{
    public int SettingId { get; set; }
    public string SettingKey { get; set; } = string.Empty;
    public string? SettingValue { get; set; }
    public string SettingType { get; set; } = "STRING";
    public string? Description { get; set; }
    public string? Category { get; set; }
    public bool IsEncrypted { get; set; } = false;
    public bool IsReadOnly { get; set; } = false;
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
}
