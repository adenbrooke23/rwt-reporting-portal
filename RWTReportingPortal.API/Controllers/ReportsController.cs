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
    private readonly IPowerBIService _powerBIService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(
        IReportService reportService,
        IPermissionService permissionService,
        IPowerBIService powerBIService,
        ILogger<ReportsController> logger)
    {
        _reportService = reportService;
        _permissionService = permissionService;
        _powerBIService = powerBIService;
        _logger = logger;
    }

    [HttpGet("{reportId}")]
    public async Task<ActionResult<ReportDto>> GetReport(int reportId)
    {
        var userId = GetUserId();

        if (!await _permissionService.CanAccessReportAsync(userId, reportId))
        {
            return Forbid();
        }

        var result = await _reportService.GetReportAsync(reportId, userId);
        if (result == null)
        {
            return NotFound();
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        _ = _reportService.LogReportAccessAsync(reportId, userId, "View", ipAddress);

        return Ok(result);
    }

    [HttpGet("{reportId}/embed")]
    public async Task<ActionResult<ReportEmbedResponse>> GetReportEmbed(int reportId)
    {
        var userId = GetUserId();

        if (!await _permissionService.CanAccessReportAsync(userId, reportId))
        {
            return Forbid();
        }

        var result = await _reportService.GetReportEmbedAsync(reportId, userId);

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        _ = _reportService.LogReportAccessAsync(reportId, userId, "Embed", ipAddress);

        return Ok(result);
    }

    [HttpGet("{reportId}/powerbi-embed")]
    public async Task<IActionResult> GetPowerBIEmbed(int reportId)
    {
        try
        {
            var userId = GetUserId();

            var report = await _reportService.GetReportByIdAsync(reportId);
            if (report == null)
            {
                return NotFound(new { error = "Report not found" });
            }

            if (report.ReportType != "PowerBI" && report.ReportType != "Paginated")
            {
                return BadRequest(new { error = "This endpoint is only for Power BI reports" });
            }

            if (string.IsNullOrEmpty(report.PowerBIWorkspaceId) || string.IsNullOrEmpty(report.PowerBIReportId))
            {
                return BadRequest(new { error = "Report is missing Power BI workspace or report ID configuration" });
            }

            var embedInfo = await _powerBIService.GetEmbedInfoAsync(
                report.PowerBIWorkspaceId,
                report.PowerBIReportId
            );

            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            _ = _reportService.LogReportAccessAsync(reportId, userId, "PowerBI_Embed", ipAddress);

            _logger.LogInformation("Generated Power BI embed token for report {ReportId} for user {UserId}", reportId, userId);

            return Ok(embedInfo);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Power BI not configured");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Power BI embed for report {ReportId}", reportId);
            return StatusCode(500, new {
                error = "Failed to generate Power BI embed token",
                details = ex.Message,
                innerError = ex.InnerException?.Message,
                exceptionType = ex.GetType().Name
            });
        }
    }

    [HttpPost("{reportId}/access")]
    public async Task<IActionResult> LogReportAccess(int reportId)
    {
        var userId = GetUserId();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        await _reportService.LogReportAccessAsync(reportId, userId, "View", ipAddress);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Get Power BI embed token for a linked report (not in database).
    /// Used when users click links within Power BI reports that navigate to other reports.
    /// </summary>
    [HttpGet("powerbi-embed-direct")]
    public async Task<IActionResult> GetPowerBIEmbedDirect(
        [FromQuery] string workspaceId,
        [FromQuery] string reportId,
        [FromQuery] int? sourceReportId = null)
    {
        try
        {
            var userId = GetUserId();

            if (string.IsNullOrEmpty(workspaceId) || string.IsNullOrEmpty(reportId))
            {
                return BadRequest(new { error = "workspaceId and reportId are required" });
            }

            // Security check: verify user has access to at least one report in this workspace
            // (via the source report they navigated from)
            if (sourceReportId.HasValue)
            {
                if (!await _permissionService.CanAccessReportAsync(userId, sourceReportId.Value))
                {
                    return Forbid();
                }

                // Verify the source report is in the same workspace
                var sourceReport = await _reportService.GetReportByIdAsync(sourceReportId.Value);
                if (sourceReport?.PowerBIWorkspaceId != workspaceId)
                {
                    _logger.LogWarning(
                        "User {UserId} attempted to access report in workspace {WorkspaceId} from source report in different workspace",
                        userId, workspaceId);
                    return Forbid();
                }
            }

            var embedInfo = await _powerBIService.GetEmbedInfoAsync(workspaceId, reportId);

            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            _logger.LogInformation(
                "Generated Power BI embed token for linked report {ReportId} in workspace {WorkspaceId} for user {UserId}",
                reportId, workspaceId, userId);

            return Ok(embedInfo);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Power BI not configured");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Power BI embed for linked report {ReportId}", reportId);
            return StatusCode(500, new {
                error = "Failed to generate Power BI embed token",
                details = ex.Message
            });
        }
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
