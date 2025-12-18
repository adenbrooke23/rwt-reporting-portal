using RWTReportingPortal.API.Models.DTOs.Reports;

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
}
