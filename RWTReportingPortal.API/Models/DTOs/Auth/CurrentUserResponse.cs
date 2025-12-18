namespace RWTReportingPortal.API.Models.DTOs.Auth;

public class CurrentUserResponse
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AvatarId { get; set; }
    public string Company { get; set; } = string.Empty;
    public int CompanyId { get; set; }
    public List<string> Roles { get; set; } = new();
    public bool IsAdmin { get; set; }
    public UserPreferencesDto Preferences { get; set; } = new();
    public List<UserDepartmentDto> Departments { get; set; } = new();
    public UserPermissionsDto Permissions { get; set; } = new();
}

public class UserPreferencesDto
{
    public string ThemeId { get; set; } = "white";
    public string TableRowSize { get; set; } = "md";
}

public class UserDepartmentDto
{
    public int DepartmentId { get; set; }
    public string DepartmentCode { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
}

public class UserPermissionsDto
{
    public List<int> Hubs { get; set; } = new();
    public List<int> ReportGroups { get; set; } = new();
    public List<int> Reports { get; set; } = new();
}
