namespace RWTReportingPortal.API.Models.Entities;

public class UserProfile
{
    public int UserProfileId { get; set; }
    public int UserId { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
}
