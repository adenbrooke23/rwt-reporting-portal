using RWTReportingPortal.API.Models.DTOs.Admin;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IReportGroupService
{
    // Admin CRUD methods
    Task<List<AdminReportGroupDto>> GetAllReportGroupsAsync(bool includeInactive = false);
    Task<List<AdminReportGroupDto>> GetReportGroupsByHubAsync(int hubId, bool includeInactive = false);
    Task<AdminReportGroupDto?> GetReportGroupByIdAsync(int reportGroupId);
    Task<AdminReportGroupDto> CreateReportGroupAsync(CreateReportGroupRequest request, int createdBy);
    Task<AdminReportGroupDto> UpdateReportGroupAsync(int reportGroupId, UpdateReportGroupRequest request, int updatedBy);
    Task DeleteReportGroupAsync(int reportGroupId, bool hardDelete = false);
}
