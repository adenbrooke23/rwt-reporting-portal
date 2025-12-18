using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Models.DTOs.Departments;
using RWTReportingPortal.API.Services.Interfaces;
using System.Security.Claims;

namespace RWTReportingPortal.API.Controllers.Admin;

[ApiController]
[Route("api/admin/departments")]
[Authorize(Policy = "AdminOnly")]
public class AdminDepartmentsController : ControllerBase
{
    private readonly IDepartmentService _departmentService;
    private readonly ILogger<AdminDepartmentsController> _logger;

    public AdminDepartmentsController(IDepartmentService departmentService, ILogger<AdminDepartmentsController> logger)
    {
        _departmentService = departmentService;
        _logger = logger;
    }

    /// <summary>
    /// Get all departments
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<DepartmentListResponse>> GetDepartments([FromQuery] bool includeInactive = false)
    {
        var result = await _departmentService.GetAllDepartmentsAsync(includeInactive);
        return Ok(result);
    }

    /// <summary>
    /// Create a new department
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<DepartmentDto>> CreateDepartment([FromBody] CreateDepartmentRequest request)
    {
        var createdBy = GetUserId();
        var result = await _departmentService.CreateDepartmentAsync(request, createdBy);
        return CreatedAtAction(nameof(GetDepartment), new { departmentId = result.DepartmentId }, result);
    }

    /// <summary>
    /// Get department by ID
    /// </summary>
    [HttpGet("{departmentId}")]
    public async Task<ActionResult<DepartmentDto>> GetDepartment(int departmentId)
    {
        var result = await _departmentService.GetDepartmentAsync(departmentId);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    /// <summary>
    /// Update a department
    /// </summary>
    [HttpPut("{departmentId}")]
    public async Task<ActionResult<DepartmentDto>> UpdateDepartment(int departmentId, [FromBody] UpdateDepartmentRequest request)
    {
        var updatedBy = GetUserId();
        var result = await _departmentService.UpdateDepartmentAsync(departmentId, request, updatedBy);
        return Ok(result);
    }

    /// <summary>
    /// Delete a department
    /// </summary>
    [HttpDelete("{departmentId}")]
    public async Task<IActionResult> DeleteDepartment(int departmentId, [FromQuery] bool hardDelete = false)
    {
        await _departmentService.DeleteDepartmentAsync(departmentId, hardDelete);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Reorder departments
    /// </summary>
    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderDepartments([FromBody] ReorderDepartmentsRequest request)
    {
        await _departmentService.ReorderDepartmentsAsync(request.DepartmentIds);
        var result = await _departmentService.GetAllDepartmentsAsync();
        return Ok(result);
    }

    /// <summary>
    /// Get users in a department
    /// </summary>
    [HttpGet("{departmentId}/users")]
    public async Task<ActionResult<DepartmentUsersResponse>> GetDepartmentUsers(int departmentId)
    {
        var result = await _departmentService.GetDepartmentUsersAsync(departmentId);
        return Ok(result);
    }

    /// <summary>
    /// Get reports with department access
    /// </summary>
    [HttpGet("{departmentId}/reports")]
    public async Task<ActionResult<DepartmentReportsResponse>> GetDepartmentReports(int departmentId)
    {
        var result = await _departmentService.GetDepartmentReportsAsync(departmentId);
        return Ok(result);
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
