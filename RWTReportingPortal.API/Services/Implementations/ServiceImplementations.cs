using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Identity.Client;
using Microsoft.PowerBI.Api;
using Microsoft.PowerBI.Api.Models;
using Microsoft.Rest;
using RWTReportingPortal.API.Data;
using RWTReportingPortal.API.Data.Repositories;
using RWTReportingPortal.API.Infrastructure.Auth;
using RWTReportingPortal.API.Models.DTOs.Admin;
using RWTReportingPortal.API.Models.DTOs.Announcements;
using RWTReportingPortal.API.Models.DTOs.Auth;
using RWTReportingPortal.API.Models.DTOs.Departments;
using RWTReportingPortal.API.Models.DTOs.Hubs;
using RWTReportingPortal.API.Models.DTOs.Reports;
using RWTReportingPortal.API.Models.DTOs.SSRS;
using RWTReportingPortal.API.Models.DTOs.Statistics;
using RWTReportingPortal.API.Models.DTOs.Users;
using System.Net;
using System.Security;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Caching.Memory;
using RWTReportingPortal.API.Models.Entities;
using RWTReportingPortal.API.Services.Interfaces;

using User = RWTReportingPortal.API.Models.Entities.User;
using Report = RWTReportingPortal.API.Models.Entities.Report;
using PbiReport = Microsoft.PowerBI.Api.Models.Report;

