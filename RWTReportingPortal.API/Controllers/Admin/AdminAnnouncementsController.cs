using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Announcements;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/announcements")]
[Authorize(Policy = "AdminOnly")]
public class AdminAnnouncementsController : ControllerBase
{
    private readonly IAnnouncementService _announcementService;
    private readonly ILogger<AdminAnnouncementsController> _logger;

    public AdminAnnouncementsController(IAnnouncementService announcementService, ILogger<AdminAnnouncementsController> logger)
    {
        _announcementService = announcementService;
        _logger = logger;
    }

    /// <summary>
    /// Get all announcements (admin view)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<AdminAnnouncementDto>>> GetAnnouncements(
        [FromQuery] bool includeUnpublished = true,
        [FromQuery] bool includeDeleted = false)
    {
        var result = await _announcementService.GetAllAnnouncementsAsync(includeUnpublished, includeDeleted);
        return Ok(new { announcements = result });
    }

    /// <summary>
    /// Get announcement by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<AdminAnnouncementDto>> GetAnnouncement(int id)
    {
        var result = await _announcementService.GetAnnouncementAsync(id);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    /// <summary>
    /// Create a new announcement
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<AdminAnnouncementDto>> CreateAnnouncement([FromBody] CreateAnnouncementRequest request)
    {
        var authorId = GetUserId();
        var result = await _announcementService.CreateAnnouncementAsync(request, authorId);
        return CreatedAtAction(nameof(GetAnnouncement), new { id = result.AnnouncementId }, result);
    }

    /// <summary>
    /// Update an announcement
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<AdminAnnouncementDto>> UpdateAnnouncement(int id, [FromBody] UpdateAnnouncementRequest request)
    {
        var result = await _announcementService.UpdateAnnouncementAsync(id, request);
        return Ok(result);
    }

    /// <summary>
    /// Publish an announcement
    /// </summary>
    [HttpPut("{id}/publish")]
    public async Task<IActionResult> PublishAnnouncement(int id)
    {
        await _announcementService.PublishAnnouncementAsync(id);
        return Ok(new { success = true, announcementId = id, isPublished = true, publishedAt = DateTime.UtcNow });
    }

    /// <summary>
    /// Unpublish an announcement
    /// </summary>
    [HttpPut("{id}/unpublish")]
    public async Task<IActionResult> UnpublishAnnouncement(int id)
    {
        await _announcementService.UnpublishAnnouncementAsync(id);
        return Ok(new { success = true, announcementId = id, isPublished = false });
    }

    /// <summary>
    /// Delete an announcement (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAnnouncement(int id)
    {
        var deletedBy = GetUserId();
        await _announcementService.DeleteAnnouncementAsync(id, deletedBy);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Restore a deleted announcement
    /// </summary>
    [HttpPut("{id}/restore")]
    public async Task<IActionResult> RestoreAnnouncement(int id)
    {
        await _announcementService.RestoreAnnouncementAsync(id);
        return Ok(new { success = true, announcementId = id, isDeleted = false });
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
