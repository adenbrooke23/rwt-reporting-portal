using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Infrastructure.Auth;
using RWTReportingPortal.API.Models.DTOs.Auth;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IEntraAuthService _entraAuthService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        IEntraAuthService entraAuthService,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _entraAuthService = entraAuthService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("login")]
    public IActionResult InitiateSSOLogin([FromQuery] string? returnUrl = null)
    {

        var state = Guid.NewGuid().ToString();

        var redirectUri = $"https://{Request.Host}/api/auth/callback";

        var entraLoginUrl = _entraAuthService.GetAuthorizationUrl(state, redirectUri);

        _logger.LogInformation("Redirecting to Entra login: {Url}", entraLoginUrl);

        return Redirect(entraLoginUrl);
    }

    [HttpGet("callback")]
    public async Task<IActionResult> HandleSSOCallback([FromQuery] string code, [FromQuery] string? state = null)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userAgent = Request.Headers.UserAgent.ToString();

        var redirectUri = $"https://{Request.Host}/api/auth/callback";

        var result = await _authService.HandleSSOCallbackAsync(code, redirectUri, ipAddress, userAgent);

        var frontendUrl = _configuration["Cors:AllowedOrigins:0"] ?? "https://erpqa.redwoodtrust.com";
        return Redirect($"{frontendUrl}/auth/callback?token={result.AccessToken}&refresh={result.RefreshToken}");
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _authService.LoginAsync(request, ipAddress, userAgent);
        return Ok(result);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponse>> GetCurrentUser()
    {
        var userId = GetUserId();
        var result = await _authService.GetCurrentUserAsync(userId);
        return Ok(result);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<RefreshTokenResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request.RefreshToken);
        return Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userId = GetUserId();
        var sessionToken = Request.Headers.Authorization.ToString().Replace("Bearer ", "");
        await _authService.LogoutAsync(userId, sessionToken);
        return Ok(new { success = true });
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        throw new UnauthorizedAccessException("Invalid user token");
    }
}
