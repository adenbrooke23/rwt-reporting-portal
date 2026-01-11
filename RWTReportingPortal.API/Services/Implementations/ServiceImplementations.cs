using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using RWTReportingPortal.API.Data;
using RWTReportingPortal.API.Data.Repositories;
using RWTReportingPortal.API.Infrastructure.Auth;
using RWTReportingPortal.API.Models.DTOs.Admin;
using RWTReportingPortal.API.Models.DTOs.Announcements;
using RWTReportingPortal.API.Models.DTOs.Auth;
using RWTReportingPortal.API.Models.DTOs.Departments;
using RWTReportingPortal.API.Models.DTOs.Hubs;
using RWTReportingPortal.API.Models.DTOs.Reports;
using RWTReportingPortal.API.Models.DTOs.Statistics;
using RWTReportingPortal.API.Models.DTOs.Users;
using RWTReportingPortal.API.Models.Entities;
using RWTReportingPortal.API.Services.Interfaces;

namespace RWTReportingPortal.API.Services.Implementations;

// Stub implementations - Replace with full implementations

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

        // 1. Authenticate with Entra using ROPC
        var entraResult = await _entraAuthService.AuthenticateWithPasswordAsync(request.Email, request.Password);

        if (!entraResult.Success)
        {
            _logger.LogWarning("Entra authentication failed for {Email}: {Error}", request.Email, entraResult.Error);

            // Record failed login attempt if user exists
            var existingUser = await _userRepository.GetByEmailAsync(request.Email);
            if (existingUser != null)
            {
                await _userRepository.IncrementFailedLoginAttemptsAsync(existingUser.UserId);

                // Check if should lock out
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

        // 2. Get user info from Microsoft Graph
        var entraUserInfo = await _entraAuthService.GetUserInfoAsync(entraResult.AccessToken!);

        // 3. Find or create user in our database (JIT provisioning)
        var user = await _userRepository.GetByEntraObjectIdAsync(entraUserInfo.ObjectId);

        if (user == null)
        {
            // First time login - create user (JIT provisioning)
            _logger.LogInformation("Creating new user for {Email}", entraUserInfo.Email);

            user = new User
            {
                EntraObjectId = entraUserInfo.ObjectId,
                Email = entraUserInfo.Email,
                FirstName = entraUserInfo.FirstName,
                LastName = entraUserInfo.LastName,
                CompanyId = 1, // Default company - you may want to derive this from Entra
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            user = await _userRepository.CreateAsync(user);

            // Create user profile
            var profile = new UserProfile
            {
                UserId = user.UserId,
                DisplayName = entraUserInfo.DisplayName ?? $"{entraUserInfo.FirstName} {entraUserInfo.LastName}",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserProfiles.Add(profile);

            // Create user preferences with defaults
            var preferences = new UserPreferences
            {
                UserId = user.UserId,
                ThemeId = "white",
                TableRowSize = "md",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserPreferences.Add(preferences);

            // Assign default User role
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

            // Reload user with all includes
            user = await _userRepository.GetByIdWithDetailsAsync(user.UserId);
        }

        // 4. Check if user is allowed to login
        if (!user!.IsActive)
        {
            throw new UnauthorizedAccessException("Your account has been deactivated. Please contact an administrator.");
        }

        if (user.IsLockedOut && (user.LockedOutUntil == null || user.LockedOutUntil > DateTime.UtcNow))
        {
            throw new UnauthorizedAccessException("Your account is locked. Please try again later or contact an administrator.");
        }

        // 5. Update last login
        await _userRepository.UpdateLastLoginAsync(user.UserId);

        // 6. Get user roles
        var roles = await _userRepository.GetUserRolesAsync(user.UserId);

        // 7. Generate our own JWT token
        var accessToken = _jwtTokenService.GenerateAccessToken(user, roles);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();

        // 8. Create user session first (required for refresh token FK)
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

        // 9. Store refresh token (linked to session)
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

        // 10. Log successful login
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
        // Exchange authorization code for tokens
        var entraResult = await _entraAuthService.ExchangeCodeForTokenAsync(code, redirectUri);

        if (!entraResult.Success)
        {
            _logger.LogWarning("SSO callback failed: {Error}", entraResult.Error);
            throw new UnauthorizedAccessException(entraResult.ErrorDescription ?? "SSO authentication failed");
        }

        // Get user info from Graph
        var entraUserInfo = await _entraAuthService.GetUserInfoAsync(entraResult.AccessToken!);

        // Same flow as password login from here...
        var user = await _userRepository.GetByEntraObjectIdAsync(entraUserInfo.ObjectId);

        if (user == null)
        {
            // JIT provisioning (same as in LoginAsync)
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

        // Create user session first (required for refresh token FK)
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

        // Generate new tokens
        var newAccessToken = _jwtTokenService.GenerateAccessToken(user, roles);
        var newRefreshToken = _jwtTokenService.GenerateRefreshToken();

        // Revoke old refresh token
        tokenEntity.RevokedAt = DateTime.UtcNow;

        // Create new refresh token (reuse the existing session)
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
        // Revoke all refresh tokens for the user (or just current session)
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
            // Create profile if it doesn't exist
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
            // Create preferences if they don't exist
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

    public HubService(IHubRepository hubRepository, ISqlConnectionFactory sqlConnectionFactory)
    {
        _hubRepository = hubRepository;
        _sqlConnectionFactory = sqlConnectionFactory;
    }

    public Task<HubListResponse> GetAccessibleHubsAsync(int userId) => throw new NotImplementedException();
    public Task<HubDetailResponse> GetHubDetailAsync(int hubId, int userId) => throw new NotImplementedException();
    public Task<List<HubDto>> GetAllHubsAsync(bool includeInactive = false) => throw new NotImplementedException();
    public Task<HubDto> CreateHubAsync(HubDto hub, int createdBy) => throw new NotImplementedException();
    public Task<HubDto> UpdateHubAsync(int hubId, HubDto hub, int updatedBy) => throw new NotImplementedException();
    public Task DeleteHubAsync(int hubId, bool hardDelete = false) => throw new NotImplementedException();
    public Task ReorderHubsAsync(List<int> hubIds) => throw new NotImplementedException();
}

public class ReportService : IReportService
{
    private readonly IReportRepository _reportRepository;
    private readonly ISqlConnectionFactory _sqlConnectionFactory;
    private readonly IPowerBIService _powerBIService;
    private readonly ISSRSService _ssrsService;

    public ReportService(
        IReportRepository reportRepository,
        ISqlConnectionFactory sqlConnectionFactory,
        IPowerBIService powerBIService,
        ISSRSService ssrsService)
    {
        _reportRepository = reportRepository;
        _sqlConnectionFactory = sqlConnectionFactory;
        _powerBIService = powerBIService;
        _ssrsService = ssrsService;
    }

    public Task<ReportDto?> GetReportAsync(int reportId, int userId) => throw new NotImplementedException();
    public Task<ReportEmbedResponse> GetReportEmbedAsync(int reportId, int userId) => throw new NotImplementedException();
    public Task LogReportAccessAsync(int reportId, int userId, string accessType, string ipAddress) => throw new NotImplementedException();
    public Task<List<FavoriteDto>> GetFavoritesAsync(int userId) => throw new NotImplementedException();
    public Task AddFavoriteAsync(int userId, int reportId) => throw new NotImplementedException();
    public Task RemoveFavoriteAsync(int userId, int reportId) => throw new NotImplementedException();
    public Task ReorderFavoritesAsync(int userId, List<int> reportIds) => throw new NotImplementedException();
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
    public Task<DepartmentDto?> GetDepartmentAsync(int departmentId) => throw new NotImplementedException();
    public Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request, int createdBy) => throw new NotImplementedException();
    public Task<DepartmentDto> UpdateDepartmentAsync(int departmentId, UpdateDepartmentRequest request, int updatedBy) => throw new NotImplementedException();
    public Task DeleteDepartmentAsync(int departmentId, bool hardDelete = false) => throw new NotImplementedException();
    public Task ReorderDepartmentsAsync(List<int> departmentIds) => throw new NotImplementedException();
    public Task<DepartmentUsersResponse> GetDepartmentUsersAsync(int departmentId) => throw new NotImplementedException();
    public Task<DepartmentReportsResponse> GetDepartmentReportsAsync(int departmentId) => throw new NotImplementedException();
    public async Task AssignUserToDepartmentAsync(int userId, int departmentId, int grantedBy)
    {
        // Check if assignment already exists
        var existing = await _context.UserDepartments
            .FirstOrDefaultAsync(ud => ud.UserId == userId && ud.DepartmentId == departmentId);

        if (existing != null)
        {
            // Already assigned, nothing to do
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

    public Task<bool> CanAccessReportAsync(int userId, int reportId) => throw new NotImplementedException();
    public Task<bool> CanAccessHubAsync(int userId, int hubId) => throw new NotImplementedException();
    public Task<bool> IsAdminAsync(int userId) => _userRepository.IsAdminAsync(userId);

    public async Task<UserPermissionsResponse> GetUserPermissionsAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.UserDepartments)
                .ThenInclude(ud => ud.Department)
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
            GrantedBy = null // Could lookup admin name if needed
        }).ToList() ?? new List<UserDepartmentPermissionDto>();

        return new UserPermissionsResponse
        {
            UserId = userId,
            Email = user.Email,
            IsAdmin = isAdmin,
            Departments = departments,
            Permissions = new PermissionsDto() // Hub/Report permissions not implemented yet
        };
    }

    public Task GrantHubAccessAsync(int userId, int hubId, int grantedBy, DateTime? expiresAt = null) => throw new NotImplementedException();
    public Task GrantReportGroupAccessAsync(int userId, int reportGroupId, int grantedBy, DateTime? expiresAt = null) => throw new NotImplementedException();
    public Task GrantReportAccessAsync(int userId, int reportId, int grantedBy, DateTime? expiresAt = null) => throw new NotImplementedException();
    public Task RevokePermissionAsync(int permissionId, string permissionType) => throw new NotImplementedException();
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
    private readonly ILogger<PowerBIService> _logger;

    public PowerBIService(IConfiguration configuration, ILogger<PowerBIService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task<PowerBIEmbedInfo> GetEmbedInfoAsync(string workspaceId, string reportId) => throw new NotImplementedException();
    public Task<List<PowerBIWorkspace>> GetWorkspacesAsync() => throw new NotImplementedException();
    public Task<List<PowerBIReport>> GetWorkspaceReportsAsync(string workspaceId) => throw new NotImplementedException();
}

public class SSRSService : ISSRSService
{
    private readonly IConfiguration _configuration;

    public SSRSService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GetReportUrl(string reportPath, string reportServer)
    {
        return $"{reportServer}?{reportPath}&rs:Embed=true";
    }

    public Task<List<SSRSParameter>> GetReportParametersAsync(string reportPath, string reportServer)
        => throw new NotImplementedException();
}

public class AuditService : IAuditService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AuditService> _logger;

    public AuditService(ApplicationDbContext context, ILogger<AuditService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public Task LogAsync(int? userId, string? userEmail, string action, string? entityType = null,
        int? entityId = null, object? oldValues = null, object? newValues = null,
        string? ipAddress = null, string? userAgent = null)
    {
        // TODO: Implement audit logging to database
        _logger.LogInformation("Audit: {Action} by User {UserId}", action, userId);
        return Task.CompletedTask;
    }

    public Task LogLoginAsync(int? userId, string? email, string loginMethod, bool success,
        string? failureReason = null, string? ipAddress = null, string? userAgent = null)
    {
        // TODO: Implement login history logging
        _logger.LogInformation("Login: {Email} via {Method} - Success: {Success}", email, loginMethod, success);
        return Task.CompletedTask;
    }
}
