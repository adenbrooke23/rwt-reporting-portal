namespace RWTReportingPortal.API.Models.Entities;

public class UserAnnouncementRead
{
    public int UserId { get; set; }
    public int AnnouncementId { get; set; }
    public DateTime ReadAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Announcement Announcement { get; set; } = null!;
}
