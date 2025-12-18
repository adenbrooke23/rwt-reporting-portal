namespace RWTReportingPortal.API.Models.Entities;

public class User
{
    public int UserId { get; set; }
    public string EntraObjectId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public int CompanyId { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsExpired { get; set; } = false;
    public DateTime? ExpiredAt { get; set; }
    public string? ExpirationReason { get; set; }
    public int? ExpiredBy { get; set; }
    public bool IsLockedOut { get; set; } = false;
    public DateTime? LockoutEnd { get; set; }
    public int FailedLoginAttempts { get; set; } = 0;
    public DateTime? LastLoginAt { get; set; }
    public DateTime? LastActivityAt { get; set; }
    public int LoginCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Company Company { get; set; } = null!;
    public UserProfile? Profile { get; set; }
    public UserPreferences? Preferences { get; set; }
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<UserDepartment> UserDepartments { get; set; } = new List<UserDepartment>();
    public ICollection<UserSession> Sessions { get; set; } = new List<UserSession>();
    public ICollection<UserFavorite> Favorites { get; set; } = new List<UserFavorite>();
    public ICollection<UserHubAccess> HubAccess { get; set; } = new List<UserHubAccess>();
    public ICollection<UserReportGroupAccess> ReportGroupAccess { get; set; } = new List<UserReportGroupAccess>();
    public ICollection<UserReportAccess> ReportAccess { get; set; } = new List<UserReportAccess>();
}
