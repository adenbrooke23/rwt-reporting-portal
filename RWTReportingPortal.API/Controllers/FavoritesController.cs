using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Reports;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<FavoritesController> _logger;

    public FavoritesController(IReportService reportService, ILogger<FavoritesController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<FavoriteDto>>> GetFavorites()
    {
        var userId = GetUserId();
        var result = await _reportService.GetFavoritesAsync(userId);
        return Ok(result);
    }

    [HttpPost("{reportId}")]
    public async Task<IActionResult> AddFavorite(int reportId)
    {
        var userId = GetUserId();
        await _reportService.AddFavoriteAsync(userId, reportId);
        return Ok(new { success = true });
    }

    [HttpDelete("{reportId}")]
    public async Task<IActionResult> RemoveFavorite(int reportId)
    {
        var userId = GetUserId();
        await _reportService.RemoveFavoriteAsync(userId, reportId);
        return Ok(new { success = true });
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderFavorites([FromBody] List<int> reportIds)
    {
        var userId = GetUserId();
        await _reportService.ReorderFavoritesAsync(userId, reportIds);
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
