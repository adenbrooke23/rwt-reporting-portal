namespace RWTReportingPortal.API.Models.Entities;

public class User
{
    public int UserId { get; set; }
    public string EntraObjectId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public int? CompanyId { get; set; }
    public string? EntraGroups { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsExpired { get; set; } = false;
    public DateTime? ExpiredAt { get; set; }
    public int? ExpiredBy { get; set; }
    public string? ExpirationReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public int LoginCount { get; set; } = 0;
    public DateTime? DeactivatedAt { get; set; }
    public int? DeactivatedBy { get; set; }
    public string? DeactivationReason { get; set; }
    public bool IsLockedOut { get; set; } = false;
    public DateTime? LockedOutAt { get; set; }
    public DateTime? LockedOutUntil { get; set; }
    public string? LockoutReason { get; set; }
    public int FailedLoginAttempts { get; set; } = 0;
    public DateTime? LastFailedLoginAt { get; set; }
    public DateTime? UnlockedAt { get; set; }
    public int? UnlockedBy { get; set; }

    public Company? Company { get; set; }
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
