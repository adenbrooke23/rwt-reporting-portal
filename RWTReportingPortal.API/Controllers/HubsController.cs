using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Hubs;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/hubs")]
[Authorize]
public class HubsController : ControllerBase
{
    private readonly IHubService _hubService;
    private readonly ILogger<HubsController> _logger;

    public HubsController(IHubService hubService, ILogger<HubsController> logger)
    {
        _hubService = hubService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<HubListResponse>> GetHubs()
    {
        var userId = GetUserId();
        var result = await _hubService.GetAccessibleHubsAsync(userId);
        return Ok(result);
    }

    [HttpGet("{hubId}")]
    public async Task<ActionResult<HubDetailResponse>> GetHubDetail(int hubId)
    {
        var userId = GetUserId();
        var result = await _hubService.GetHubDetailAsync(hubId, userId);
        return Ok(result);
    }

    [HttpGet("{hubId}/reports")]
    public async Task<ActionResult<HubDetailResponse>> GetHubReports(int hubId)
    {
        var userId = GetUserId();
        var result = await _hubService.GetHubDetailAsync(hubId, userId);
        return Ok(result);
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
