using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Admin;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Policy = "AdminOnly")]
public class AdminReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<AdminReportsController> _logger;

    public AdminReportsController(IReportService reportService, ILogger<AdminReportsController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<AdminReportListResponse>> GetReports([FromQuery] bool includeInactive = false)
    {
        var reports = await _reportService.GetAllReportsAsync(includeInactive);
        return Ok(new AdminReportListResponse
        {
            Reports = reports,
            TotalCount = reports.Count
        });
    }

    [HttpGet("{reportId}")]
    public async Task<ActionResult<AdminReportDto>> GetReport(int reportId)
    {
        var result = await _reportService.GetReportByIdAsync(reportId);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<AdminReportDto>> CreateReport([FromBody] CreateReportRequest request)
    {
        var createdBy = GetUserId();
        var result = await _reportService.CreateReportAsync(request, createdBy);
        return CreatedAtAction(nameof(GetReport), new { reportId = result.ReportId }, result);
    }

    [HttpPut("{reportId}")]
    public async Task<ActionResult<AdminReportDto>> UpdateReport(int reportId, [FromBody] UpdateReportRequest request)
    {
        var updatedBy = GetUserId();
        try
        {
            var result = await _reportService.UpdateReportAsync(reportId, request, updatedBy);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{reportId}")]
    public async Task<IActionResult> DeleteReport(int reportId, [FromQuery] bool hardDelete = false)
    {
        await _reportService.DeleteReportAsync(reportId, hardDelete);
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
