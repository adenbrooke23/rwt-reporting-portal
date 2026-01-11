using Microsoft.EntityFrameworkCore;
using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Data.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(int userId);
    Task<User?> GetByIdIncludeExpiredAsync(int userId);
    Task<User?> GetByIdWithDetailsAsync(int userId);
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByEntraObjectIdAsync(string entraObjectId);
    Task<List<User>> GetAllAsync(int page = 1, int pageSize = 50, string? search = null, bool includeInactive = true, bool includeExpired = false);
    Task<int> GetTotalCountAsync(string? search = null, bool includeInactive = true, bool includeExpired = false);
    Task<User> CreateAsync(User user);
    Task UpdateAsync(User user);
    Task UpdateLastActivityAsync(int userId);
    Task UpdateLastLoginAsync(int userId);
    Task IncrementFailedLoginAttemptsAsync(int userId);
    Task ResetFailedLoginAttemptsAsync(int userId);
    Task<bool> IsAdminAsync(int userId);
    Task<List<string>> GetUserRolesAsync(int userId);
}

public class UserRepository : IUserRepository
{
    private readonly ApplicationDbContext _context;

    public UserRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<User?> GetByIdAsync(int userId)
    {
        return await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId && !u.IsExpired);
    }

    public async Task<User?> GetByIdIncludeExpiredAsync(int userId)
    {
        return await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);
    }

    public async Task<User?> GetByIdWithDetailsAsync(int userId)
    {
        return await _context.Users
            .Include(u => u.Company)
            .Include(u => u.Profile)
            .Include(u => u.Preferences)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserDepartments)
                .ThenInclude(ud => ud.Department)
            .FirstOrDefaultAsync(u => u.UserId == userId && !u.IsExpired);
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        return await _context.Users
            .Include(u => u.Company)
            .Include(u => u.Profile)
            .Include(u => u.Preferences)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Email == email && !u.IsExpired);
    }

    public async Task<User?> GetByEntraObjectIdAsync(string entraObjectId)
    {
        return await _context.Users
            .Include(u => u.Company)
            .Include(u => u.Profile)
            .Include(u => u.Preferences)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.EntraObjectId == entraObjectId && !u.IsExpired);
    }

    public async Task<List<User>> GetAllAsync(int page = 1, int pageSize = 50, string? search = null, bool includeInactive = true, bool includeExpired = false)
    {
        var query = _context.Users
            .Include(u => u.Company)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserDepartments)
            .AsQueryable();

        if (!includeExpired)
        {
            query = query.Where(u => !u.IsExpired);
        }

        if (!includeInactive)
        {
            query = query.Where(u => u.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.ToLower();
            query = query.Where(u =>
                u.Email.ToLower().Contains(search) ||
                (u.FirstName != null && u.FirstName.ToLower().Contains(search)) ||
                (u.LastName != null && u.LastName.ToLower().Contains(search)));
        }

        return await query
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> GetTotalCountAsync(string? search = null, bool includeInactive = true, bool includeExpired = false)
    {
        var query = _context.Users.AsQueryable();

        if (!includeExpired)
        {
            query = query.Where(u => !u.IsExpired);
        }

        if (!includeInactive)
        {
            query = query.Where(u => u.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.ToLower();
            query = query.Where(u =>
                u.Email.ToLower().Contains(search) ||
                (u.FirstName != null && u.FirstName.ToLower().Contains(search)) ||
                (u.LastName != null && u.LastName.ToLower().Contains(search)));
        }

        return await query.CountAsync();
    }

    public async Task<User> CreateAsync(User user)
    {
        user.CreatedAt = DateTime.UtcNow;
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return user;
    }

    public async Task UpdateAsync(User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        _context.Users.Update(user);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateLastActivityAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user != null)
        {
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task UpdateLastLoginAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user != null)
        {
            user.LastLoginAt = DateTime.UtcNow;
            user.LoginCount++;
            user.FailedLoginAttempts = 0;
            await _context.SaveChangesAsync();
        }
    }

    public async Task IncrementFailedLoginAttemptsAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user != null)
        {
            user.FailedLoginAttempts++;
            await _context.SaveChangesAsync();
        }
    }

    public async Task ResetFailedLoginAttemptsAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user != null)
        {
            user.FailedLoginAttempts = 0;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<bool> IsAdminAsync(int userId)
    {
        return await _context.UserRoles
            .Include(ur => ur.Role)
            .AnyAsync(ur => ur.UserId == userId && ur.Role.RoleName == "Admin");
    }

    public async Task<List<string>> GetUserRolesAsync(int userId)
    {
        return await _context.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == userId)
            .Select(ur => ur.Role.RoleName)
            .ToListAsync();
    }
}
