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

    [HttpGet]
    public async Task<ActionResult<List<HubDto>>> GetHubs([FromQuery] bool includeInactive = false)
    {
        var result = await _hubService.GetAllHubsAsync(includeInactive);
        return Ok(new { hubs = result });
    }

    [HttpGet("with-reports")]
    public async Task<ActionResult<List<HubWithReportsDto>>> GetHubsWithReports([FromQuery] bool includeInactive = false)
    {
        var result = await _hubService.GetAllHubsWithReportsAsync(includeInactive);
        return Ok(new { hubs = result });
    }

    [HttpPost]
    public async Task<ActionResult<HubDto>> CreateHub([FromBody] HubDto hub)
    {
        var createdBy = GetUserId();
        var result = await _hubService.CreateHubAsync(hub, createdBy);
        return CreatedAtAction(nameof(GetHub), new { hubId = result.HubId }, result);
    }

    [HttpGet("{hubId}")]
    public async Task<ActionResult<HubDto>> GetHub(int hubId)
    {
        var result = await _hubService.GetHubByIdAsync(hubId);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    [HttpPut("{hubId}")]
    public async Task<ActionResult<HubDto>> UpdateHub(int hubId, [FromBody] HubDto hub)
    {
        var updatedBy = GetUserId();
        var result = await _hubService.UpdateHubAsync(hubId, hub, updatedBy);
        return Ok(result);
    }

    [HttpDelete("{hubId}")]
    public async Task<IActionResult> DeleteHub(int hubId, [FromQuery] bool hardDelete = false)
    {
        await _hubService.DeleteHubAsync(hubId, hardDelete);
        return Ok(new { success = true });
    }

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
