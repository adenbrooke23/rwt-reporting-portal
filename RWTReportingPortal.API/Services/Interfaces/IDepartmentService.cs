using RWTReportingPortal.API.Models.DTOs.Departments;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IDepartmentService
{
    Task<DepartmentListResponse> GetAllDepartmentsAsync(bool includeInactive = false);
    Task<DepartmentDto?> GetDepartmentAsync(int departmentId);
    Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request, int createdBy);
    Task<DepartmentDto> UpdateDepartmentAsync(int departmentId, UpdateDepartmentRequest request, int updatedBy);
    Task DeleteDepartmentAsync(int departmentId, bool hardDelete = false);
    Task ReorderDepartmentsAsync(List<int> departmentIds);
    Task<DepartmentUsersResponse> GetDepartmentUsersAsync(int departmentId);
    Task<DepartmentReportsResponse> GetDepartmentReportsAsync(int departmentId);
    Task AssignUserToDepartmentAsync(int userId, int departmentId, int grantedBy);
    Task RemoveUserFromDepartmentAsync(int userId, int departmentId);
    Task AddReportDepartmentAccessAsync(int reportId, int departmentId, int grantedBy);
    Task RemoveReportDepartmentAccessAsync(int reportId, int departmentId);
    Task ReplaceReportDepartmentAccessAsync(int reportId, List<int> departmentIds, int grantedBy);
}
