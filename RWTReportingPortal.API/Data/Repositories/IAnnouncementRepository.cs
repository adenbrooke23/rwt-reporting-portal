using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Data.Repositories;

public interface IAnnouncementRepository
{
    Task<List<Announcement>> GetPublishedAsync(int limit = 10);
    Task<Announcement?> GetByIdAsync(int announcementId);
    Task<List<Announcement>> GetAllAsync(bool includeUnpublished = true, bool includeDeleted = false);
    Task<Announcement> CreateAsync(Announcement announcement);
    Task UpdateAsync(Announcement announcement);
}

public class AnnouncementRepository : IAnnouncementRepository
{
    private readonly ApplicationDbContext _context;

    public AnnouncementRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Announcement>> GetPublishedAsync(int limit = 10) => throw new NotImplementedException();
    public Task<Announcement?> GetByIdAsync(int announcementId) => throw new NotImplementedException();
    public Task<List<Announcement>> GetAllAsync(bool includeUnpublished = true, bool includeDeleted = false) => throw new NotImplementedException();
    public Task<Announcement> CreateAsync(Announcement announcement) => throw new NotImplementedException();
    public Task UpdateAsync(Announcement announcement) => throw new NotImplementedException();
}
