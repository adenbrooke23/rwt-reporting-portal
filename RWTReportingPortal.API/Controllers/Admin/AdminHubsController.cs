using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Hubs;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/hubs")]
[Authorize(Policy = "AdminOnly")]
public class AdminHubsController : ControllerBase
{
    private readonly IHubService _hubService;
    private readonly ILogger<AdminHubsController> _logger;

    public AdminHubsController(IHubService hubService, ILogger<AdminHubsController> logger)
    {
        _hubService = hubService;
        _logger = logger;
    }

    /// <summary>
    /// Get all hubs (admin view)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<HubDto>>> GetHubs([FromQuery] bool includeInactive = false)
    {
        var result = await _hubService.GetAllHubsAsync(includeInactive);
        return Ok(new { hubs = result });
    }

    /// <summary>
    /// Create a new hub
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<HubDto>> CreateHub([FromBody] HubDto hub)
    {
        var createdBy = GetUserId();
        var result = await _hubService.CreateHubAsync(hub, createdBy);
        return CreatedAtAction(nameof(GetHub), new { hubId = result.HubId }, result);
    }

    /// <summary>
    /// Get hub by ID
    /// </summary>
    [HttpGet("{hubId}")]
    public async Task<IActionResult> GetHub(int hubId)
    {
        var userId = GetUserId();
        var result = await _hubService.GetHubDetailAsync(hubId, userId);
        return Ok(result);
    }

    /// <summary>
    /// Update a hub
    /// </summary>
    [HttpPut("{hubId}")]
    public async Task<ActionResult<HubDto>> UpdateHub(int hubId, [FromBody] HubDto hub)
    {
        var updatedBy = GetUserId();
        var result = await _hubService.UpdateHubAsync(hubId, hub, updatedBy);
        return Ok(result);
    }

    /// <summary>
    /// Delete a hub
    /// </summary>
    [HttpDelete("{hubId}")]
    public async Task<IActionResult> DeleteHub(int hubId, [FromQuery] bool hardDelete = false)
    {
        await _hubService.DeleteHubAsync(hubId, hardDelete);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Reorder hubs
    /// </summary>
    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderHubs([FromBody] List<int> hubIds)
    {
        await _hubService.ReorderHubsAsync(hubIds);
        var result = await _hubService.GetAllHubsAsync();
        return Ok(new { hubs = result });
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
