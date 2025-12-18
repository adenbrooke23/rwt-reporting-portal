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

    // TODO: Implement repository methods
    public Task<List<ReportingHub>> GetAllAsync(bool includeInactive = false) => throw new NotImplementedException();
    public Task<ReportingHub?> GetByIdAsync(int hubId) => throw new NotImplementedException();
    public Task<List<ReportingHub>> GetAccessibleByUserIdAsync(int userId) => throw new NotImplementedException();
    public Task<ReportingHub> CreateAsync(ReportingHub hub) => throw new NotImplementedException();
    public Task UpdateAsync(ReportingHub hub) => throw new NotImplementedException();
    public Task DeleteAsync(int hubId, bool hardDelete = false) => throw new NotImplementedException();
    public Task ReorderAsync(List<int> hubIds) => throw new NotImplementedException();
}