namespace RWTReportingPortal.API.Services.Implementations;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IEntraAuthService _entraAuthService;
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository,
        IJwtTokenService jwtTokenService,
        IEntraAuthService entraAuthService,
        ApplicationDbContext context,
        IConfiguration configuration,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _jwtTokenService = jwtTokenService;
        _entraAuthService = entraAuthService;
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, string ipAddress, string userAgent)
    {
        _logger.LogInformation("Login attempt for {Email}", request.Email);

        var entraResult = await _entraAuthService.AuthenticateWithPasswordAsync(request.Email, request.Password);

        if (!entraResult.Success)
        {
            _logger.LogWarning("Entra authentication failed for {Email}: {Error}", request.Email, entraResult.Error);

            var existingUser = await _userRepository.GetByEmailAsync(request.Email);
            if (existingUser != null)
            {
                await _userRepository.IncrementFailedLoginAttemptsAsync(existingUser.UserId);

                var maxAttempts = _configuration.GetValue<int>("Security:MaxFailedLoginAttempts", 5);
                if (existingUser.FailedLoginAttempts + 1 >= maxAttempts)
                {
                    existingUser.IsLockedOut = true;
                    existingUser.LockedOutUntil = DateTime.UtcNow.AddMinutes(
                        _configuration.GetValue<int>("Security:LockoutDurationMinutes", 30));
                    existingUser.LockedOutAt = DateTime.UtcNow;
                    await _userRepository.UpdateAsync(existingUser);
                }
            }

            throw new UnauthorizedAccessException(entraResult.ErrorDescription ?? "Invalid email or password");
        }

        var entraUserInfo = await _entraAuthService.GetUserInfoAsync(entraResult.AccessToken!);

        var user = await _userRepository.GetByEntraObjectIdAsync(entraUserInfo.ObjectId);

        if (user == null)
        {

            _logger.LogInformation("Creating new user for {Email}", entraUserInfo.Email);

            user = new User
            {
                EntraObjectId = entraUserInfo.ObjectId,
                Email = entraUserInfo.Email,
                FirstName = entraUserInfo.FirstName,
                LastName = entraUserInfo.LastName,
                CompanyId = 1,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            user = await _userRepository.CreateAsync(user);

            var profile = new UserProfile
            {
                UserId = user.UserId,
                DisplayName = entraUserInfo.DisplayName ?? $"{entraUserInfo.FirstName} {entraUserInfo.LastName}",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserProfiles.Add(profile);

            var preferences = new UserPreferences
            {
                UserId = user.UserId,
                ThemeId = "white",
                TableRowSize = "md",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserPreferences.Add(preferences);

            var userRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "User");
            if (userRole != null)
            {
                _context.UserRoles.Add(new UserRole
                {
                    UserId = user.UserId,
                    RoleId = userRole.RoleId,
                    GrantedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            user = await _userRepository.GetByIdWithDetailsAsync(user.UserId);
        }

        if (!user!.IsActive)
        {
            throw new UnauthorizedAccessException("Your account has been deactivated. Please contact an administrator.");
        }

        if (user.IsLockedOut && (user.LockedOutUntil == null || user.LockedOutUntil > DateTime.UtcNow))
        {
            throw new UnauthorizedAccessException("Your account is locked. Please try again later or contact an administrator.");
        }

        await _userRepository.UpdateLastLoginAsync(user.UserId);

        var roles = await _userRepository.GetUserRolesAsync(user.UserId);

        var accessToken = _jwtTokenService.GenerateAccessToken(user, roles);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();

        var session = new UserSession
        {
            SessionId = Guid.NewGuid(),
            UserId = user.UserId,
            AccessTokenHash = accessToken.GetHashCode().ToString(),
            IPAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(_configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7)),
            LastActivityAt = DateTime.UtcNow
        };
        _context.UserSessions.Add(session);
        await _context.SaveChangesAsync();

        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.UserId,
            TokenHash = refreshToken,
            SessionId = session.SessionId,
            ExpiresAt = DateTime.UtcNow.AddDays(_configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7)),
            CreatedAt = DateTime.UtcNow
        };
        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync();

        _context.LoginHistory.Add(new LoginHistory
        {
            UserId = user.UserId,
            UserEmail = user.Email,
            LoginMethod = "ROPC",
            IPAddress = ipAddress,
            UserAgent = userAgent,
            IsSuccess = true,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        _logger.LogInformation("User {Email} logged in successfully", user.Email);

        return new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _configuration.GetValue<int>("Jwt:AccessTokenExpirationMinutes", 15) * 60,
            User = MapUserToDto(user, roles)
        };
    }

    public async Task<LoginResponse> HandleSSOCallbackAsync(string code, string redirectUri, string ipAddress, string userAgent)
    {

        var entraResult = await _entraAuthService.ExchangeCodeForTokenAsync(code, redirectUri);

        if (!entraResult.Success)
        {
            _logger.LogWarning("SSO callback failed: {Error}", entraResult.Error);
            throw new UnauthorizedAccessException(entraResult.ErrorDescription ?? "SSO authentication failed");
        }

        var entraUserInfo = await _entraAuthService.GetUserInfoAsync(entraResult.AccessToken!);

        var user = await _userRepository.GetByEntraObjectIdAsync(entraUserInfo.ObjectId);

        if (user == null)
        {

            user = new User
            {
                EntraObjectId = entraUserInfo.ObjectId,
                Email = entraUserInfo.Email,
                FirstName = entraUserInfo.FirstName,
                LastName = entraUserInfo.LastName,
                CompanyId = 1,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            user = await _userRepository.CreateAsync(user);

            var profile = new UserProfile
            {
                UserId = user.UserId,
                DisplayName = entraUserInfo.DisplayName ?? $"{entraUserInfo.FirstName} {entraUserInfo.LastName}",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserProfiles.Add(profile);

            var preferences = new UserPreferences
            {
                UserId = user.UserId,
                ThemeId = "white",
                TableRowSize = "md",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserPreferences.Add(preferences);

            var userRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "User");
            if (userRole != null)
            {
                _context.UserRoles.Add(new UserRole
                {
                    UserId = user.UserId,
                    RoleId = userRole.RoleId,
                    GrantedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            user = await _userRepository.GetByIdWithDetailsAsync(user.UserId);
        }

        if (!user!.IsActive)
        {
            throw new UnauthorizedAccessException("Your account has been deactivated.");
        }

        await _userRepository.UpdateLastLoginAsync(user.UserId);

        var roles = await _userRepository.GetUserRolesAsync(user.UserId);
        var accessToken = _jwtTokenService.GenerateAccessToken(user, roles);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();

        var session = new UserSession
        {
            SessionId = Guid.NewGuid(),
            UserId = user.UserId,
            AccessTokenHash = accessToken.GetHashCode().ToString(),
            IPAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(_configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7)),
            LastActivityAt = DateTime.UtcNow
        };
        _context.UserSessions.Add(session);
        await _context.SaveChangesAsync();

        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.UserId,
            TokenHash = refreshToken,
            SessionId = session.SessionId,
            ExpiresAt = DateTime.UtcNow.AddDays(_configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7)),
            CreatedAt = DateTime.UtcNow
        };
        _context.RefreshTokens.Add(refreshTokenEntity);

        _context.LoginHistory.Add(new LoginHistory
        {
            UserId = user.UserId,
            UserEmail = user.Email,
            LoginMethod = "SSO",
            IPAddress = ipAddress,
            UserAgent = userAgent,
            IsSuccess = true,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        return new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _configuration.GetValue<int>("Jwt:AccessTokenExpirationMinutes", 15) * 60,
            User = MapUserToDto(user, roles)
        };
    }

    public async Task<RefreshTokenResponse> RefreshTokenAsync(string refreshToken)
    {
        var tokenEntity = await _context.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == refreshToken && t.RevokedAt == null);

        if (tokenEntity == null || tokenEntity.ExpiresAt < DateTime.UtcNow)
        {
            throw new UnauthorizedAccessException("Invalid or expired refresh token");
        }

        var user = tokenEntity.User;
        if (!user.IsActive || user.IsExpired)
        {
            throw new UnauthorizedAccessException("User account is not active");
        }

        var roles = await _userRepository.GetUserRolesAsync(user.UserId);

        var newAccessToken = _jwtTokenService.GenerateAccessToken(user, roles);
        var newRefreshToken = _jwtTokenService.GenerateRefreshToken();

        tokenEntity.RevokedAt = DateTime.UtcNow;

        var newTokenEntity = new RefreshToken
        {
            UserId = user.UserId,
            TokenHash = newRefreshToken,
            SessionId = tokenEntity.SessionId,
            ExpiresAt = DateTime.UtcNow.AddDays(_configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7)),
            CreatedAt = DateTime.UtcNow
        };
        _context.RefreshTokens.Add(newTokenEntity);
        await _context.SaveChangesAsync();

        return new RefreshTokenResponse
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            ExpiresIn = _configuration.GetValue<int>("Jwt:AccessTokenExpirationMinutes", 15) * 60
        };
    }

    public async Task LogoutAsync(int userId, string sessionToken)
    {

        var tokens = await _context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("User {UserId} logged out", userId);
    }

    public async Task<CurrentUserResponse> GetCurrentUserAsync(int userId)
    {
        var user = await _userRepository.GetByIdWithDetailsAsync(userId);

        if (user == null)
        {
            throw new UnauthorizedAccessException("User not found");
        }

        var roles = user.UserRoles.Select(ur => ur.Role.RoleName).ToList();
        var isAdmin = roles.Contains("Admin");

        return new CurrentUserResponse
        {
            UserId = user.UserId,
            Email = user.Email,
            FirstName = user.FirstName ?? "",
            LastName = user.LastName ?? "",
            DisplayName = user.Profile?.DisplayName ?? $"{user.FirstName} {user.LastName}".Trim(),
            AvatarId = user.Profile?.AvatarId,
            Company = user.Company?.CompanyName ?? "",
            CompanyId = user.CompanyId ?? 0,
            Roles = roles,
            IsAdmin = isAdmin,
            Preferences = new UserPreferencesDto
            {
                ThemeId = user.Preferences?.ThemeId ?? "white",
                TableRowSize = user.Preferences?.TableRowSize ?? "md"
            },
            Departments = user.UserDepartments.Select(ud => new UserDepartmentDto
            {
                DepartmentId = ud.DepartmentId,
                DepartmentCode = ud.Department.DepartmentCode,
                DepartmentName = ud.Department.DepartmentName
            }).ToList(),
            Permissions = new UserPermissionsDto
            {
                Hubs = new List<int>(),
                ReportGroups = new List<int>(),
                Reports = new List<int>()
            }
        };
    }

    private UserDto MapUserToDto(User user, List<string> roles)
    {
        return new UserDto
        {
            UserId = user.UserId,
            Email = user.Email,
            FirstName = user.FirstName ?? "",
            LastName = user.LastName ?? "",
            DisplayName = user.Profile?.DisplayName ?? $"{user.FirstName} {user.LastName}".Trim(),
            AvatarId = user.Profile?.AvatarId,
            Company = user.Company?.CompanyName ?? "",
            CompanyId = user.CompanyId ?? 0,
            Roles = roles,
            IsAdmin = roles.Contains("Admin")
        };
    }
}

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository userRepository, ApplicationDbContext context, ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _context = context;
        _logger = logger;
    }

    public Task<User?> GetByIdAsync(int userId) => _userRepository.GetByIdAsync(userId);
    public Task<User?> GetByIdIncludeExpiredAsync(int userId) => _userRepository.GetByIdIncludeExpiredAsync(userId);
    public Task<User?> GetByEmailAsync(string email) => _userRepository.GetByEmailAsync(email);
    public Task<User?> GetByEntraObjectIdAsync(string entraObjectId) => _userRepository.GetByEntraObjectIdAsync(entraObjectId);
    public Task<List<User>> GetAllUsersAsync(int page = 1, int pageSize = 50, string? search = null, bool includeInactive = true, bool includeExpired = false)
        => _userRepository.GetAllAsync(page, pageSize, search, includeInactive, includeExpired);
    public Task<int> GetUserCountAsync(string? search = null, bool includeInactive = true, bool includeExpired = false)
        => _userRepository.GetTotalCountAsync(search, includeInactive, includeExpired);
    public Task<User> CreateAsync(User user) => _userRepository.CreateAsync(user);
    public Task UpdateAsync(User user) => _userRepository.UpdateAsync(user);
    public Task UpdateLastActivityAsync(int userId) => _userRepository.UpdateLastActivityAsync(userId);

    public async Task<UpdateAvatarResponse> UpdateAvatarAsync(int userId, string avatarId)
    {
        _logger.LogInformation("Updating avatar for user {UserId} to {AvatarId}", userId, avatarId);

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {

            profile = new UserProfile
            {
                UserId = userId,
                AvatarId = avatarId,
                CreatedAt = DateTime.UtcNow
            };
            _context.UserProfiles.Add(profile);
        }
        else
        {
            profile.AvatarId = avatarId;
            profile.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Avatar updated successfully for user {UserId}", userId);

        return new UpdateAvatarResponse
        {
            Success = true,
            AvatarId = avatarId
        };
    }

    public async Task<UpdatePreferencesResponse> UpdatePreferencesAsync(int userId, UpdatePreferencesRequest request)
    {
        _logger.LogInformation("Updating preferences for user {UserId}", userId);

        var preferences = await _context.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

        if (preferences == null)
        {

            preferences = new UserPreferences
            {
                UserId = userId,
                ThemeId = request.ThemeId ?? "white",
                TableRowSize = request.TableRowSize ?? "md",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserPreferences.Add(preferences);
        }
        else
        {
            if (request.ThemeId != null)
                preferences.ThemeId = request.ThemeId;
            if (request.TableRowSize != null)
                preferences.TableRowSize = request.TableRowSize;
            preferences.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Preferences updated successfully for user {UserId}", userId);

        return new UpdatePreferencesResponse
        {
            Success = true,
            Preferences = new PreferencesDto
            {
                ThemeId = preferences.ThemeId ?? "white",
                TableRowSize = preferences.TableRowSize ?? "md"
            }
        };
    }

    public Task<UserStatsResponse> GetUserStatsAsync(int userId) => throw new NotImplementedException();
}

public class HubService : IHubService
{
    private readonly IHubRepository _hubRepository;
    private readonly ISqlConnectionFactory _sqlConnectionFactory;
    private readonly ApplicationDbContext _context;

    public HubService(IHubRepository hubRepository, ISqlConnectionFactory sqlConnectionFactory, ApplicationDbContext context)
    {
        _hubRepository = hubRepository;
        _sqlConnectionFactory = sqlConnectionFactory;
        _context = context;
    }

    public async Task<HubListResponse> GetAccessibleHubsAsync(int userId)
    {

        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserDepartments)
            .Include(u => u.HubAccess)
            .Include(u => u.ReportAccess)
                .ThenInclude(ra => ra.Report)
                    .ThenInclude(r => r.ReportGroup)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return new HubListResponse { Hubs = new List<HubDto>() };
        }

        var isAdmin = user.UserRoles?.Any(ur =>
            ur.Role.RoleName.Equals("Admin", StringComparison.OrdinalIgnoreCase)) ?? false;

        List<ReportingHub> accessibleHubs;

        if (isAdmin)
        {

            accessibleHubs = await _context.ReportingHubs
                .Include(h => h.ReportGroups)
                    .ThenInclude(rg => rg.Reports)
                .Where(h => h.IsActive)
                .OrderBy(h => h.SortOrder)
                .ThenBy(h => h.HubName)
                .ToListAsync();
        }
        else
        {

            var accessibleHubIds = new HashSet<int>();

            var directHubIds = user.HubAccess?
                .Where(ha => ha.ExpiresAt == null || ha.ExpiresAt > DateTime.UtcNow)
                .Select(ha => ha.HubId) ?? Enumerable.Empty<int>();
            foreach (var hubId in directHubIds)
            {
                accessibleHubIds.Add(hubId);
            }

            var reportHubIds = user.ReportAccess?
                .Where(ra => ra.ExpiresAt == null || ra.ExpiresAt > DateTime.UtcNow)
                .Where(ra => ra.Report?.ReportGroup != null)
                .Select(ra => ra.Report.ReportGroup.HubId) ?? Enumerable.Empty<int>();
            foreach (var hubId in reportHubIds)
            {
                accessibleHubIds.Add(hubId);
            }

            if (user.UserDepartments?.Any() == true)
            {
                var userDepartmentIds = user.UserDepartments.Select(ud => ud.DepartmentId).ToList();

                var departmentHubIds = await _context.ReportDepartments
                    .Where(rd => userDepartmentIds.Contains(rd.DepartmentId))
                    .Include(rd => rd.Report)
                        .ThenInclude(r => r.ReportGroup)
                    .Where(rd => rd.Report.IsActive && rd.Report.ReportGroup.IsActive)
                    .Select(rd => rd.Report.ReportGroup.HubId)
                    .Distinct()
                    .ToListAsync();

                foreach (var hubId in departmentHubIds)
                {
                    accessibleHubIds.Add(hubId);
                }
            }

            accessibleHubs = await _context.ReportingHubs
                .Include(h => h.ReportGroups)
                    .ThenInclude(rg => rg.Reports)
                .Where(h => h.IsActive && accessibleHubIds.Contains(h.HubId))
                .OrderBy(h => h.SortOrder)
                .ThenBy(h => h.HubName)
                .ToListAsync();
        }

        return new HubListResponse
        {
            Hubs = accessibleHubs.Select(h => new HubDto
            {
                HubId = h.HubId,
                HubCode = h.HubCode,
                HubName = h.HubName,
                Description = h.Description,
                IconName = h.IconName,
                BackgroundImage = h.BackgroundImage,
                ReportCount = h.ReportGroups?
                    .Where(rg => rg.IsActive)
                    .Sum(rg => rg.Reports?.Count(r => r.IsActive) ?? 0) ?? 0
            }).ToList()
        };
    }

    public async Task<HubDetailResponse> GetHubDetailAsync(int hubId, int userId)
    {
        var hub = await _context.ReportingHubs
            .Include(h => h.ReportGroups)
                .ThenInclude(rg => rg.Reports)
                    .ThenInclude(r => r.ReportDepartments)
            .FirstOrDefaultAsync(h => h.HubId == hubId && h.IsActive);

        if (hub == null)
        {
            return new HubDetailResponse
            {
                HubId = hubId,
                HubName = "",
                Description = null,
                Reports = new List<HubReportDto>()
            };
        }

        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserDepartments)
            .Include(u => u.HubAccess)
            .Include(u => u.ReportAccess)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return new HubDetailResponse
            {
                HubId = hub.HubId,
                HubName = hub.HubName,
                Description = hub.Description,
                Reports = new List<HubReportDto>()
            };
        }

        var isAdmin = user.UserRoles?.Any(ur =>
            ur.Role.RoleName.Equals("Admin", StringComparison.OrdinalIgnoreCase)) ?? false;

        var hasFullHubAccess = user.HubAccess?.Any(ha =>
            ha.HubId == hubId && (ha.ExpiresAt == null || ha.ExpiresAt > DateTime.UtcNow)) ?? false;

        var userDepartmentIds = user.UserDepartments?.Select(ud => ud.DepartmentId).ToHashSet() ?? new HashSet<int>();
        var directReportAccessIds = user.ReportAccess?
            .Where(ra => ra.ExpiresAt == null || ra.ExpiresAt > DateTime.UtcNow)
            .Select(ra => ra.ReportId)
            .ToHashSet() ?? new HashSet<int>();

        var allReports = hub.ReportGroups?
            .Where(rg => rg.IsActive)
            .SelectMany(rg => rg.Reports ?? new List<Models.Entities.Report>())
            .Where(r => r.IsActive)
            .ToList() ?? new List<Models.Entities.Report>();

        List<Models.Entities.Report> accessibleReports;

        if (isAdmin || hasFullHubAccess)
        {
            accessibleReports = allReports;
        }
        else
        {
            accessibleReports = allReports.Where(r =>
                directReportAccessIds.Contains(r.ReportId) ||
                (r.ReportDepartments?.Any(rd => userDepartmentIds.Contains(rd.DepartmentId)) ?? false)
            ).ToList();
        }

        var reportDtos = accessibleReports
            .OrderBy(r => r.ReportGroup?.GroupName)
            .ThenBy(r => r.ReportName)
            .Select(r => new HubReportDto
            {
                ReportId = r.ReportId,
                ReportCode = r.ReportCode ?? "",
                ReportName = r.ReportName,
                Description = r.Description,
                ReportType = r.ReportType ?? "Unknown",
                GroupId = r.ReportGroupId,
                GroupName = r.ReportGroup?.GroupName ?? "Uncategorized",
                AccessLevel = isAdmin ? "Admin" : (hasFullHubAccess ? "Hub" :
                    (directReportAccessIds.Contains(r.ReportId) ? "Direct" : "Department"))
            })
            .ToList();

        return new HubDetailResponse
        {
            HubId = hub.HubId,
            HubName = hub.HubName,
            Description = hub.Description,
            Reports = reportDtos
        };
    }

    public async Task<HubDto?> GetHubByIdAsync(int hubId)
    {
        var hub = await _hubRepository.GetByIdAsync(hubId);
        if (hub == null) return null;

        return new HubDto
        {
            HubId = hub.HubId,
            HubCode = hub.HubCode,
            HubName = hub.HubName,
            Description = hub.Description,
            IconName = hub.IconName,
            ColorClass = hub.ColorClass,
            BackgroundImage = hub.BackgroundImage,
            SortOrder = hub.SortOrder,
            IsActive = hub.IsActive,
            ReportGroupCount = hub.ReportGroups?.Count(rg => rg.IsActive) ?? 0,
            ReportCount = hub.ReportGroups?.Sum(rg => rg.Reports?.Count(r => r.IsActive) ?? 0) ?? 0,
            CreatedAt = hub.CreatedAt,
            CreatedByEmail = null
        };
    }

    public async Task<List<HubDto>> GetAllHubsAsync(bool includeInactive = false)
    {
        var hubs = await _hubRepository.GetAllAsync(includeInactive);
        return hubs.Select(h => new HubDto
        {
            HubId = h.HubId,
            HubCode = h.HubCode,
            HubName = h.HubName,
            Description = h.Description,
            IconName = h.IconName,
            ColorClass = h.ColorClass,
            BackgroundImage = h.BackgroundImage,
            SortOrder = h.SortOrder,
            IsActive = h.IsActive,
            ReportGroupCount = h.ReportGroups?.Count(rg => rg.IsActive) ?? 0,
            ReportCount = h.ReportGroups?.Sum(rg => rg.Reports?.Count(r => r.IsActive) ?? 0) ?? 0,
            CreatedAt = h.CreatedAt,
            CreatedByEmail = null
        }).ToList();
    }

    public async Task<List<HubWithReportsDto>> GetAllHubsWithReportsAsync(bool includeInactive = false)
    {
        var hubs = await _hubRepository.GetAllAsync(includeInactive);
        return hubs.Select(h => new HubWithReportsDto
        {
            HubId = h.HubId,
            HubCode = h.HubCode,
            HubName = h.HubName,
            Description = h.Description,
            Reports = h.ReportGroups?
                .Where(rg => rg.IsActive)
                .SelectMany(rg => rg.Reports ?? new List<Models.Entities.Report>())
                .Where(r => r.IsActive)
                .Select(r => new HubReportSimpleDto
                {
                    ReportId = r.ReportId,
                    ReportName = r.ReportName,
                    Description = r.Description
                })
                .OrderBy(r => r.ReportName)
                .ToList() ?? new List<HubReportSimpleDto>()
        }).ToList();
    }

    public async Task<HubDto> CreateHubAsync(HubDto hub, int createdBy)
    {
        var entity = new Models.Entities.ReportingHub
        {
            HubCode = hub.HubCode,
            HubName = hub.HubName,
            Description = hub.Description,
            IconName = hub.IconName,
            ColorClass = hub.ColorClass,
            BackgroundImage = hub.BackgroundImage,
            IsActive = true,
            CreatedBy = createdBy
        };

        var created = await _hubRepository.CreateAsync(entity);

        return new HubDto
        {
            HubId = created.HubId,
            HubCode = created.HubCode,
            HubName = created.HubName,
            Description = created.Description,
            IconName = created.IconName,
            ColorClass = created.ColorClass,
            BackgroundImage = created.BackgroundImage,
            SortOrder = created.SortOrder,
            IsActive = created.IsActive,
            ReportGroupCount = 0,
            ReportCount = 0,
            CreatedAt = created.CreatedAt,
            CreatedByEmail = null
        };
    }

    public async Task<HubDto> UpdateHubAsync(int hubId, HubDto hub, int updatedBy)
    {
        var existing = await _hubRepository.GetByIdAsync(hubId);
        if (existing == null)
        {
            throw new KeyNotFoundException($"Hub with ID {hubId} not found");
        }

        existing.HubCode = hub.HubCode;
        existing.HubName = hub.HubName;
        existing.Description = hub.Description;
        existing.IconName = hub.IconName;
        existing.ColorClass = hub.ColorClass;
        existing.BackgroundImage = hub.BackgroundImage;
        existing.SortOrder = hub.SortOrder;
        existing.IsActive = hub.IsActive;

        await _hubRepository.UpdateAsync(existing);

        return new HubDto
        {
            HubId = existing.HubId,
            HubCode = existing.HubCode,
            HubName = existing.HubName,
            Description = existing.Description,
            IconName = existing.IconName,
            ColorClass = existing.ColorClass,
            BackgroundImage = existing.BackgroundImage,
            SortOrder = existing.SortOrder,
            IsActive = existing.IsActive,
            ReportGroupCount = existing.ReportGroups?.Count(rg => rg.IsActive) ?? 0,
            ReportCount = existing.ReportGroups?.Sum(rg => rg.Reports?.Count(r => r.IsActive) ?? 0) ?? 0,
            CreatedAt = existing.CreatedAt,
            CreatedByEmail = null
        };
    }

    public async Task DeleteHubAsync(int hubId, bool hardDelete = false)
    {
        await _hubRepository.DeleteAsync(hubId, hardDelete);
    }

    public async Task ReorderHubsAsync(List<int> hubIds)
    {
        await _hubRepository.ReorderAsync(hubIds);
    }
}

