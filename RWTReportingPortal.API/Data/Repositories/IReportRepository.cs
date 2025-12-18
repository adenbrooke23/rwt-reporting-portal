using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Data.Repositories;

public interface IReportRepository
{
    Task<Report?> GetByIdAsync(int reportId);
    Task<List<Report>> GetByHubIdAsync(int hubId, int userId);
    Task<List<Report>> GetAccessibleByUserIdAsync(int userId);
    Task<Report> CreateAsync(Report report);
    Task UpdateAsync(Report report);
    Task DeleteAsync(int reportId, bool hardDelete = false);
}

public class ReportRepository : IReportRepository
{
    private readonly ApplicationDbContext _context;

    public ReportRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    // TODO: Implement repository methods
    public Task<Report?> GetByIdAsync(int reportId) => throw new NotImplementedException();
    public Task<List<Report>> GetByHubIdAsync(int hubId, int userId) => throw new NotImplementedException();
    public Task<List<Report>> GetAccessibleByUserIdAsync(int userId) => throw new NotImplementedException();
    public Task<Report> CreateAsync(Report report) => throw new NotImplementedException();
    public Task UpdateAsync(Report report) => throw new NotImplementedException();
    public Task DeleteAsync(int reportId, bool hardDelete = false) => throw new NotImplementedException();
}
