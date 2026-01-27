using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Services.Interfaces;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/powerbi")]
[Authorize(Policy = "AdminOnly")]
public class AdminPowerBIController : ControllerBase
{
    private readonly IPowerBIService _powerBIService;
    private readonly ILogger<AdminPowerBIController> _logger;

    public AdminPowerBIController(
        IPowerBIService powerBIService,
        ILogger<AdminPowerBIController> logger)
    {
        _powerBIService = powerBIService;
        _logger = logger;
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        try
        {
            var config = await _powerBIService.GetConfigAsync();
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Power BI config");
            return StatusCode(500, new { error = "Failed to get Power BI configuration" });
        }
    }

    [HttpGet("test")]
    public async Task<IActionResult> TestConnection()
    {
        try
        {
            var isConnected = await _powerBIService.TestConnectionAsync();
            return Ok(new { isConnected });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing Power BI connection");
            return Ok(new { isConnected = false, error = ex.Message });
        }
    }

    [HttpGet("workspaces")]
    public async Task<IActionResult> GetWorkspaces()
    {
        try
        {
            var workspaces = await _powerBIService.GetWorkspacesAsync();
            return Ok(new { workspaces });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Power BI not configured");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Power BI workspaces");
            return StatusCode(500, new { error = "Failed to get workspaces. Check Power BI configuration and service principal access." });
        }
    }

    [HttpGet("workspaces/{workspaceId}/reports")]
    public async Task<IActionResult> GetWorkspaceReports(string workspaceId)
    {
        try
        {
            if (!Guid.TryParse(workspaceId, out _))
            {
                return BadRequest(new { error = "Invalid workspace ID format" });
            }

            var reports = await _powerBIService.GetWorkspaceReportsAsync(workspaceId);
            return Ok(new { reports });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Power BI not configured");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reports for workspace {WorkspaceId}", workspaceId);
            return StatusCode(500, new { error = "Failed to get reports from workspace" });
        }
    }

    [HttpGet("workspaces/{workspaceId}/reports/{reportId}/embed")]
    public async Task<IActionResult> GetEmbedInfo(string workspaceId, string reportId)
    {
        try
        {
            if (!Guid.TryParse(workspaceId, out _) || !Guid.TryParse(reportId, out _))
            {
                return BadRequest(new { error = "Invalid workspace ID or report ID format" });
            }

            var embedInfo = await _powerBIService.GetEmbedInfoAsync(workspaceId, reportId);
            return Ok(embedInfo);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Power BI not configured");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting embed info for report {ReportId}", reportId);
            return StatusCode(500, new { error = "Failed to generate embed token" });
        }
    }
}
