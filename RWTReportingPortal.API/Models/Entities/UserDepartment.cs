namespace RWTReportingPortal.API.Models.Entities;

public class UserDepartment
{
    public int UserDepartmentId { get; set; }
    public int UserId { get; set; }
    public int DepartmentId { get; set; }
    public int? GrantedBy { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Department Department { get; set; } = null!;
}