public class ReportService : IReportService
{
    private readonly IReportRepository _reportRepository;
    private readonly ApplicationDbContext _context;
    private readonly ISqlConnectionFactory _sqlConnectionFactory;
    private readonly IPowerBIService _powerBIService;
    private readonly ISSRSService _ssrsService;

    public ReportService(
        IReportRepository reportRepository,
        ApplicationDbContext context,
        ISqlConnectionFactory sqlConnectionFactory,
        IPowerBIService powerBIService,
        ISSRSService ssrsService)
    {
        _reportRepository = reportRepository;
        _context = context;
        _sqlConnectionFactory = sqlConnectionFactory;
        _powerBIService = powerBIService;
        _ssrsService = ssrsService;
    }

    public async Task<ReportDto?> GetReportAsync(int reportId, int userId)
    {
        var report = await _context.Reports
            .Include(r => r.ReportGroup)
                .ThenInclude(rg => rg!.Hub)
            .FirstOrDefaultAsync(r => r.ReportId == reportId && r.IsActive);

        if (report == null) return null;

        return new ReportDto
        {
            ReportId = report.ReportId,
            ReportCode = report.ReportCode,
            ReportName = report.ReportName,
            Description = report.Description,
            ReportType = report.ReportType,
            HubId = report.ReportGroup?.HubId ?? 0,
            HubName = report.ReportGroup?.Hub?.HubName ?? "",
            ReportGroupId = report.ReportGroupId,
            ReportGroupName = report.ReportGroup?.GroupName ?? "",
            EmbedConfig = new ReportEmbedConfigDto
            {
                WorkspaceId = report.PowerBIWorkspaceId,
                ReportId = report.PowerBIReportId,
                EmbedUrl = null, // Fetched dynamically via powerbi-embed endpoint
                ServerUrl = report.SSRSReportServer,
                ReportPath = report.SSRSReportPath
            }
        };
    }

    public async Task<ReportEmbedResponse> GetReportEmbedAsync(int reportId, int userId)
    {
        var report = await _context.Reports
            .FirstOrDefaultAsync(r => r.ReportId == reportId && r.IsActive);

        if (report == null)
        {
            return new ReportEmbedResponse { ReportId = reportId, ReportType = "Unknown" };
        }

        var response = new ReportEmbedResponse
        {
            ReportId = report.ReportId,
            ReportType = report.ReportType
        };

        if (report.ReportType == "PowerBI" || report.ReportType == "Paginated")
        {
            if (!string.IsNullOrEmpty(report.PowerBIWorkspaceId) && !string.IsNullOrEmpty(report.PowerBIReportId))
            {
                var embedInfo = await _powerBIService.GetEmbedInfoAsync(
                    report.PowerBIWorkspaceId,
                    report.PowerBIReportId
                );

                response.EmbedUrl = embedInfo.EmbedUrl;
                response.EmbedToken = embedInfo.EmbedToken;
                response.TokenExpiry = embedInfo.TokenExpiry;
            }
        }
        else if (report.ReportType == "SSRS")
        {
            if (!string.IsNullOrEmpty(report.SSRSReportServer) && !string.IsNullOrEmpty(report.SSRSReportPath))
            {
                var baseUrl = report.SSRSReportServer.TrimEnd('/');
                var path = report.SSRSReportPath.StartsWith("/") ? report.SSRSReportPath : "/" + report.SSRSReportPath;
                response.ReportUrl = $"{baseUrl}/Pages/ReportViewer.aspx?{path}&rs:Command=Render&rs:Embed=true";
            }
        }

        return response;
    }

