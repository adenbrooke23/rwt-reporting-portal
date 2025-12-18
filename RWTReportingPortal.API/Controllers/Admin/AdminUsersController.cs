using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Admin;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = "AdminOnly")]
public class AdminUsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IPermissionService _permissionService;
    private readonly IDepartmentService _departmentService;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(
        IUserService userService,
        IPermissionService permissionService,
        IDepartmentService departmentService,
        ILogger<AdminUsersController> logger)
    {
        _userService = userService;
        _permissionService = permissionService;
        _departmentService = departmentService;
        _logger = logger;
    }

    /// <summary>
    /// Get all users (paginated)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AdminUserListResponse>> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] bool includeInactive = true,
        [FromQuery] bool includeExpired = false)
    {
        // TODO: Implement with UserService
        return Ok(new AdminUserListResponse());
    }

    /// <summary>
    /// Get user details
    /// </summary>
    [HttpGet("{userId}")]
    public async Task<ActionResult<AdminUserDto>> GetUser(int userId)
    {
        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
        {
            return NotFound();
        }
        // TODO: Map to AdminUserDto
        return Ok(new AdminUserDto());
    }

    /// <summary>
    /// Get user permissions
    /// </summary>
    [HttpGet("{userId}/permissions")]
    public async Task<ActionResult<UserPermissionsResponse>> GetUserPermissions(int userId)
    {
        var result = await _permissionService.GetUserPermissionsAsync(userId);
        return Ok(result);
    }

    /// <summary>
    /// Unlock user account
    /// </summary>
    [HttpPut("{userId}/unlock")]
    public async Task<IActionResult> UnlockUser(int userId)
    {
        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        user.IsLockedOut = false;
        user.LockoutEnd = null;
        user.FailedLoginAttempts = 0;
        await _userService.UpdateAsync(user);

        return Ok(new { success = true, message = "User account unlocked" });
    }

    /// <summary>
    /// Expire user account
    /// </summary>
    [HttpPut("{userId}/expire")]
    public async Task<IActionResult> ExpireUser(int userId, [FromBody] ExpireUserRequest request)
    {
        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        var adminUserId = GetUserId();
        user.IsExpired = true;
        user.ExpiredAt = DateTime.UtcNow;
        user.ExpirationReason = request.Reason;
        user.ExpiredBy = adminUserId;
        await _userService.UpdateAsync(user);

        return Ok(new { success = true, userId, isExpired = true, expiredAt = user.ExpiredAt, message = "User account has been expired" });
    }

    /// <summary>
    /// Restore expired user account
    /// </summary>
    [HttpPut("{userId}/restore")]
    public async Task<IActionResult> RestoreUser(int userId)
    {
        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        user.IsExpired = false;
        user.ExpiredAt = null;
        user.ExpirationReason = null;
        user.ExpiredBy = null;
        user.IsActive = true;
        await _userService.UpdateAsync(user);

        return Ok(new { success = true, userId, isExpired = false, isActive = true, message = "User account has been restored" });
    }

    /// <summary>
    /// Get user's department memberships
    /// </summary>
    [HttpGet("{userId}/departments")]
    public async Task<IActionResult> GetUserDepartments(int userId)
    {
        var result = await _permissionService.GetUserPermissionsAsync(userId);
        return Ok(new { userId, email = result.Email, departments = result.Departments });
    }

    /// <summary>
    /// Assign user to department
    /// </summary>
    [HttpPost("{userId}/departments")]
    public async Task<IActionResult> AssignUserToDepartment(int userId, [FromBody] GrantDepartmentRequest request)
    {
        var grantedBy = GetUserId();
        await _departmentService.AssignUserToDepartmentAsync(userId, request.DepartmentId, grantedBy);
        return Ok(new { success = true, message = "User assigned to department successfully" });
    }

    /// <summary>
    /// Remove user from department
    /// </summary>
    [HttpDelete("{userId}/departments/{departmentId}")]
    public async Task<IActionResult> RemoveUserFromDepartment(int userId, int departmentId)
    {
        await _departmentService.RemoveUserFromDepartmentAsync(userId, departmentId);
        return Ok(new { success = true, message = "User removed from department successfully" });
    }

    /// <summary>
    /// Grant hub access to user
    /// </summary>
    [HttpPost("{userId}/permissions/hub")]
    public async Task<IActionResult> GrantHubAccess(int userId, [FromBody] GrantHubAccessRequest request)
    {
        var grantedBy = GetUserId();
        await _permissionService.GrantHubAccessAsync(userId, request.HubId, grantedBy, request.ExpiresAt);
        return Ok(new { success = true, message = "Hub access granted successfully" });
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        throw new UnauthorizedAccessException("Invalid user token");
    }
}
