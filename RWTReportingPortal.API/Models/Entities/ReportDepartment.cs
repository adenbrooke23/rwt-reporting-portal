namespace RWTReportingPortal.API.Models.Entities;

public class ReportDepartment
{
    public int ReportDepartmentId { get; set; }
    public int ReportId { get; set; }
    public int DepartmentId { get; set; }
    public int? GrantedBy { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Report Report { get; set; } = null!;
    public Department Department { get; set; } = null!;
    public User? GrantedByUser { get; set; }
}
