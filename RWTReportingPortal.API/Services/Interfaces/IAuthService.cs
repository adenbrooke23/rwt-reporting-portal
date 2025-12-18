using RWTReportingPortal.API.Models.DTOs.Auth;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, string ipAddress, string userAgent);
    Task<LoginResponse> HandleSSOCallbackAsync(string code, string ipAddress, string userAgent);
    Task<RefreshTokenResponse> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(int userId, string sessionToken);
    Task<CurrentUserResponse> GetCurrentUserAsync(int userId);
}
