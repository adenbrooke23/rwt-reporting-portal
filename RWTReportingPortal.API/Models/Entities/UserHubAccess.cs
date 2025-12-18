namespace RWTReportingPortal.API.Models.Entities;

public class UserHubAccess
{
    public int UserHubAccessId { get; set; }
    public int UserId { get; set; }
    public int HubId { get; set; }
    public int? GrantedBy { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
    public ReportingHub Hub { get; set; } = null!;
    public User? GrantedByUser { get; set; }
}
