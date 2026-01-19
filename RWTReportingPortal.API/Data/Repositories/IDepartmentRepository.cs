using Microsoft.EntityFrameworkCore;
using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Data.Repositories;

public interface IDepartmentRepository
{
    Task<List<Department>> GetAllAsync(bool includeInactive = false);
    Task<Department?> GetByIdAsync(int departmentId);
    Task<Department> CreateAsync(Department department);
    Task UpdateAsync(Department department);
    Task DeleteAsync(int departmentId, bool hardDelete = false);
    Task ReorderAsync(List<int> departmentIds);
    Task<List<UserDepartment>> GetUserDepartmentsAsync(int departmentId);
    Task<List<ReportDepartment>> GetReportDepartmentsAsync(int departmentId);
    Task<List<UserDepartment>> GetDepartmentsByUserIdAsync(int userId);
}

public class DepartmentRepository : IDepartmentRepository
{
    private readonly ApplicationDbContext _context;

    public DepartmentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Department>> GetAllAsync(bool includeInactive = false)
    {
        var query = _context.Departments
            .Include(d => d.UserDepartments)
            .Include(d => d.ReportDepartments)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(d => d.IsActive);
        }

        return await query.OrderBy(d => d.SortOrder).ThenBy(d => d.DepartmentName).ToListAsync();
    }

    public async Task<Department?> GetByIdAsync(int departmentId)
    {
        return await _context.Departments
            .Include(d => d.UserDepartments)
            .Include(d => d.ReportDepartments)
            .FirstOrDefaultAsync(d => d.DepartmentId == departmentId);
    }

    public async Task<Department> CreateAsync(Department department)
    {
        // Get max sort order for new department
        var maxSortOrder = await _context.Departments.MaxAsync(d => (int?)d.SortOrder) ?? 0;
        department.SortOrder = maxSortOrder + 1;
        department.CreatedAt = DateTime.UtcNow;

        _context.Departments.Add(department);
        await _context.SaveChangesAsync();
        return department;
    }

    public async Task UpdateAsync(Department department)
    {
        department.UpdatedAt = DateTime.UtcNow;
        _context.Departments.Update(department);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int departmentId, bool hardDelete = false)
    {
        var department = await _context.Departments.FindAsync(departmentId);
        if (department == null) return;

        if (hardDelete)
        {
            _context.Departments.Remove(department);
        }
        else
        {
            department.IsActive = false;
            department.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }

    public async Task ReorderAsync(List<int> departmentIds)
    {
        for (int i = 0; i < departmentIds.Count; i++)
        {
            var department = await _context.Departments.FindAsync(departmentIds[i]);
            if (department != null)
            {
                department.SortOrder = i + 1;
                department.UpdatedAt = DateTime.UtcNow;
            }
        }
        await _context.SaveChangesAsync();
    }

    public async Task<List<UserDepartment>> GetUserDepartmentsAsync(int departmentId)
    {
        return await _context.UserDepartments
            .Include(ud => ud.User)
            .Where(ud => ud.DepartmentId == departmentId)
            .ToListAsync();
    }

    public async Task<List<ReportDepartment>> GetReportDepartmentsAsync(int departmentId)
    {
        return await _context.ReportDepartments
            .Include(rd => rd.Report)
            .Where(rd => rd.DepartmentId == departmentId)
            .ToListAsync();
    }

    public async Task<List<UserDepartment>> GetDepartmentsByUserIdAsync(int userId)
    {
        return await _context.UserDepartments
            .Include(ud => ud.Department)
            .Where(ud => ud.UserId == userId)
            .ToListAsync();
    }
}
