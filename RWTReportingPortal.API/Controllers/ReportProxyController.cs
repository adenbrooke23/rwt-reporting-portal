using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Infrastructure.Auth;
using RWTReportingPortal.API.Services.Interfaces;

namespace RWTReportingPortal.API.Controllers;

/// <summary>
/// Proxies report requests to SSRS/Power BI servers using server-side authentication.
/// This allows users to view reports without needing direct access to the report servers.
/// </summary>
[ApiController]
[Route("api/reports")]
public class ReportProxyController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ISSRSService _ssrsService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<ReportProxyController> _logger;

    public ReportProxyController(
        IReportService reportService,
        ISSRSService ssrsService,
        IJwtTokenService jwtTokenService,
        ILogger<ReportProxyController> logger)
    {
        _reportService = reportService;
        _ssrsService = ssrsService;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
    }

    /// <summary>
    /// Render an SSRS report by report ID.
    /// The report content is fetched server-side using Windows authentication and streamed to the client.
    /// Supports both Authorization header and query string token (for iframe embedding).
    /// </summary>
    [HttpGet("{reportId}/render")]
    public async Task<IActionResult> RenderReport(int reportId, [FromQuery] string? access_token = null)
    {
        try
        {
            // Validate authentication - check Authorization header first, then query string token
            // (query string is needed for iframe requests which can't set headers)
            if (!User.Identity?.IsAuthenticated ?? true)
            {
                if (string.IsNullOrEmpty(access_token))
                {
                    return Unauthorized(new { error = "Authentication required" });
                }

                // Validate the token from query string
                var principal = _jwtTokenService.ValidateToken(access_token);
                if (principal == null)
                {
                    return Unauthorized(new { error = "Invalid or expired token" });
                }

                _logger.LogInformation("Report render authenticated via query string token");
            }

            // Get report details from database
            var report = await _reportService.GetReportByIdAsync(reportId);
            if (report == null)
            {
                return NotFound(new { error = "Report not found" });
            }

            // Currently only SSRS reports support proxy rendering
            if (report.ReportType != "SSRS")
            {
                return BadRequest(new { error = $"Proxy rendering not supported for report type: {report.ReportType}" });
            }

            if (string.IsNullOrEmpty(report.SSRSReportPath))
            {
                return BadRequest(new { error = "Report path not configured" });
            }

            _logger.LogInformation("Proxying SSRS report {ReportId} for user", reportId);

            // Render the report via SSRS service
            var result = await _ssrsService.RenderReportAsync(
                report.SSRSReportPath,
                report.SSRSReportServer
            );

            if (!result.Success)
            {
                _logger.LogWarning("Failed to render report {ReportId}: {Error}", reportId, result.ErrorMessage);
                return StatusCode(502, new { error = result.ErrorMessage ?? "Failed to render report" });
            }

            // Return the report content
            return File(result.Content!, result.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying report {ReportId}", reportId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Render an SSRS report directly by path (for admin/testing purposes).
    /// Requires admin role via Authorization header.
    /// </summary>
    [HttpGet("ssrs/render")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> RenderSSRSReportAdmin([FromQuery] string path, [FromQuery] string? server = null)
    {
        if (string.IsNullOrEmpty(path))
        {
            return BadRequest(new { error = "Report path is required" });
        }

        _logger.LogInformation("Admin proxying SSRS report path: {Path}", path);

        var result = await _ssrsService.RenderReportAsync(path, server);

        if (!result.Success)
        {
            return StatusCode(502, new { error = result.ErrorMessage ?? "Failed to render report" });
        }

        return File(result.Content!, result.ContentType);
    }
}
