using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Reports;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/quick-access")]
[Authorize]
public class QuickAccessController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<QuickAccessController> _logger;

    public QuickAccessController(IReportService reportService, ILogger<QuickAccessController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<PinnedReportDto>>> GetPinnedReports()
    {
        var userId = GetUserId();
        var result = await _reportService.GetPinnedReportsAsync(userId);
        return Ok(result);
    }

    [HttpPost("{reportId}")]
    public async Task<IActionResult> PinReport(int reportId)
    {
        var userId = GetUserId();
        await _reportService.PinReportAsync(userId, reportId);
        return Ok(new { success = true });
    }

    [HttpDelete("{reportId}")]
    public async Task<IActionResult> UnpinReport(int reportId)
    {
        var userId = GetUserId();
        await _reportService.UnpinReportAsync(userId, reportId);
        return Ok(new { success = true });
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderPinnedReports([FromBody] List<int> reportIds)
    {
        var userId = GetUserId();
        await _reportService.ReorderPinnedReportsAsync(userId, reportIds);
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
