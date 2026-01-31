using System.Security.Claims;
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

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("userId")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedAccessException("User ID not found in token");
        }

        return userId;
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

    // Read status tracking endpoints
    [HttpGet("read-ids")]
    public async Task<ActionResult<ReadAnnouncementIdsResponse>> GetReadAnnouncementIds()
    {
        try
        {
            var userId = GetCurrentUserId();
            var readIds = await _announcementService.GetReadAnnouncementIdsAsync(userId);
            return Ok(new ReadAnnouncementIdsResponse { ReadIds = readIds });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountResponse>> GetUnreadCount()
    {
        try
        {
            var userId = GetCurrentUserId();
            var count = await _announcementService.GetUnreadCountAsync(userId);
            return Ok(new UnreadCountResponse { UnreadCount = count });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
    }

    [HttpPost("{id}/mark-read")]
    public async Task<ActionResult<SuccessResponse>> MarkAsRead(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _announcementService.MarkAsReadAsync(userId, id);
            return Ok(new SuccessResponse { Success = true });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking announcement {AnnouncementId} as read", id);
            return StatusCode(500, new SuccessResponse { Success = false });
        }
    }

    [HttpPost("mark-all-read")]
    public async Task<ActionResult<SuccessResponse>> MarkAllAsRead()
    {
        try
        {
            var userId = GetCurrentUserId();
            await _announcementService.MarkAllAsReadAsync(userId);
            return Ok(new SuccessResponse { Success = true });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking all announcements as read");
            return StatusCode(500, new SuccessResponse { Success = false });
        }
    }
}

// Response DTOs for read status
public class ReadAnnouncementIdsResponse
{
    public List<int> ReadIds { get; set; } = new();
}

public class UnreadCountResponse
{
    public int UnreadCount { get; set; }
}

public class SuccessResponse
{
    public bool Success { get; set; }
}
