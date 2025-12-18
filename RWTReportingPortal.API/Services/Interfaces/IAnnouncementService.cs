using RWTReportingPortal.API.Models.DTOs.Announcements;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IAnnouncementService
{
    Task<AnnouncementListResponse> GetPublishedAnnouncementsAsync(int limit = 10);
    Task<AnnouncementDto?> GetAnnouncementAsync(int announcementId);
    Task<List<AdminAnnouncementDto>> GetAllAnnouncementsAsync(bool includeUnpublished = true, bool includeDeleted = false);
    Task<AdminAnnouncementDto> CreateAnnouncementAsync(CreateAnnouncementRequest request, int authorId);
    Task<AdminAnnouncementDto> UpdateAnnouncementAsync(int announcementId, UpdateAnnouncementRequest request);
    Task PublishAnnouncementAsync(int announcementId);
    Task UnpublishAnnouncementAsync(int announcementId);
    Task DeleteAnnouncementAsync(int announcementId, int deletedBy);
    Task RestoreAnnouncementAsync(int announcementId);
}
