using Microsoft.EntityFrameworkCore;
using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Data.Repositories;

public interface IHubRepository
{
    Task<List<ReportingHub>> GetAllAsync(bool includeInactive = false);
    Task<ReportingHub?> GetByIdAsync(int hubId);
    Task<List<ReportingHub>> GetAccessibleByUserIdAsync(int userId);
    Task<ReportingHub> CreateAsync(ReportingHub hub);
    Task UpdateAsync(ReportingHub hub);
    Task DeleteAsync(int hubId, bool hardDelete = false);
    Task ReorderAsync(List<int> hubIds);
}

public class HubRepository : IHubRepository
{
    private readonly ApplicationDbContext _context;

    public HubRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ReportingHub>> GetAllAsync(bool includeInactive = false)
    {
        var query = _context.ReportingHubs
            .Include(h => h.ReportGroups)
                .ThenInclude(rg => rg.Reports)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(h => h.IsActive);
        }

        return await query.OrderBy(h => h.SortOrder).ThenBy(h => h.HubName).ToListAsync();
    }

    public async Task<ReportingHub?> GetByIdAsync(int hubId)
    {
        return await _context.ReportingHubs
            .Include(h => h.ReportGroups)
                .ThenInclude(rg => rg.Reports)
            .FirstOrDefaultAsync(h => h.HubId == hubId);
    }

    public Task<List<ReportingHub>> GetAccessibleByUserIdAsync(int userId) => throw new NotImplementedException();

    public async Task<ReportingHub> CreateAsync(ReportingHub hub)
    {

        var maxSortOrder = await _context.ReportingHubs.MaxAsync(h => (int?)h.SortOrder) ?? 0;
        hub.SortOrder = maxSortOrder + 1;
        hub.CreatedAt = DateTime.UtcNow;

        _context.ReportingHubs.Add(hub);
        await _context.SaveChangesAsync();
        return hub;
    }

    public async Task UpdateAsync(ReportingHub hub)
    {
        hub.UpdatedAt = DateTime.UtcNow;
        _context.ReportingHubs.Update(hub);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int hubId, bool hardDelete = false)
    {
        var hub = await _context.ReportingHubs.FindAsync(hubId);
        if (hub == null) return;

        if (hardDelete)
        {
            _context.ReportingHubs.Remove(hub);
        }
        else
        {
            hub.IsActive = false;
            hub.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }

    public async Task ReorderAsync(List<int> hubIds)
    {
        for (int i = 0; i < hubIds.Count; i++)
        {
            var hub = await _context.ReportingHubs.FindAsync(hubIds[i]);
            if (hub != null)
            {
                hub.SortOrder = i + 1;
                hub.UpdatedAt = DateTime.UtcNow;
            }
        }
        await _context.SaveChangesAsync();
    }
}
