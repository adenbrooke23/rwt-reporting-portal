using Microsoft.EntityFrameworkCore;
using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Data.Repositories;

public interface IReportRepository
{
    Task<Report?> GetByIdAsync(int reportId);
    Task<Report?> GetByIdWithDepartmentsAsync(int reportId);
    Task<List<Report>> GetAllAsync(bool includeInactive = false);
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

    public async Task<Report?> GetByIdAsync(int reportId)
    {
        return await _context.Reports
            .Include(r => r.ReportGroup)
                .ThenInclude(g => g.Hub)
            .FirstOrDefaultAsync(r => r.ReportId == reportId);
    }

    public async Task<Report?> GetByIdWithDepartmentsAsync(int reportId)
    {
        return await _context.Reports
            .Include(r => r.ReportGroup)
                .ThenInclude(g => g.Hub)
            .Include(r => r.ReportDepartments)
            .FirstOrDefaultAsync(r => r.ReportId == reportId);
    }

    public async Task<List<Report>> GetAllAsync(bool includeInactive = false)
    {
        var query = _context.Reports
            .Include(r => r.ReportGroup)
                .ThenInclude(g => g.Hub)
            .Include(r => r.ReportDepartments)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(r => r.IsActive);
        }

        return await query
            .OrderBy(r => r.ReportGroup.Hub.SortOrder)
            .ThenBy(r => r.ReportGroup.SortOrder)
            .ThenBy(r => r.SortOrder)
            .ToListAsync();
    }

    public async Task<List<Report>> GetByHubIdAsync(int hubId, int userId)
    {
        return await _context.Reports
            .Include(r => r.ReportGroup)
            .Where(r => r.ReportGroup.HubId == hubId && r.IsActive)
            .OrderBy(r => r.ReportGroup.SortOrder)
            .ThenBy(r => r.SortOrder)
            .ToListAsync();
    }

    public async Task<List<Report>> GetAccessibleByUserIdAsync(int userId)
    {

        return await _context.Reports
            .Include(r => r.ReportGroup)
                .ThenInclude(g => g.Hub)
            .Where(r => r.IsActive)
            .OrderBy(r => r.ReportGroup.Hub.SortOrder)
            .ThenBy(r => r.ReportGroup.SortOrder)
            .ThenBy(r => r.SortOrder)
            .ToListAsync();
    }

    public async Task<Report> CreateAsync(Report report)
    {
        _context.Reports.Add(report);
        await _context.SaveChangesAsync();

        return await GetByIdWithDepartmentsAsync(report.ReportId) ?? report;
    }

    public async Task UpdateAsync(Report report)
    {
        report.UpdatedAt = DateTime.UtcNow;
        _context.Reports.Update(report);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int reportId, bool hardDelete = false)
    {
        var report = await _context.Reports.FindAsync(reportId);
        if (report == null) return;

        if (hardDelete)
        {
            _context.Reports.Remove(report);
        }
        else
        {
            report.IsActive = false;
            report.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }
}
