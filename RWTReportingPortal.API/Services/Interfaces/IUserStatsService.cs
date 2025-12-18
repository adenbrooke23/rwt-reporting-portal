using RWTReportingPortal.API.Models.DTOs.Statistics;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IUserStatsService
{
    Task<UserStatsResponse> GetUserStatsAsync(int userId);
}
