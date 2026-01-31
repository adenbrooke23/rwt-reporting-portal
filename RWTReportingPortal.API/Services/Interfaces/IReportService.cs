using RWTReportingPortal.API.Models.DTOs.Reports;
using RWTReportingPortal.API.Models.DTOs.Admin;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IReportService
{

    Task<ReportDto?> GetReportAsync(int reportId, int userId);
    Task<ReportEmbedResponse> GetReportEmbedAsync(int reportId, int userId);
    Task LogReportAccessAsync(int reportId, int userId, string accessType, string ipAddress);
    Task<List<FavoriteDto>> GetFavoritesAsync(int userId);
    Task AddFavoriteAsync(int userId, int reportId);
    Task RemoveFavoriteAsync(int userId, int reportId);
    Task ReorderFavoritesAsync(int userId, List<int> reportIds);

    Task<List<PinnedReportDto>> GetPinnedReportsAsync(int userId);
    Task PinReportAsync(int userId, int reportId);
    Task UnpinReportAsync(int userId, int reportId);
    Task ReorderPinnedReportsAsync(int userId, List<int> reportIds);

    Task<List<AdminReportDto>> GetAllReportsAsync(bool includeInactive = false);
    Task<AdminReportDto?> GetReportByIdAsync(int reportId);
    Task<AdminReportDto> CreateReportAsync(CreateReportRequest request, int createdBy);
    Task<AdminReportDto> UpdateReportAsync(int reportId, UpdateReportRequest request, int updatedBy);
    Task DeleteReportAsync(int reportId, bool hardDelete = false);
}
