namespace RWTReportingPortal.API.Models.DTOs.Departments;

public class DepartmentDto
{
    public int DepartmentId { get; set; }
    public string DepartmentCode { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public int UserCount { get; set; }
    public int ReportCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByEmail { get; set; }
}

public class DepartmentListResponse
{
    public List<DepartmentDto> Departments { get; set; } = new();
}

public class CreateDepartmentRequest
{
    public string DepartmentCode { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateDepartmentRequest
{
    public string? DepartmentName { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
}

public class ReorderDepartmentsRequest
{
    public List<int> DepartmentIds { get; set; } = new();
}

public class DepartmentUsersResponse
{
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public List<DepartmentUserDto> Users { get; set; } = new();
}

public class DepartmentUserDto
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public DateTime GrantedAt { get; set; }
    public string? GrantedBy { get; set; }
}

public class DepartmentReportsResponse
{
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public List<DepartmentReportDto> Reports { get; set; } = new();
}

public class DepartmentReportDto
{
    public int ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string HubName { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public DateTime GrantedAt { get; set; }
    public string? GrantedBy { get; set; }
}
