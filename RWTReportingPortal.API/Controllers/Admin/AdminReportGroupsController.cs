using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Admin;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/report-groups")]
[Authorize(Policy = "AdminOnly")]
public class AdminReportGroupsController : ControllerBase
{
    private readonly IReportGroupService _reportGroupService;
    private readonly ILogger<AdminReportGroupsController> _logger;

    public AdminReportGroupsController(IReportGroupService reportGroupService, ILogger<AdminReportGroupsController> logger)
    {
        _reportGroupService = reportGroupService;
        _logger = logger;
    }

    /// <summary>
    /// Get all report groups (admin view)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AdminReportGroupListResponse>> GetReportGroups([FromQuery] bool includeInactive = false)
    {
        var reportGroups = await _reportGroupService.GetAllReportGroupsAsync(includeInactive);
        return Ok(new AdminReportGroupListResponse
        {
            ReportGroups = reportGroups,
            TotalCount = reportGroups.Count
        });
    }

    /// <summary>
    /// Get report groups by hub ID
    /// </summary>
    [HttpGet("by-hub/{hubId}")]
    public async Task<ActionResult<AdminReportGroupListResponse>> GetReportGroupsByHub(int hubId, [FromQuery] bool includeInactive = false)
    {
        var reportGroups = await _reportGroupService.GetReportGroupsByHubAsync(hubId, includeInactive);
        return Ok(new AdminReportGroupListResponse
        {
            ReportGroups = reportGroups,
            TotalCount = reportGroups.Count
        });
    }

    /// <summary>
    /// Get report group by ID
    /// </summary>
    [HttpGet("{reportGroupId}")]
    public async Task<ActionResult<AdminReportGroupDto>> GetReportGroup(int reportGroupId)
    {
        var result = await _reportGroupService.GetReportGroupByIdAsync(reportGroupId);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    /// <summary>
    /// Create a new report group
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<AdminReportGroupDto>> CreateReportGroup([FromBody] CreateReportGroupRequest request)
    {
        var createdBy = GetUserId();
        var result = await _reportGroupService.CreateReportGroupAsync(request, createdBy);
        return CreatedAtAction(nameof(GetReportGroup), new { reportGroupId = result.ReportGroupId }, result);
    }

    /// <summary>
    /// Update a report group
    /// </summary>
    [HttpPut("{reportGroupId}")]
    public async Task<ActionResult<AdminReportGroupDto>> UpdateReportGroup(int reportGroupId, [FromBody] UpdateReportGroupRequest request)
    {
        var updatedBy = GetUserId();
        try
        {
            var result = await _reportGroupService.UpdateReportGroupAsync(reportGroupId, request, updatedBy);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>
    /// Delete a report group (soft delete by default)
    /// </summary>
    [HttpDelete("{reportGroupId}")]
    public async Task<IActionResult> DeleteReportGroup(int reportGroupId, [FromQuery] bool hardDelete = false)
    {
        await _reportGroupService.DeleteReportGroupAsync(reportGroupId, hardDelete);
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
