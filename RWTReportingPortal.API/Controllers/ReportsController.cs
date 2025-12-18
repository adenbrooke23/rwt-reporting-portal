using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Reports;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly IPermissionService _permissionService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(
        IReportService reportService,
        IPermissionService permissionService,
        ILogger<ReportsController> logger)
    {
        _reportService = reportService;
        _permissionService = permissionService;
        _logger = logger;
    }

    /// <summary>
    /// Get report details
    /// </summary>
    [HttpGet("{reportId}")]
    public async Task<ActionResult<ReportDto>> GetReport(int reportId)
    {
        var userId = GetUserId();

        // Check access
        if (!await _permissionService.CanAccessReportAsync(userId, reportId))
        {
            return Forbid();
        }

        var result = await _reportService.GetReportAsync(reportId, userId);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    /// <summary>
    /// Get embed token/URL for viewing a report
    /// </summary>
    [HttpGet("{reportId}/embed")]
    public async Task<ActionResult<ReportEmbedResponse>> GetReportEmbed(int reportId)
    {
        var userId = GetUserId();

        // Check access
        if (!await _permissionService.CanAccessReportAsync(userId, reportId))
        {
            return Forbid();
        }

        var result = await _reportService.GetReportEmbedAsync(reportId, userId);
        return Ok(result);
    }

    /// <summary>
    /// Log report access
    /// </summary>
    [HttpPost("{reportId}/access")]
    public async Task<IActionResult> LogReportAccess(int reportId)
    {
        var userId = GetUserId();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        await _reportService.LogReportAccessAsync(reportId, userId, "View", ipAddress);
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
