namespace RWTReportingPortal.API.Models.Entities;

public class UserFavorite
{
    public int UserFavoriteId { get; set; }
    public int UserId { get; set; }
    public int ReportId { get; set; }
    public int SortOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User User { get; set; } = null!;
    public Report Report { get; set; } = null!;
}