    public async Task LogReportAccessAsync(int reportId, int userId, string accessType, string ipAddress)
    {
        try
        {
            using var connection = _sqlConnectionFactory.CreateConnection();
            connection.Open();

            using var command = connection.CreateCommand();
            command.CommandText = "portal.usp_ReportAccess_Log";
            command.CommandType = System.Data.CommandType.StoredProcedure;

            var userIdParam = command.CreateParameter();
            userIdParam.ParameterName = "@UserId";
            userIdParam.Value = userId;
            command.Parameters.Add(userIdParam);

            var reportIdParam = command.CreateParameter();
            reportIdParam.ParameterName = "@ReportId";
            reportIdParam.Value = reportId;
            command.Parameters.Add(reportIdParam);

            var accessTypeParam = command.CreateParameter();
            accessTypeParam.ParameterName = "@AccessType";
            accessTypeParam.Value = accessType ?? "VIEW";
            command.Parameters.Add(accessTypeParam);

            var ipParam = command.CreateParameter();
            ipParam.ParameterName = "@IPAddress";
            ipParam.Value = ipAddress ?? (object)DBNull.Value;
            command.Parameters.Add(ipParam);

            var userAgentParam = command.CreateParameter();
            userAgentParam.ParameterName = "@UserAgent";
            userAgentParam.Value = DBNull.Value;
            command.Parameters.Add(userAgentParam);

            await Task.Run(() => command.ExecuteNonQuery());
        }
        catch (Exception)
        {

        }
    }
    public Task<List<FavoriteDto>> GetFavoritesAsync(int userId) => throw new NotImplementedException();
    public Task AddFavoriteAsync(int userId, int reportId) => throw new NotImplementedException();
    public Task RemoveFavoriteAsync(int userId, int reportId) => throw new NotImplementedException();
    public Task ReorderFavoritesAsync(int userId, List<int> reportIds) => throw new NotImplementedException();

    public async Task<List<AdminReportDto>> GetAllReportsAsync(bool includeInactive = false)
    {
        var reports = await _reportRepository.GetAllAsync(includeInactive);

        return reports.Select(r => MapToAdminDto(r)).ToList();
    }

    public async Task<AdminReportDto?> GetReportByIdAsync(int reportId)
    {
        var report = await _reportRepository.GetByIdWithDepartmentsAsync(reportId);
        if (report == null) return null;

        return MapToAdminDto(report);
    }

    public async Task<AdminReportDto> CreateReportAsync(CreateReportRequest request, int createdBy)
    {

        var reportCode = request.ReportName.ToUpper().Replace(" ", "_");

        var existingReports = await _context.Reports
            .Where(r => r.ReportGroupId == request.ReportGroupId)
            .ToListAsync();
        var maxSortOrder = existingReports.Any() ? existingReports.Max(r => r.SortOrder) : 0;

        var report = new Report
        {
            ReportGroupId = request.ReportGroupId,
            ReportCode = reportCode,
            ReportName = request.ReportName,
            Description = request.Description,
            ReportType = request.ReportType,
            PowerBIWorkspaceId = request.PowerBIWorkspaceId,
            PowerBIReportId = request.PowerBIReportId,
            SSRSReportPath = request.SSRSReportPath,
            SSRSReportServer = request.SSRSReportServer,
            Parameters = request.Parameters,
            SortOrder = maxSortOrder + 1,
            IsActive = true,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _reportRepository.CreateAsync(report);

        if (request.DepartmentIds?.Any() == true)
        {
            foreach (var deptId in request.DepartmentIds)
            {
                _context.ReportDepartments.Add(new ReportDepartment
                {
                    ReportId = created.ReportId,
                    DepartmentId = deptId
                });
            }
            await _context.SaveChangesAsync();
        }

        var result = await _reportRepository.GetByIdWithDepartmentsAsync(created.ReportId);
        return MapToAdminDto(result!);
    }

    public async Task<AdminReportDto> UpdateReportAsync(int reportId, UpdateReportRequest request, int updatedBy)
    {
        var report = await _reportRepository.GetByIdWithDepartmentsAsync(reportId);
        if (report == null)
        {
            throw new KeyNotFoundException($"Report with ID {reportId} not found");
        }

        if (request.ReportGroupId.HasValue)
            report.ReportGroupId = request.ReportGroupId.Value;
        if (request.ReportName != null)
        {
            report.ReportName = request.ReportName;
            report.ReportCode = request.ReportName.ToUpper().Replace(" ", "_");
        }
        if (request.Description != null)
            report.Description = request.Description;
        if (request.ReportType != null)
            report.ReportType = request.ReportType;
        if (request.PowerBIWorkspaceId != null)
            report.PowerBIWorkspaceId = request.PowerBIWorkspaceId;
        if (request.PowerBIReportId != null)
            report.PowerBIReportId = request.PowerBIReportId;
        if (request.PowerBIEmbedUrl != null)
            report.PowerBIReportId = request.PowerBIReportId;
        if (request.SSRSReportPath != null)
            report.SSRSReportPath = request.SSRSReportPath;
        if (request.SSRSReportServer != null)
            report.SSRSReportServer = request.SSRSReportServer;
        if (request.Parameters != null)
            report.Parameters = request.Parameters;
        if (request.IsActive.HasValue)
            report.IsActive = request.IsActive.Value;

        await _reportRepository.UpdateAsync(report);

        if (request.DepartmentIds != null)
        {

            var existingDepts = await _context.ReportDepartments
                .Where(rd => rd.ReportId == reportId)
                .ToListAsync();
            _context.ReportDepartments.RemoveRange(existingDepts);

            foreach (var deptId in request.DepartmentIds)
            {
                _context.ReportDepartments.Add(new ReportDepartment
                {
                    ReportId = reportId,
                    DepartmentId = deptId
                });
            }
            await _context.SaveChangesAsync();
        }

        var result = await _reportRepository.GetByIdWithDepartmentsAsync(reportId);
        return MapToAdminDto(result!);
    }

    public async Task DeleteReportAsync(int reportId, bool hardDelete = false)
    {
        await _reportRepository.DeleteAsync(reportId, hardDelete);
    }

    private AdminReportDto MapToAdminDto(Report report)
    {
        return new AdminReportDto
        {
            ReportId = report.ReportId,
            ReportGroupId = report.ReportGroupId,
            ReportGroupName = report.ReportGroup?.GroupName ?? "",
            HubId = report.ReportGroup?.HubId ?? 0,
            HubName = report.ReportGroup?.Hub?.HubName ?? "",
            ReportCode = report.ReportCode,
            ReportName = report.ReportName,
            Description = report.Description,
            ReportType = report.ReportType,
            PowerBIWorkspaceId = report.PowerBIWorkspaceId,
            PowerBIReportId = report.PowerBIReportId,
            SSRSReportPath = report.SSRSReportPath,
            SSRSReportServer = report.SSRSReportServer,
            Parameters = report.Parameters,
            SortOrder = report.SortOrder,
            IsActive = report.IsActive,
            CreatedAt = report.CreatedAt,
            DepartmentIds = report.ReportDepartments?.Select(rd => rd.DepartmentId).ToList() ?? new List<int>()
        };
    }
}

public class DepartmentService : IDepartmentService
{
    private readonly IDepartmentRepository _departmentRepository;
    private readonly ApplicationDbContext _context;

    public DepartmentService(IDepartmentRepository departmentRepository, ApplicationDbContext context)
    {
        _departmentRepository = departmentRepository;
        _context = context;
    }

    public async Task<DepartmentListResponse> GetAllDepartmentsAsync(bool includeInactive = false)
    {
        var query = _context.Departments.AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(d => d.IsActive);
        }

        var departments = await query
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.DepartmentName)
            .Select(d => new DepartmentDto
            {
                DepartmentId = d.DepartmentId,
                DepartmentCode = d.DepartmentCode,
                DepartmentName = d.DepartmentName,
                Description = d.Description,
                SortOrder = d.SortOrder,
                IsActive = d.IsActive,
                UserCount = d.UserDepartments.Count,
                ReportCount = d.ReportDepartments.Count,
                CreatedAt = d.CreatedAt,
                CreatedByEmail = null
            })
            .ToListAsync();

        return new DepartmentListResponse { Departments = departments };
    }
    public async Task<DepartmentDto?> GetDepartmentAsync(int departmentId)
    {
        var department = await _departmentRepository.GetByIdAsync(departmentId);
        if (department == null) return null;

        return new DepartmentDto
        {
            DepartmentId = department.DepartmentId,
            DepartmentCode = department.DepartmentCode,
            DepartmentName = department.DepartmentName,
            Description = department.Description,
            SortOrder = department.SortOrder,
            IsActive = department.IsActive,
            UserCount = department.UserDepartments?.Count ?? 0,
            ReportCount = department.ReportDepartments?.Count ?? 0,
            CreatedAt = department.CreatedAt,
            CreatedByEmail = null
        };
    }

    public async Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request, int createdBy)
    {
        var entity = new Department
        {
            DepartmentCode = request.DepartmentCode,
            DepartmentName = request.DepartmentName,
            Description = request.Description,
            IsActive = true,
            CreatedBy = createdBy
        };

        var created = await _departmentRepository.CreateAsync(entity);

        return new DepartmentDto
        {
            DepartmentId = created.DepartmentId,
            DepartmentCode = created.DepartmentCode,
            DepartmentName = created.DepartmentName,
            Description = created.Description,
            SortOrder = created.SortOrder,
            IsActive = created.IsActive,
            UserCount = 0,
            ReportCount = 0,
            CreatedAt = created.CreatedAt,
            CreatedByEmail = null
        };
    }

    public async Task<DepartmentDto> UpdateDepartmentAsync(int departmentId, UpdateDepartmentRequest request, int updatedBy)
    {
        var existing = await _departmentRepository.GetByIdAsync(departmentId);
        if (existing == null)
        {
            throw new KeyNotFoundException($"Department with ID {departmentId} not found");
        }

        if (request.DepartmentName != null)
            existing.DepartmentName = request.DepartmentName;
        if (request.Description != null)
            existing.Description = request.Description;
        if (request.IsActive.HasValue)
            existing.IsActive = request.IsActive.Value;

        await _departmentRepository.UpdateAsync(existing);

        return new DepartmentDto
        {
            DepartmentId = existing.DepartmentId,
            DepartmentCode = existing.DepartmentCode,
            DepartmentName = existing.DepartmentName,
            Description = existing.Description,
            SortOrder = existing.SortOrder,
            IsActive = existing.IsActive,
            UserCount = existing.UserDepartments?.Count ?? 0,
            ReportCount = existing.ReportDepartments?.Count ?? 0,
            CreatedAt = existing.CreatedAt,
            CreatedByEmail = null
        };
    }

    public async Task DeleteDepartmentAsync(int departmentId, bool hardDelete = false)
    {
        await _departmentRepository.DeleteAsync(departmentId, hardDelete);
    }

    public async Task ReorderDepartmentsAsync(List<int> departmentIds)
    {
        await _departmentRepository.ReorderAsync(departmentIds);
    }

    public async Task<DepartmentUsersResponse> GetDepartmentUsersAsync(int departmentId)
    {
        var department = await _departmentRepository.GetByIdAsync(departmentId);
        if (department == null)
        {
            throw new KeyNotFoundException($"Department with ID {departmentId} not found");
        }

        var userDepartments = await _departmentRepository.GetUserDepartmentsAsync(departmentId);

        return new DepartmentUsersResponse
        {
            DepartmentId = department.DepartmentId,
            DepartmentName = department.DepartmentName,
            Users = userDepartments.Select(ud => new DepartmentUserDto
            {
                UserId = ud.UserId,
                Email = ud.User?.Email ?? "",
                FirstName = ud.User?.FirstName ?? "",
                LastName = ud.User?.LastName ?? "",
                DisplayName = ud.User != null
                    ? $"{ud.User.FirstName} {ud.User.LastName}".Trim()
                    : null,
                GrantedAt = ud.GrantedAt,
                GrantedBy = null
            }).ToList()
        };
    }

    public async Task<DepartmentReportsResponse> GetDepartmentReportsAsync(int departmentId)
    {
        var department = await _departmentRepository.GetByIdAsync(departmentId);
        if (department == null)
        {
            throw new KeyNotFoundException($"Department with ID {departmentId} not found");
        }

        var reportDepartments = await _departmentRepository.GetReportDepartmentsAsync(departmentId);

        return new DepartmentReportsResponse
        {
            DepartmentId = department.DepartmentId,
            DepartmentName = department.DepartmentName,
            Reports = reportDepartments.Select(rd => new DepartmentReportDto
            {
                ReportId = rd.ReportId,
                ReportCode = rd.Report?.ReportCode ?? "",
                ReportName = rd.Report?.ReportName ?? "",
                HubName = "",
                GroupName = "",
                GrantedAt = rd.GrantedAt,
                GrantedBy = null
            }).ToList()
        };
    }
    public async Task AssignUserToDepartmentAsync(int userId, int departmentId, int grantedBy)
    {

        var existing = await _context.UserDepartments
            .FirstOrDefaultAsync(ud => ud.UserId == userId && ud.DepartmentId == departmentId);

        if (existing != null)
        {

            return;
        }

        var userDepartment = new UserDepartment
        {
            UserId = userId,
            DepartmentId = departmentId,
            GrantedBy = grantedBy,
            GrantedAt = DateTime.UtcNow
        };

        _context.UserDepartments.Add(userDepartment);
        await _context.SaveChangesAsync();
    }

    public async Task RemoveUserFromDepartmentAsync(int userId, int departmentId)
    {
        var userDepartment = await _context.UserDepartments
            .FirstOrDefaultAsync(ud => ud.UserId == userId && ud.DepartmentId == departmentId);

        if (userDepartment != null)
        {
            _context.UserDepartments.Remove(userDepartment);
            await _context.SaveChangesAsync();
        }
    }
    public Task AddReportDepartmentAccessAsync(int reportId, int departmentId, int grantedBy) => throw new NotImplementedException();
    public Task RemoveReportDepartmentAccessAsync(int reportId, int departmentId) => throw new NotImplementedException();
    public Task ReplaceReportDepartmentAccessAsync(int reportId, List<int> departmentIds, int grantedBy) => throw new NotImplementedException();
}

