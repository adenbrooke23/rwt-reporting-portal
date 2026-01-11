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
    public Task<ReportingHub> CreateAsync(ReportingHub hub) => throw new NotImplementedException();
    public Task UpdateAsync(ReportingHub hub) => throw new NotImplementedException();
    public Task DeleteAsync(int hubId, bool hardDelete = false) => throw new NotImplementedException();
    public Task ReorderAsync(List<int> hubIds) => throw new NotImplementedException();
}
