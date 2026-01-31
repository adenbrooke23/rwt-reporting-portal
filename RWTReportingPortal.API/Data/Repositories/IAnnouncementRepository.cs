using Microsoft.EntityFrameworkCore;
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

    public async Task<List<Announcement>> GetPublishedAsync(int limit = 10)
    {
        return await _context.Announcements
            .Where(a => a.IsPublished && !a.IsDeleted)
            .Include(a => a.Author)
            .OrderByDescending(a => a.IsFeatured)
            .ThenByDescending(a => a.PublishedAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<Announcement?> GetByIdAsync(int announcementId)
    {
        return await _context.Announcements
            .Include(a => a.Author)
            .FirstOrDefaultAsync(a => a.AnnouncementId == announcementId);
    }

    public async Task<List<Announcement>> GetAllAsync(bool includeUnpublished = true, bool includeDeleted = false)
    {
        var query = _context.Announcements.Include(a => a.Author).AsQueryable();

        if (!includeUnpublished)
        {
            query = query.Where(a => a.IsPublished);
        }

        if (!includeDeleted)
        {
            query = query.Where(a => !a.IsDeleted);
        }

        return await query
            .OrderByDescending(a => a.IsFeatured)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync();
    }

    public async Task<Announcement> CreateAsync(Announcement announcement)
    {
        _context.Announcements.Add(announcement);
        await _context.SaveChangesAsync();
        return announcement;
    }

    public async Task UpdateAsync(Announcement announcement)
    {
        _context.Announcements.Update(announcement);
        await _context.SaveChangesAsync();
    }
}