public class PermissionService : IPermissionService
{
    private readonly ISqlConnectionFactory _sqlConnectionFactory;
    private readonly IUserRepository _userRepository;
    private readonly ApplicationDbContext _context;

    public PermissionService(ISqlConnectionFactory sqlConnectionFactory, IUserRepository userRepository, ApplicationDbContext context)
    {
        _sqlConnectionFactory = sqlConnectionFactory;
        _userRepository = userRepository;
        _context = context;
    }

    public async Task<bool> CanAccessReportAsync(int userId, int reportId)
    {
        // 1. Check if user is admin
        var isAdmin = await _userRepository.IsAdminAsync(userId);
        if (isAdmin) return true;

        // Get the report with its hub info
        var report = await _context.Reports
            .Include(r => r.ReportGroup)
            .Include(r => r.ReportDepartments)
            .FirstOrDefaultAsync(r => r.ReportId == reportId && r.IsActive);

        if (report == null) return false;

        var hubId = report.ReportGroup?.HubId ?? 0;
        if (hubId == 0) return false;

        // 2. Check if user has hub access
        var hasHubAccess = await _context.UserHubAccess
            .AnyAsync(uha => uha.UserId == userId && uha.HubId == hubId
                && (uha.ExpiresAt == null || uha.ExpiresAt > DateTime.UtcNow));
        if (hasHubAccess) return true;

        // 3. Check if user has direct report access
        var hasReportAccess = await _context.UserReportAccess
            .AnyAsync(ura => ura.UserId == userId && ura.ReportId == reportId
                && (ura.ExpiresAt == null || ura.ExpiresAt > DateTime.UtcNow));
        if (hasReportAccess) return true;

        // 4. Check if user's departments match report's departments
        var reportDepartmentIds = report.ReportDepartments?.Select(rd => rd.DepartmentId).ToList() ?? new List<int>();
        if (reportDepartmentIds.Any())
        {
            var userDepartmentIds = await _context.UserDepartments
                .Where(ud => ud.UserId == userId)
                .Select(ud => ud.DepartmentId)
                .ToListAsync();

            if (reportDepartmentIds.Intersect(userDepartmentIds).Any())
            {
                return true;
            }
        }

        return false;
    }

    public async Task<bool> CanAccessHubAsync(int userId, int hubId)
    {
        // 1. Check if user is admin
        var isAdmin = await _userRepository.IsAdminAsync(userId);
        if (isAdmin) return true;

        // 2. Check if user has direct hub access
        var hasHubAccess = await _context.UserHubAccess
            .AnyAsync(uha => uha.UserId == userId && uha.HubId == hubId
                && (uha.ExpiresAt == null || uha.ExpiresAt > DateTime.UtcNow));
        if (hasHubAccess) return true;

        // 3. Check if user has access to any report in this hub
        var hubReportIds = await _context.Reports
            .Where(r => r.ReportGroup!.HubId == hubId && r.IsActive)
            .Select(r => r.ReportId)
            .ToListAsync();

        // Check direct report access
        var hasReportAccess = await _context.UserReportAccess
            .AnyAsync(ura => ura.UserId == userId && hubReportIds.Contains(ura.ReportId)
                && (ura.ExpiresAt == null || ura.ExpiresAt > DateTime.UtcNow));
        if (hasReportAccess) return true;

        // 4. Check if user's departments have any reports in this hub
        var userDepartmentIds = await _context.UserDepartments
            .Where(ud => ud.UserId == userId)
            .Select(ud => ud.DepartmentId)
            .ToListAsync();

        if (userDepartmentIds.Any())
        {
            var hasAccessViaDepartment = await _context.ReportDepartments
                .AnyAsync(rd => hubReportIds.Contains(rd.ReportId) && userDepartmentIds.Contains(rd.DepartmentId));
            if (hasAccessViaDepartment) return true;
        }

        return false;
    }
    public Task<bool> IsAdminAsync(int userId) => _userRepository.IsAdminAsync(userId);

    public async Task<UserPermissionsResponse> GetUserPermissionsAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.UserDepartments)
                .ThenInclude(ud => ud.Department)
            .Include(u => u.HubAccess)
                .ThenInclude(ha => ha.Hub)
            .Include(u => u.ReportAccess)
                .ThenInclude(ra => ra.Report)
                    .ThenInclude(r => r.ReportGroup)
                        .ThenInclude(rg => rg.Hub)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return new UserPermissionsResponse
            {
                UserId = userId,
                Email = "",
                IsAdmin = false,
                Departments = new List<UserDepartmentPermissionDto>(),
                Permissions = new PermissionsDto()
            };
        }

        var isAdmin = await _userRepository.IsAdminAsync(userId);

        var departments = user.UserDepartments?.Select(ud => new UserDepartmentPermissionDto
        {
            UserDepartmentId = ud.UserDepartmentId,
            DepartmentId = ud.DepartmentId,
            DepartmentCode = ud.Department?.DepartmentCode ?? "",
            DepartmentName = ud.Department?.DepartmentName ?? "",
            GrantedAt = ud.GrantedAt,
            GrantedBy = null
        }).ToList() ?? new List<UserDepartmentPermissionDto>();

        var hubPermissions = user.HubAccess?
            .Where(ha => ha.ExpiresAt == null || ha.ExpiresAt > DateTime.UtcNow)
            .Select(ha => new HubPermissionDto
            {
                PermissionId = ha.UserHubAccessId,
                HubId = ha.HubId,
                HubName = ha.Hub?.HubName ?? "",
                GrantedAt = ha.GrantedAt,
                GrantedBy = null,
                ExpiresAt = ha.ExpiresAt
            }).ToList() ?? new List<HubPermissionDto>();

        var reportPermissions = user.ReportAccess?
            .Where(ra => ra.ExpiresAt == null || ra.ExpiresAt > DateTime.UtcNow)
            .Select(ra => new ReportPermissionDto
            {
                PermissionId = ra.UserReportAccessId,
                ReportId = ra.ReportId,
                ReportName = ra.Report?.ReportName ?? "",
                GroupName = ra.Report?.ReportGroup?.GroupName ?? "",
                HubId = ra.Report?.ReportGroup?.HubId ?? 0,
                HubName = ra.Report?.ReportGroup?.Hub?.HubName ?? "",
                GrantedAt = ra.GrantedAt,
                GrantedBy = null,
                ExpiresAt = ra.ExpiresAt
            }).ToList() ?? new List<ReportPermissionDto>();

        return new UserPermissionsResponse
        {
            UserId = userId,
            Email = user.Email,
            IsAdmin = isAdmin,
            Departments = departments,
            Permissions = new PermissionsDto
            {
                Hubs = hubPermissions,
                ReportGroups = new List<ReportGroupPermissionDto>(),
                Reports = reportPermissions
            }
        };
    }

    public async Task GrantHubAccessAsync(int userId, int hubId, int grantedBy, DateTime? expiresAt = null)
    {

        var existingAccess = await _context.UserHubAccess
            .FirstOrDefaultAsync(uha => uha.UserId == userId && uha.HubId == hubId);

        if (existingAccess != null)
        {

            existingAccess.ExpiresAt = expiresAt;
            existingAccess.GrantedAt = DateTime.UtcNow;
            existingAccess.GrantedBy = grantedBy;
        }
        else
        {
            var hubAccess = new UserHubAccess
            {
                UserId = userId,
                HubId = hubId,
                GrantedBy = grantedBy,
                GrantedAt = DateTime.UtcNow,
                ExpiresAt = expiresAt
            };
            _context.UserHubAccess.Add(hubAccess);
        }

        await _context.SaveChangesAsync();
    }

    public Task GrantReportGroupAccessAsync(int userId, int reportGroupId, int grantedBy, DateTime? expiresAt = null) => throw new NotImplementedException();

    public async Task GrantReportAccessAsync(int userId, int reportId, int grantedBy, DateTime? expiresAt = null)
    {

        var existingAccess = await _context.UserReportAccess
            .FirstOrDefaultAsync(ura => ura.UserId == userId && ura.ReportId == reportId);

        if (existingAccess != null)
        {

            existingAccess.ExpiresAt = expiresAt;
            existingAccess.GrantedAt = DateTime.UtcNow;
            existingAccess.GrantedBy = grantedBy;
        }
        else
        {
            var reportAccess = new UserReportAccess
            {
                UserId = userId,
                ReportId = reportId,
                GrantedBy = grantedBy,
                GrantedAt = DateTime.UtcNow,
                ExpiresAt = expiresAt
            };
            _context.UserReportAccess.Add(reportAccess);
        }

        await _context.SaveChangesAsync();
    }

    public async Task RevokeHubAccessAsync(int userId, int hubId)
    {
        var access = await _context.UserHubAccess
            .FirstOrDefaultAsync(uha => uha.UserId == userId && uha.HubId == hubId);

        if (access != null)
        {
            _context.UserHubAccess.Remove(access);
            await _context.SaveChangesAsync();
        }
    }

    public async Task RevokeReportAccessAsync(int userId, int reportId)
    {
        var access = await _context.UserReportAccess
            .FirstOrDefaultAsync(ura => ura.UserId == userId && ura.ReportId == reportId);

        if (access != null)
        {
            _context.UserReportAccess.Remove(access);
            await _context.SaveChangesAsync();
        }
    }

    public Task RevokePermissionAsync(int permissionId, string permissionType) => throw new NotImplementedException();

    public async Task UpdateUserAdminRoleAsync(int userId, bool isAdmin, int grantedBy)
    {

        var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "Admin");
        if (adminRole == null)
        {
            throw new InvalidOperationException("Admin role not found in database");
        }

        var existingUserRole = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == adminRole.RoleId);

        if (isAdmin)
        {

            if (existingUserRole == null)
            {
                var userRole = new UserRole
                {
                    UserId = userId,
                    RoleId = adminRole.RoleId,
                    GrantedAt = DateTime.UtcNow,
                    GrantedBy = grantedBy
                };
                _context.UserRoles.Add(userRole);
                await _context.SaveChangesAsync();
            }

        }
        else
        {

            if (existingUserRole != null)
            {
                _context.UserRoles.Remove(existingUserRole);
                await _context.SaveChangesAsync();
            }

        }
    }
}

