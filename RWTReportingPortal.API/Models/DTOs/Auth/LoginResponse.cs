namespace RWTReportingPortal.API.Models.DTOs.Auth;

public class LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
    public string TokenType { get; set; } = "Bearer";
    public UserDto User { get; set; } = null!;
}

public class UserDto
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
}
