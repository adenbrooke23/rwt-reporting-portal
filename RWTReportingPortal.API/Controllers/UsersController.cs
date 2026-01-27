using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RWTReportingPortal.API.Data;
using RWTReportingPortal.API.Models.DTOs.Users;
using RWTReportingPortal.API.Models.DTOs.Statistics;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IUserStatsService _userStatsService;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        IUserService userService,
        IUserStatsService userStatsService,
        ApplicationDbContext context,
        ILogger<UsersController> logger)
    {
        _userService = userService;
        _userStatsService = userStatsService;
        _context = context;
        _logger = logger;
    }

    [HttpGet("profile")]
    public async Task<ActionResult<UserProfileDto>> GetProfile()
    {
        var userId = GetUserId();
        var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        return Ok(new UserProfileDto
        {
            AvatarId = profile?.AvatarId
        });
    }

    [HttpPut("profile/avatar")]
    public async Task<ActionResult<UpdateAvatarResponse>> UpdateAvatar([FromBody] UpdateAvatarRequest request)
    {
        var userId = GetUserId();
        var result = await _userService.UpdateAvatarAsync(userId, request.AvatarId);
        return Ok(result);
    }

    [HttpGet("preferences")]
    public async Task<ActionResult<PreferencesDto>> GetPreferences()
    {
        var userId = GetUserId();
        var preferences = await _context.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);
        if (preferences == null)
        {
            return Ok(new PreferencesDto());
        }
        return Ok(new PreferencesDto
        {
            ThemeId = preferences.ThemeId ?? "white",
            TableRowSize = preferences.TableRowSize ?? "md"
        });
    }

    [HttpPut("preferences")]
    public async Task<ActionResult<UpdatePreferencesResponse>> UpdatePreferences([FromBody] UpdatePreferencesRequest request)
    {
        var userId = GetUserId();
        var result = await _userService.UpdatePreferencesAsync(userId, request);
        return Ok(result);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<UserStatsResponse>> GetStats()
    {
        var userId = GetUserId();
        var result = await _userStatsService.GetUserStatsAsync(userId);
        return Ok(result);
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