public class AnnouncementService : IAnnouncementService
{
    private readonly IAnnouncementRepository _announcementRepository;

    public AnnouncementService(IAnnouncementRepository announcementRepository)
    {
        _announcementRepository = announcementRepository;
    }

    public Task<AnnouncementListResponse> GetPublishedAnnouncementsAsync(int limit = 10) => throw new NotImplementedException();
    public Task<AnnouncementDto?> GetAnnouncementAsync(int announcementId) => throw new NotImplementedException();
    public Task<List<AdminAnnouncementDto>> GetAllAnnouncementsAsync(bool includeUnpublished = true, bool includeDeleted = false) => throw new NotImplementedException();
    public Task<AdminAnnouncementDto> CreateAnnouncementAsync(CreateAnnouncementRequest request, int authorId) => throw new NotImplementedException();
    public Task<AdminAnnouncementDto> UpdateAnnouncementAsync(int announcementId, UpdateAnnouncementRequest request) => throw new NotImplementedException();
    public Task PublishAnnouncementAsync(int announcementId) => throw new NotImplementedException();
    public Task UnpublishAnnouncementAsync(int announcementId) => throw new NotImplementedException();
    public Task DeleteAnnouncementAsync(int announcementId, int deletedBy) => throw new NotImplementedException();
    public Task RestoreAnnouncementAsync(int announcementId) => throw new NotImplementedException();
}

public class UserStatsService : IUserStatsService
{
    private readonly ISqlConnectionFactory _sqlConnectionFactory;

    public UserStatsService(ISqlConnectionFactory sqlConnectionFactory)
    {
        _sqlConnectionFactory = sqlConnectionFactory;
    }

    public Task<UserStatsResponse> GetUserStatsAsync(int userId) => throw new NotImplementedException();
}

public class PowerBIService : IPowerBIService
{
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PowerBIService> _logger;
    private readonly IReportRepository _reportRepository;

    private const string PowerBIApiUrl = "https://api.powerbi.com";
    private const string TokenCacheKey = "powerbi_access_token";
    private static readonly string[] Scopes = new[] { "https://analysis.windows.net/powerbi/api/.default" };

    public PowerBIService(
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<PowerBIService> logger,
        IReportRepository reportRepository)
    {
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
        _reportRepository = reportRepository;
    }

    public async Task<PowerBIConfigResponse> GetConfigAsync()
    {
        var tenantId = _configuration["PowerBI:TenantId"];
        var clientId = _configuration["PowerBI:ClientId"];
        var clientSecret = _configuration["PowerBI:ClientSecret"];

        var isConfigured = !string.IsNullOrEmpty(tenantId) &&
                          !string.IsNullOrEmpty(clientId) &&
                          !string.IsNullOrEmpty(clientSecret) &&
                          !tenantId.StartsWith("YOUR_") &&
                          !clientId.StartsWith("YOUR_") &&
                          !clientSecret.StartsWith("YOUR_");

        var response = new PowerBIConfigResponse
        {
            IsConfigured = isConfigured,
            TenantId = isConfigured ? tenantId : null,
            ClientId = isConfigured ? clientId : null
        };

        if (isConfigured)
        {
            response.IsConnected = await TestConnectionAsync();
            if (!response.IsConnected)
            {
                response.ErrorMessage = "Configuration is present but connection test failed. Check credentials.";
            }
        }
        else
        {
            response.ErrorMessage = "Power BI is not configured. Please set TenantId, ClientId, and ClientSecret in appsettings.";
        }

        return response;
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            var client = await GetPowerBIClientAsync();

            await client.Groups.GetGroupsAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Power BI connection test failed");
            return false;
        }
    }

    public async Task<List<Interfaces.PowerBIWorkspace>> GetWorkspacesAsync()
    {
        try
        {
            var client = await GetPowerBIClientAsync();
            var groups = await client.Groups.GetGroupsAsync();

            var workspaces = new List<Interfaces.PowerBIWorkspace>();

            foreach (var group in groups.Value)
            {

                var reports = await client.Reports.GetReportsInGroupAsync(new Guid(group.Id.ToString()));
                var reportCount = reports.Value.Count(r => r.ReportType == "PowerBIReport");
                var paginatedCount = reports.Value.Count(r => r.ReportType == "PaginatedReport");

                workspaces.Add(new Interfaces.PowerBIWorkspace
                {
                    WorkspaceId = group.Id.ToString(),
                    WorkspaceName = group.Name,
                    Description = "",
                    Type = "Workspace",
                    ReportCount = reportCount,
                    PaginatedReportCount = paginatedCount
                });
            }

            _logger.LogInformation("Retrieved {Count} Power BI workspaces", workspaces.Count);
            return workspaces.OrderBy(w => w.WorkspaceName).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Power BI workspaces");
            throw;
        }
    }

    public async Task<List<Interfaces.PowerBIReport>> GetWorkspaceReportsAsync(string workspaceId)
    {
        try
        {
            var client = await GetPowerBIClientAsync();
            var reports = await client.Reports.GetReportsInGroupAsync(new Guid(workspaceId));

            var existingReports = await _reportRepository.GetAllAsync(includeInactive: true);
            var existingPowerBIReportIds = existingReports
                .Where(r => !string.IsNullOrEmpty(r.PowerBIReportId))
                .ToDictionary(r => r.PowerBIReportId!, r => r.ReportId);

            var result = reports.Value.Select(r => new Interfaces.PowerBIReport
            {
                ReportId = r.Id.ToString(),
                ReportName = r.Name,
                Description = "",
                DatasetId = r.DatasetId?.ToString() ?? "",
                EmbedUrl = r.EmbedUrl,
                ReportType = r.ReportType ?? "PowerBIReport",
                ModifiedDateTime = DateTime.UtcNow,
                AlreadyImported = existingPowerBIReportIds.ContainsKey(r.Id.ToString()),
                ExistingReportId = existingPowerBIReportIds.TryGetValue(r.Id.ToString(), out var existingId) ? existingId : null
            }).ToList();

            _logger.LogInformation("Retrieved {Count} reports from workspace {WorkspaceId}", result.Count, workspaceId);
            return result.OrderBy(r => r.ReportName).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get reports from workspace {WorkspaceId}", workspaceId);
            throw;
        }
    }

    public async Task<PowerBIEmbedInfo> GetEmbedInfoAsync(string workspaceId, string reportId)
    {
        try
        {
            _logger.LogInformation("Getting embed info for report {ReportId} in workspace {WorkspaceId}", reportId, workspaceId);

            var client = await GetPowerBIClientAsync();
            var workspaceGuid = new Guid(workspaceId);
            var reportGuid = new Guid(reportId);

            _logger.LogInformation("Fetching report details from Power BI...");
            var report = await client.Reports.GetReportInGroupAsync(workspaceGuid, reportGuid);
            _logger.LogInformation("Got report: {ReportName}, EmbedUrl: {EmbedUrl}", report.Name, report.EmbedUrl);

            var generateTokenRequest = new GenerateTokenRequest(
                accessLevel: "View",
                allowSaveAs: false
            );

            _logger.LogInformation("Generating embed token...");
            var tokenResponse = await client.Reports.GenerateTokenInGroupAsync(
                workspaceGuid,
                reportGuid,
                generateTokenRequest
            );

            _logger.LogInformation("Generated embed token for report {ReportId} in workspace {WorkspaceId}, expires {Expiry}", reportId, workspaceId, tokenResponse.Expiration);

            return new PowerBIEmbedInfo
            {
                EmbedUrl = report.EmbedUrl,
                EmbedToken = tokenResponse.Token,
                ReportId = reportId,
                TokenExpiry = tokenResponse.Expiration
            };
        }
        catch (HttpOperationException httpEx)
        {
            _logger.LogError(httpEx, "Power BI API error for report {ReportId}. Status: {Status}, Response: {Response}",
                reportId, httpEx.Response?.StatusCode, httpEx.Response?.Content);
            throw new Exception($"Power BI API error: {httpEx.Response?.StatusCode} - {httpEx.Response?.Content}", httpEx);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get embed info for report {ReportId}. Error: {Error}", reportId, ex.Message);
            throw;
        }
    }

    private async Task<PowerBIClient> GetPowerBIClientAsync()
    {
        var accessToken = await GetAccessTokenAsync();
        var tokenCredentials = new TokenCredentials(accessToken, "Bearer");
        return new PowerBIClient(new Uri(PowerBIApiUrl), tokenCredentials);
    }

    private async Task<string> GetAccessTokenAsync()
    {
        if (_cache.TryGetValue(TokenCacheKey, out string? cachedToken) && !string.IsNullOrEmpty(cachedToken))
        {
            _logger.LogDebug("Using cached Power BI access token");
            return cachedToken;
        }

        var tenantId = _configuration["PowerBI:TenantId"];
        var clientId = _configuration["PowerBI:ClientId"];
        var clientSecret = _configuration["PowerBI:ClientSecret"];

        if (string.IsNullOrEmpty(tenantId) || string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            throw new InvalidOperationException("Power BI configuration is missing. Please set TenantId, ClientId, and ClientSecret.");
        }

        _logger.LogInformation("Acquiring new Power BI access token for client {ClientId}", clientId);

        var authority = $"https://login.microsoftonline.com/{tenantId}";

        try
        {
            var app = ConfidentialClientApplicationBuilder
                .Create(clientId)
                .WithClientSecret(clientSecret)
                .WithAuthority(new Uri(authority))
                .Build();

            var result = await app.AcquireTokenForClient(Scopes).ExecuteAsync();

            var cacheExpiration = result.ExpiresOn.AddMinutes(-5) - DateTimeOffset.UtcNow;
            if (cacheExpiration > TimeSpan.Zero)
            {
                _cache.Set(TokenCacheKey, result.AccessToken, cacheExpiration);
            }

            _logger.LogInformation("Acquired new Power BI access token, expires at {Expiry}", result.ExpiresOn);
            return result.AccessToken;
        }
        catch (MsalServiceException msalEx)
        {
            _logger.LogError(msalEx, "MSAL authentication failed. Error: {Error}, ErrorCode: {Code}", msalEx.Message, msalEx.ErrorCode);
            throw new Exception($"Power BI authentication failed: {msalEx.ErrorCode} - {msalEx.Message}", msalEx);
        }
    }
}

