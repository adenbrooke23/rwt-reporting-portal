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

    // TODO: Implement repository methods
    public Task<List<Department>> GetAllAsync(bool includeInactive = false) => throw new NotImplementedException();
    public Task<Department?> GetByIdAsync(int departmentId) => throw new NotImplementedException();
    public Task<Department> CreateAsync(Department department) => throw new NotImplementedException();
    public Task UpdateAsync(Department department) => throw new NotImplementedException();
    public Task DeleteAsync(int departmentId, bool hardDelete = false) => throw new NotImplementedException();
    public Task ReorderAsync(List<int> departmentIds) => throw new NotImplementedException();
    public Task<List<UserDepartment>> GetUserDepartmentsAsync(int departmentId) => throw new NotImplementedException();
    public Task<List<ReportDepartment>> GetReportDepartmentsAsync(int departmentId) => throw new NotImplementedException();
    public Task<List<UserDepartment>> GetDepartmentsByUserIdAsync(int userId) => throw new NotImplementedException();
}
