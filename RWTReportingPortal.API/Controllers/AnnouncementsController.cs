using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Announcements;
using RWTReportingPortal.API.Services.Interfaces;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/announcements")]
[Authorize]
public class AnnouncementsController : ControllerBase
{
    private readonly IAnnouncementService _announcementService;
    private readonly ILogger<AnnouncementsController> _logger;

    public AnnouncementsController(IAnnouncementService announcementService, ILogger<AnnouncementsController> logger)
    {
        _announcementService = announcementService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<AnnouncementListResponse>> GetAnnouncements([FromQuery] int limit = 10)
    {
        var result = await _announcementService.GetPublishedAnnouncementsAsync(limit);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AnnouncementDto>> GetAnnouncement(int id)
    {
        var result = await _announcementService.GetAnnouncementAsync(id);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }
}
