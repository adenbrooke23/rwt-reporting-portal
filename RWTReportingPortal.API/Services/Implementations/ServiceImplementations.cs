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
    private readonly ApplicationDbContext _context;

    public HubService(IHubRepository hubRepository, ISqlConnectionFactory sqlConnectionFactory, ApplicationDbContext context)
    {
        _hubRepository = hubRepository;
        _sqlConnectionFactory = sqlConnectionFactory;
        _context = context;
    }

    public async Task<HubListResponse> GetAccessibleHubsAsync(int userId)
    {
        // Get user with roles to check if admin
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

        // Check if user is admin (case-insensitive)
        var isAdmin = user.UserRoles?.Any(ur =>
            ur.Role.RoleName.Equals("Admin", StringComparison.OrdinalIgnoreCase)) ?? false;

        List<ReportingHub> accessibleHubs;

        if (isAdmin)
        {
            // Admins get all active hubs
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
            // Collect hub IDs the user has access to
            var accessibleHubIds = new HashSet<int>();

            // 1. Direct hub access (ad-hoc)
            var directHubIds = user.HubAccess?
                .Where(ha => ha.ExpiresAt == null || ha.ExpiresAt > DateTime.UtcNow)
                .Select(ha => ha.HubId) ?? Enumerable.Empty<int>();
            foreach (var hubId in directHubIds)
            {
                accessibleHubIds.Add(hubId);
            }

            // 2. Direct report access (ad-hoc) - get the hub for each report
            var reportHubIds = user.ReportAccess?
                .Where(ra => ra.ExpiresAt == null || ra.ExpiresAt > DateTime.UtcNow)
                .Where(ra => ra.Report?.ReportGroup != null)
                .Select(ra => ra.Report.ReportGroup.HubId) ?? Enumerable.Empty<int>();
            foreach (var hubId in reportHubIds)
            {
                accessibleHubIds.Add(hubId);
            }

            // 3. Department-based access - get hubs containing reports tagged with user's departments
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

            // Fetch the actual hubs
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

    public Task<HubDetailResponse> GetHubDetailAsync(int hubId, int userId) => throw new NotImplementedException();

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
            BackgroundImage = h.BackgroundImage,
            SortOrder = h.SortOrder,
            IsActive = h.IsActive,
            ReportGroupCount = h.ReportGroups?.Count(rg => rg.IsActive) ?? 0,
            ReportCount = h.ReportGroups?.Sum(rg => rg.Reports?.Count(r => r.IsActive) ?? 0) ?? 0,
            CreatedAt = h.CreatedAt,
            CreatedByEmail = null // Navigation property not loaded yet
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
                DisplayName = ud.User?.DisplayName,
                GrantedAt = ud.GrantedAt,
                GrantedBy = null // Would need to join to get granter's email
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
                HubName = "", // Would need deeper join
                GroupName = "", // Would need deeper join
                GrantedAt = rd.GrantedAt,
                GrantedBy = null
            }).ToList()
        };
    }
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
            GrantedBy = null // Could lookup admin name if needed
        }).ToList() ?? new List<UserDepartmentPermissionDto>();

        // Get hub permissions (ad-hoc access)
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

        // Get report permissions (ad-hoc access)
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
                ReportGroups = new List<ReportGroupPermissionDto>(), // Not used for now
                Reports = reportPermissions
            }
        };
    }

    public async Task GrantHubAccessAsync(int userId, int hubId, int grantedBy, DateTime? expiresAt = null)
    {
        // Check if access already exists
        var existingAccess = await _context.UserHubAccess
            .FirstOrDefaultAsync(uha => uha.UserId == userId && uha.HubId == hubId);

        if (existingAccess != null)
        {
            // Update expiration if needed
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
        // Check if access already exists
        var existingAccess = await _context.UserReportAccess
            .FirstOrDefaultAsync(ura => ura.UserId == userId && ura.ReportId == reportId);

        if (existingAccess != null)
        {
            // Update expiration if needed
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
        // Get the Admin role
        var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "Admin");
        if (adminRole == null)
        {
            throw new InvalidOperationException("Admin role not found in database");
        }

        // Check if user already has admin role
        var existingUserRole = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == adminRole.RoleId);

        if (isAdmin)
        {
            // Grant admin role
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
            // If already has role, nothing to do
        }
        else
        {
            // Revoke admin role
            if (existingUserRole != null)
            {
                _context.UserRoles.Remove(existingUserRole);
                await _context.SaveChangesAsync();
            }
            // If doesn't have role, nothing to do
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
