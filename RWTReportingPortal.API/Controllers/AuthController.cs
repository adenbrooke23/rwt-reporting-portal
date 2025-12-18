using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Auth;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// Initiate SSO login - redirects to Microsoft Entra
    /// </summary>
    [HttpGet("login")]
    public IActionResult InitiateSSOLogin([FromQuery] string? returnUrl = null)
    {
        // TODO: Build Entra authorization URL and redirect
        var entraLoginUrl = "https://login.microsoftonline.com/...";
        return Redirect(entraLoginUrl);
    }

    /// <summary>
    /// Handle SSO callback from Microsoft Entra
    /// </summary>
    [HttpGet("callback")]
    public async Task<IActionResult> HandleSSOCallback([FromQuery] string code, [FromQuery] string? state = null)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _authService.HandleSSOCallbackAsync(code, ipAddress, userAgent);

        // Redirect to Angular app with token
        var frontendUrl = $"http://localhost:4200/auth/callback?token={result.AccessToken}";
        return Redirect(frontendUrl);
    }

    /// <summary>
    /// Password fallback login (ROPC flow)
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _authService.LoginAsync(request, ipAddress, userAgent);
        return Ok(result);
    }

    /// <summary>
    /// Get current authenticated user info
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponse>> GetCurrentUser()
    {
        var userId = GetUserId();
        var result = await _authService.GetCurrentUserAsync(userId);
        return Ok(result);
    }

    /// <summary>
    /// Refresh access token
    /// </summary>
    [HttpPost("refresh")]
    public async Task<ActionResult<RefreshTokenResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request.RefreshToken);
        return Ok(result);
    }

    /// <summary>
    /// Logout and revoke session
    /// </summary>
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