public class SSRSService : ISSRSService
{
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SSRSService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public SSRSService(
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<SSRSService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    public string GetReportUrl(string reportPath, string reportServer)
    {
        return $"{reportServer}?{reportPath}&rs:Embed=true";
    }

    public async Task<SSRSFolderListResponse> ListChildrenAsync(string folderPath)
    {
        // Use configured ReportServerPath as the root if "/" is passed
        var basePath = _configuration["SSRS:ReportServerPath"] ?? "/";
        var effectivePath = folderPath == "/" ? basePath : folderPath;

        var cacheKey = $"ssrs_folder_{effectivePath}";

        if (_cache.TryGetValue(cacheKey, out SSRSFolderListResponse? cached) && cached != null)
        {
            return cached;
        }

        try
        {
            var serverUrl = _configuration["SSRS:ReportServerUrl"];
            if (string.IsNullOrEmpty(serverUrl))
            {
                return new SSRSFolderListResponse
                {
                    CurrentPath = effectivePath,
                    Success = false,
                    ErrorMessage = "SSRS server URL not configured"
                };
            }

            // Ensure HTTPS
            if (serverUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
            {
                serverUrl = "https://" + serverUrl.Substring(7);
            }

            var soapUrl = $"{serverUrl}/ReportService2010.asmx";

            var soapEnvelope = BuildListChildrenSoapRequest(effectivePath);

            var httpClient = _httpClientFactory.CreateClient("SSRSClient");
            var content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");
            content.Headers.Add("SOAPAction", "http://schemas.microsoft.com/sqlserver/reporting/2010/03/01/ReportServer/ListChildren");

            _logger.LogInformation("Calling SSRS SOAP endpoint: {Url} for path: {Path}", soapUrl, effectivePath);

            var response = await httpClient.PostAsync(soapUrl, content);
            response.EnsureSuccessStatusCode();

            var result = ParseListChildrenResponse(await response.Content.ReadAsStringAsync());
            result.CurrentPath = effectivePath;

            _cache.Set(cacheKey, result, CacheDuration);
            return result;
        }
        catch (HttpRequestException httpEx)
        {
            _logger.LogError(httpEx, "HTTP error connecting to SSRS for path {Path}. Status: {Status}", effectivePath, httpEx.StatusCode);
            return new SSRSFolderListResponse
            {
                CurrentPath = effectivePath,
                Success = false,
                ErrorMessage = $"SSRS connection failed: {httpEx.StatusCode} - {httpEx.Message}"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list SSRS children for path {Path}. Exception: {Type} - {Message}", effectivePath, ex.GetType().Name, ex.Message);
            return new SSRSFolderListResponse
            {
                CurrentPath = effectivePath,
                Success = false,
                ErrorMessage = $"SSRS error: {ex.GetType().Name} - {ex.Message}"
            };
        }
    }

    public async Task<SSRSConfigResponse> GetServerConfigAsync()
    {
        var serverUrl = _configuration["SSRS:ReportServerUrl"] ?? "";
        var isAvailable = await TestConnectionAsync();

        return new SSRSConfigResponse
        {
            ServerUrl = serverUrl,
            IsAvailable = isAvailable,
            ErrorMessage = isAvailable ? null : "SSRS server is not reachable"
        };
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            var serverUrl = _configuration["SSRS:ReportServerUrl"];
            if (string.IsNullOrEmpty(serverUrl))
            {
                return false;
            }

            var httpClient = _httpClientFactory.CreateClient("SSRSClient");
            var response = await httpClient.GetAsync($"{serverUrl}/ReportService2010.asmx");
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SSRS connection test failed");
            return false;
        }
    }

    public Task<List<SSRSParameter>> GetReportParametersAsync(string reportPath, string reportServer)
    {

        return Task.FromResult(new List<SSRSParameter>());
    }

    private string BuildListChildrenSoapRequest(string folderPath)
    {
        return $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:soap=""http:
  <soap:Body>
    <ListChildren xmlns=""http:
      <ItemPath>{SecurityElement.Escape(folderPath)}</ItemPath>
      <Recursive>false</Recursive>
    </ListChildren>
  </soap:Body>
</soap:Envelope>";
    }

    private SSRSFolderListResponse ParseListChildrenResponse(string xml)
    {
        var result = new SSRSFolderListResponse { Success = true };

        try
        {
            var doc = XDocument.Parse(xml);
            XNamespace ns = "http://schemas.microsoft.com/sqlserver/reporting/2010/03/01/ReportServer";

            var items = doc.Descendants(ns + "CatalogItem");

            foreach (var item in items)
            {
                var hidden = bool.TryParse(item.Element(ns + "Hidden")?.Value, out var h) && h;
                if (hidden) continue;

                var catalogItem = new SSRSCatalogItem
                {
                    Name = item.Element(ns + "Name")?.Value ?? "",
                    Path = item.Element(ns + "Path")?.Value ?? "",
                    TypeName = item.Element(ns + "TypeName")?.Value ?? "",
                    Description = item.Element(ns + "Description")?.Value
                };

                if (DateTime.TryParse(item.Element(ns + "ModifiedDate")?.Value, out var modDate))
                {
                    catalogItem.ModifiedDate = modDate;
                }

                if (catalogItem.TypeName == "Folder")
                {
                    result.Folders.Add(catalogItem);
                }
                else if (catalogItem.TypeName == "Report")
                {
                    result.Reports.Add(catalogItem);
                }
            }

            result.Folders = result.Folders.OrderBy(f => f.Name).ToList();
            result.Reports = result.Reports.OrderBy(r => r.Name).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse SSRS ListChildren response");
            result.Success = false;
            result.ErrorMessage = "Failed to parse SSRS response";
        }

        return result;
    }

    public async Task<SSRSRenderResult> RenderReportAsync(string reportPath, string? reportServer = null, Dictionary<string, string>? parameters = null, string? proxyBaseUrl = null)
    {
        try
        {
            var serverUrl = reportServer ?? _configuration["SSRS:ReportServerUrl"];
            if (string.IsNullOrEmpty(serverUrl))
            {
                return new SSRSRenderResult
                {
                    Success = false,
                    ErrorMessage = "SSRS server URL not configured"
                };
            }

            var reportPathEncoded = reportPath.StartsWith("/") ? reportPath : "/" + reportPath;
            var viewerUrl = $"{serverUrl}/Pages/ReportViewer.aspx?{reportPathEncoded}&rs:Command=Render&rs:Embed=true";

            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    viewerUrl += $"&{Uri.EscapeDataString(param.Key)}={Uri.EscapeDataString(param.Value)}";
                }
            }

            _logger.LogInformation("Rendering SSRS report: {Url}", viewerUrl);

            var httpClient = _httpClientFactory.CreateClient("SSRSClient");
            var response = await httpClient.GetAsync(viewerUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("SSRS report render failed with status {Status}", response.StatusCode);
                return new SSRSRenderResult
                {
                    Success = false,
                    ErrorMessage = $"SSRS returned status {response.StatusCode}"
                };
            }

            var cookies = new List<string>();
            if (response.Headers.TryGetValues("Set-Cookie", out var cookieHeaders))
            {
                cookies.AddRange(cookieHeaders);

                var cacheKey = $"ssrs_cookies_{reportPath.GetHashCode().ToString()}";
                _cache.Set(cacheKey, cookies, TimeSpan.FromMinutes(30));
                _logger.LogDebug("Stored {Count} cookies for SSRS session", cookies.Count);
            }

            var content = await response.Content.ReadAsByteArrayAsync();
            var contentType = response.Content.Headers.ContentType?.ToString() ?? "text/html";

            if (!string.IsNullOrEmpty(proxyBaseUrl) && contentType.Contains("text/html"))
            {
                content = RewriteHtmlUrls(content, serverUrl, proxyBaseUrl);
            }

            return new SSRSRenderResult
            {
                Success = true,
                Content = content,
                ContentType = contentType,
                Cookies = cookies
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to render SSRS report {ReportPath}", reportPath);
            return new SSRSRenderResult
            {
                Success = false,
                ErrorMessage = "Failed to connect to SSRS server"
            };
        }
    }

    public async Task<SSRSRenderResult> ProxyResourceAsync(string resourcePath, string? queryString = null, string method = "GET", byte[]? requestBody = null, string? contentType = null, string? sessionKey = null)
    {
        try
        {
            var serverUrl = _configuration["SSRS:ReportServerUrl"];
            if (string.IsNullOrEmpty(serverUrl))
            {
                return new SSRSRenderResult
                {
                    Success = false,
                    ErrorMessage = "SSRS server URL not configured"
                };
            }

            var uri = new Uri(serverUrl);
            var baseUrl = $"{uri.Scheme}://{uri.Host}";
            if (!uri.IsDefaultPort)
            {
                baseUrl += $":{uri.Port}";
            }

            var resourceUrl = $"{baseUrl}{resourcePath}";
            if (!string.IsNullOrEmpty(queryString))
            {
                resourceUrl += $"?{queryString}";
            }

            _logger.LogDebug("Proxying SSRS resource: {Method} {Url}", method, resourceUrl);

            var httpClient = _httpClientFactory.CreateClient("SSRSClient");

            var request = new HttpRequestMessage(
                method == "POST" ? HttpMethod.Post : HttpMethod.Get,
                resourceUrl
            );

            if (!string.IsNullOrEmpty(sessionKey))
            {
                var cacheKey = $"ssrs_cookies_{sessionKey}";
                if (_cache.TryGetValue(cacheKey, out List<string>? cachedCookies) && cachedCookies != null)
                {

                    var cookieValues = cachedCookies
                        .Select(c => c.Split(';')[0].Trim())
                        .ToList();
                    if (cookieValues.Any())
                    {
                        request.Headers.Add("Cookie", string.Join("; ", cookieValues));
                        _logger.LogDebug("Added {Count} cookies to SSRS request", cookieValues.Count);
                    }
                }
            }

            if (method == "POST" && requestBody != null)
            {
                var httpContent = new ByteArrayContent(requestBody);
                if (!string.IsNullOrEmpty(contentType))
                {
                    httpContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType.Split(';')[0].Trim());
                }
                request.Content = httpContent;
            }

            var response = await httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("SSRS resource proxy failed: {Method} {Path} returned {Status}", method, resourcePath, response.StatusCode);
                return new SSRSRenderResult
                {
                    Success = false,
                    ErrorMessage = $"Resource returned status {response.StatusCode}"
                };
            }

            var content = await response.Content.ReadAsByteArrayAsync();
            var responseContentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";

            return new SSRSRenderResult
            {
                Success = true,
                Content = content,
                ContentType = responseContentType
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to proxy SSRS resource {Method} {Path}", method, resourcePath);
            return new SSRSRenderResult
            {
                Success = false,
                ErrorMessage = "Failed to fetch resource from SSRS server"
            };
        }
    }

