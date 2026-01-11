using RWTReportingPortal.API.Models.DTOs.Users;
using RWTReportingPortal.API.Models.DTOs.Statistics;
using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Services.Interfaces;

public interface IUserService
{
    Task<User?> GetByIdAsync(int userId);
    Task<User?> GetByIdIncludeExpiredAsync(int userId);
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByEntraObjectIdAsync(string entraObjectId);
    Task<List<User>> GetAllUsersAsync(int page = 1, int pageSize = 50, string? search = null, bool includeInactive = true, bool includeExpired = false);
    Task<int> GetUserCountAsync(string? search = null, bool includeInactive = true, bool includeExpired = false);
    Task<User> CreateAsync(User user);
    Task UpdateAsync(User user);
    Task UpdateLastActivityAsync(int userId);
    Task<UpdateAvatarResponse> UpdateAvatarAsync(int userId, string avatarId);
    Task<UpdatePreferencesResponse> UpdatePreferencesAsync(int userId, UpdatePreferencesRequest request);
    Task<UserStatsResponse> GetUserStatsAsync(int userId);
}
