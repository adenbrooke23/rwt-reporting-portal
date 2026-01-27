using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.SSRS;
using RWTReportingPortal.API.Services.Interfaces;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/ssrs")]
[Authorize(Policy = "AdminOnly")]
public class AdminSSRSController : ControllerBase
{
    private readonly ISSRSService _ssrsService;
    private readonly ILogger<AdminSSRSController> _logger;

    public AdminSSRSController(ISSRSService ssrsService, ILogger<AdminSSRSController> logger)
    {
        _ssrsService = ssrsService;
        _logger = logger;
    }

    [HttpGet("config")]
    public async Task<ActionResult<SSRSConfigResponse>> GetConfig()
    {
        var result = await _ssrsService.GetServerConfigAsync();
        return Ok(result);
    }

    [HttpGet("browse")]
    public async Task<ActionResult<SSRSFolderListResponse>> Browse([FromQuery] string path = "/")
    {
        _logger.LogInformation("Browsing SSRS path: {Path}", path);
        var result = await _ssrsService.ListChildrenAsync(path);
        return Ok(result);
    }

    [HttpGet("test")]
    public async Task<ActionResult<object>> TestConnection()
    {
        var isAvailable = await _ssrsService.TestConnectionAsync();
        return Ok(new { success = isAvailable });
    }
}