    private byte[] RewriteHtmlUrls(byte[] content, string ssrsServerUrl, string proxyBaseUrl)
    {
        var html = Encoding.UTF8.GetString(content);
        var uri = new Uri(ssrsServerUrl);
        var ssrsBaseUrl = $"{uri.Scheme}://{uri.Host}";
        if (!uri.IsDefaultPort)
        {
            ssrsBaseUrl += $":{uri.Port}";
        }

        html = html.Replace($"\"{ssrsBaseUrl}/", $"\"{proxyBaseUrl}/");
        html = html.Replace($"'{ssrsBaseUrl}/", $"'{proxyBaseUrl}/");

        html = html.Replace("\"/ReportServer/", $"\"{proxyBaseUrl}/ReportServer/");
        html = html.Replace("'/ReportServer/", $"'{proxyBaseUrl}/ReportServer/");

        html = html.Replace("\"/Reports/", $"\"{proxyBaseUrl}/Reports/");
        html = html.Replace("'/Reports/", $"'{proxyBaseUrl}/Reports/");

        html = html.Replace("src=\"/ReportServer/", $"src=\"{proxyBaseUrl}/ReportServer/");
        html = html.Replace("href=\"/ReportServer/", $"href=\"{proxyBaseUrl}/ReportServer/");
        html = html.Replace("action=\"/ReportServer/", $"action=\"{proxyBaseUrl}/ReportServer/");

        return Encoding.UTF8.GetBytes(html);
    }
}

public class AuditService : IAuditService
{
    private readonly ISqlConnectionFactory _sqlConnectionFactory;
    private readonly ILogger<AuditService> _logger;

    public AuditService(ISqlConnectionFactory sqlConnectionFactory, ILogger<AuditService> logger)
    {
        _sqlConnectionFactory = sqlConnectionFactory;
        _logger = logger;
    }

    public async Task LogAsync(int? userId, string? userEmail, string action, string? entityType = null,
        int? entityId = null, object? oldValues = null, object? newValues = null,
        string? description = null, string? ipAddress = null, string? userAgent = null)
    {
        try
        {
            using var connection = _sqlConnectionFactory.CreateConnection();
            connection.Open();

            using var command = connection.CreateCommand();
            command.CommandText = "portal.usp_AuditLog_Insert";
            command.CommandType = System.Data.CommandType.StoredProcedure;

            AddParameter(command, "@UserId", userId ?? (object)DBNull.Value);
            AddParameter(command, "@EventType", action);

            AddParameter(command, "@EventDescription", description ?? $"Action by {userEmail ?? "unknown"}" ?? (object)DBNull.Value);
            AddParameter(command, "@TargetType", entityType ?? (object)DBNull.Value);
            AddParameter(command, "@TargetId", entityId ?? (object)DBNull.Value);
            AddParameter(command, "@OldValues", oldValues != null ? System.Text.Json.JsonSerializer.Serialize(oldValues) : (object)DBNull.Value);
            AddParameter(command, "@NewValues", newValues != null ? System.Text.Json.JsonSerializer.Serialize(newValues) : (object)DBNull.Value);
            AddParameter(command, "@IPAddress", ipAddress ?? (object)DBNull.Value);
            AddParameter(command, "@UserAgent", userAgent ?? (object)DBNull.Value);

            await Task.Run(() => command.ExecuteNonQuery());
            _logger.LogDebug("Audit logged: {Action} by User {UserId} - {Description}", action, userId, description);
        }
        catch (Exception ex)
        {

            _logger.LogError(ex, "Failed to log audit entry: {Action} by User {UserId}", action, userId);
        }
    }

    public async Task LogLoginAsync(int? userId, string? email, string loginMethod, bool success,
        string? failureReason = null, string? ipAddress = null, string? userAgent = null)
    {

        var description = success
            ? $"User logged in via {loginMethod}"
            : $"Login failed via {loginMethod}: {failureReason ?? "Unknown reason"}";

        await LogAsync(
            userId,
            email,
            success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
            "User",
            userId,
            null,
            new { LoginMethod = loginMethod, Success = success, FailureReason = failureReason },
            description,
            ipAddress,
            userAgent
        );
    }

    private static void AddParameter(System.Data.IDbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}

public class ReportGroupService : IReportGroupService
{
    private readonly ApplicationDbContext _context;

    public ReportGroupService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<AdminReportGroupDto>> GetAllReportGroupsAsync(bool includeInactive = false)
    {
        var query = _context.ReportGroups
            .Include(g => g.Hub)
            .Include(g => g.Reports)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(g => g.IsActive);
        }

        var groups = await query
            .OrderBy(g => g.Hub.SortOrder)
            .ThenBy(g => g.SortOrder)
            .ToListAsync();

        return groups.Select(MapToDto).ToList();
    }

    public async Task<List<AdminReportGroupDto>> GetReportGroupsByHubAsync(int hubId, bool includeInactive = false)
    {
        var query = _context.ReportGroups
            .Include(g => g.Hub)
            .Include(g => g.Reports)
            .Where(g => g.HubId == hubId);

        if (!includeInactive)
        {
            query = query.Where(g => g.IsActive);
        }

        var groups = await query
            .OrderBy(g => g.SortOrder)
            .ToListAsync();

        return groups.Select(MapToDto).ToList();
    }

    public async Task<AdminReportGroupDto?> GetReportGroupByIdAsync(int reportGroupId)
    {
        var group = await _context.ReportGroups
            .Include(g => g.Hub)
            .Include(g => g.Reports)
            .FirstOrDefaultAsync(g => g.ReportGroupId == reportGroupId);

        return group == null ? null : MapToDto(group);
    }

    public async Task<AdminReportGroupDto> CreateReportGroupAsync(CreateReportGroupRequest request, int createdBy)
    {

        var groupCode = request.GroupName.ToUpper().Replace(" ", "_");

        var existingGroups = await _context.ReportGroups
            .Where(g => g.HubId == request.HubId)
            .ToListAsync();
        var maxSortOrder = existingGroups.Any() ? existingGroups.Max(g => g.SortOrder) : 0;

        var group = new ReportGroup
        {
            HubId = request.HubId,
            GroupCode = groupCode,
            GroupName = request.GroupName,
            Description = request.Description,
            SortOrder = maxSortOrder + 1,
            IsActive = true,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.ReportGroups.Add(group);
        await _context.SaveChangesAsync();

        var created = await _context.ReportGroups
            .Include(g => g.Hub)
            .Include(g => g.Reports)
            .FirstAsync(g => g.ReportGroupId == group.ReportGroupId);

        return MapToDto(created);
    }

    public async Task<AdminReportGroupDto> UpdateReportGroupAsync(int reportGroupId, UpdateReportGroupRequest request, int updatedBy)
    {
        var group = await _context.ReportGroups
            .Include(g => g.Hub)
            .Include(g => g.Reports)
            .FirstOrDefaultAsync(g => g.ReportGroupId == reportGroupId);

        if (group == null)
        {
            throw new KeyNotFoundException($"Report group with ID {reportGroupId} not found");
        }

        if (request.HubId.HasValue)
            group.HubId = request.HubId.Value;
        if (request.GroupName != null)
        {
            group.GroupName = request.GroupName;
            group.GroupCode = request.GroupName.ToUpper().Replace(" ", "_");
        }
        if (request.Description != null)
            group.Description = request.Description;
        if (request.IsActive.HasValue)
            group.IsActive = request.IsActive.Value;

        group.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(group);
    }

    public async Task DeleteReportGroupAsync(int reportGroupId, bool hardDelete = false)
    {
        var group = await _context.ReportGroups.FindAsync(reportGroupId);
        if (group == null) return;

        if (hardDelete)
        {
            _context.ReportGroups.Remove(group);
        }
        else
        {
            group.IsActive = false;
            group.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }

    private AdminReportGroupDto MapToDto(ReportGroup group)
    {
        return new AdminReportGroupDto
        {
            ReportGroupId = group.ReportGroupId,
            HubId = group.HubId,
            HubName = group.Hub?.HubName ?? "",
            GroupCode = group.GroupCode,
            GroupName = group.GroupName,
            Description = group.Description,
            SortOrder = group.SortOrder,
            IsActive = group.IsActive,
            ReportCount = group.Reports?.Count(r => r.IsActive) ?? 0,
            CreatedAt = group.CreatedAt
        };
    }
}
