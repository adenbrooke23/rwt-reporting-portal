using RWTReportingPortal.API.Models.DTOs.Hubs;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IHubService
{
    Task<HubListResponse> GetAccessibleHubsAsync(int userId);
    Task<HubDetailResponse> GetHubDetailAsync(int hubId, int userId);
    Task<List<HubDto>> GetAllHubsAsync(bool includeInactive = false);
    Task<HubDto> CreateHubAsync(HubDto hub, int createdBy);
    Task<HubDto> UpdateHubAsync(int hubId, HubDto hub, int updatedBy);
    Task DeleteHubAsync(int hubId, bool hardDelete = false);
    Task ReorderHubsAsync(List<int> hubIds);
}
