namespace RWTReportingPortal.API.Models.DTOs.Users;

public class UpdateAvatarRequest
{
    public string AvatarId { get; set; } = string.Empty;
}

public class UpdateAvatarResponse
{
    public bool Success { get; set; }
    public string AvatarId { get; set; } = string.Empty;
}
