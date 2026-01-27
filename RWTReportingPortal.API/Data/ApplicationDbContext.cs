using Microsoft.EntityFrameworkCore;
using RWTReportingPortal.API.Models.Entities;

namespace RWTReportingPortal.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Company> Companies => Set<Company>();

    public DbSet<User> Users => Set<User>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<UserPreferences> UserPreferences => Set<UserPreferences>();

    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<LoginHistory> LoginHistory => Set<LoginHistory>();

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<UserDepartment> UserDepartments => Set<UserDepartment>();
    public DbSet<ReportDepartment> ReportDepartments => Set<ReportDepartment>();

    public DbSet<ReportingHub> ReportingHubs => Set<ReportingHub>();
    public DbSet<ReportGroup> ReportGroups => Set<ReportGroup>();
    public DbSet<Report> Reports => Set<Report>();

    public DbSet<UserHubAccess> UserHubAccess => Set<UserHubAccess>();
    public DbSet<UserReportGroupAccess> UserReportGroupAccess => Set<UserReportGroupAccess>();
    public DbSet<UserReportAccess> UserReportAccess => Set<UserReportAccess>();

    public DbSet<UserFavorite> UserFavorites => Set<UserFavorite>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ReportAccessLog> ReportAccessLogs => Set<ReportAccessLog>();

    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    public DbSet<Announcement> Announcements => Set<Announcement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("portal");

        modelBuilder.Entity<Company>().ToTable("Company", "portal");
        modelBuilder.Entity<User>().ToTable("User", "portal");
        modelBuilder.Entity<UserProfile>().ToTable("UserProfile", "portal");
        modelBuilder.Entity<UserPreferences>().ToTable("UserPreference", "portal");
        modelBuilder.Entity<UserSession>().ToTable("UserSession", "portal");
        modelBuilder.Entity<RefreshToken>().ToTable("RefreshToken", "portal");
        modelBuilder.Entity<LoginHistory>().ToTable("LoginHistory", "portal");
        modelBuilder.Entity<Role>().ToTable("Role", "portal");
        modelBuilder.Entity<UserRole>().ToTable("UserRole", "portal");
        modelBuilder.Entity<Department>().ToTable("Department", "portal");
        modelBuilder.Entity<UserDepartment>().ToTable("UserDepartment", "portal");
        modelBuilder.Entity<ReportDepartment>().ToTable("ReportDepartment", "portal");
        modelBuilder.Entity<ReportingHub>().ToTable("ReportingHub", "portal");
        modelBuilder.Entity<ReportGroup>().ToTable("ReportGroup", "portal");
        modelBuilder.Entity<Report>().ToTable("Report", "portal");
        modelBuilder.Entity<UserHubAccess>().ToTable("UserHubAccess", "portal");
        modelBuilder.Entity<UserReportGroupAccess>().ToTable("UserReportGroupAccess", "portal");
        modelBuilder.Entity<UserReportAccess>().ToTable("UserReportAccess", "portal");
        modelBuilder.Entity<UserFavorite>().ToTable("UserFavorite", "portal");
        modelBuilder.Entity<AuditLog>().ToTable("AuditLog", "portal");
        modelBuilder.Entity<ReportAccessLog>().ToTable("ReportAccessLog", "portal");
        modelBuilder.Entity<AppSetting>().ToTable("AppSetting", "portal");
        modelBuilder.Entity<Announcement>().ToTable("Announcement", "portal");

        modelBuilder.Entity<Company>().HasKey(e => e.CompanyId);
        modelBuilder.Entity<User>().HasKey(e => e.UserId);
        modelBuilder.Entity<UserProfile>().HasKey(e => e.UserProfileId);
        modelBuilder.Entity<UserPreferences>().HasKey(e => e.UserPreferenceId);
        modelBuilder.Entity<UserSession>().HasKey(e => e.SessionId);
        modelBuilder.Entity<RefreshToken>().HasKey(e => e.RefreshTokenId);
        modelBuilder.Entity<LoginHistory>().HasKey(e => e.LoginHistoryId);
        modelBuilder.Entity<Role>().HasKey(e => e.RoleId);
        modelBuilder.Entity<UserRole>().HasKey(e => e.UserRoleId);
        modelBuilder.Entity<Department>().HasKey(e => e.DepartmentId);
        modelBuilder.Entity<UserDepartment>().HasKey(e => e.UserDepartmentId);
        modelBuilder.Entity<ReportDepartment>().HasKey(e => e.ReportDepartmentId);
        modelBuilder.Entity<ReportingHub>().HasKey(e => e.HubId);
        modelBuilder.Entity<ReportGroup>().HasKey(e => e.ReportGroupId);
        modelBuilder.Entity<Report>().HasKey(e => e.ReportId);
        modelBuilder.Entity<UserHubAccess>().HasKey(e => e.UserHubAccessId);
        modelBuilder.Entity<UserReportGroupAccess>().HasKey(e => e.UserReportGroupAccessId);
        modelBuilder.Entity<UserReportAccess>().HasKey(e => e.UserReportAccessId);
        modelBuilder.Entity<UserFavorite>().HasKey(e => e.UserFavoriteId);
        modelBuilder.Entity<AuditLog>().HasKey(e => e.AuditLogId);
        modelBuilder.Entity<ReportAccessLog>().HasKey(e => e.ReportAccessLogId);
        modelBuilder.Entity<AppSetting>().HasKey(e => e.SettingId);
        modelBuilder.Entity<Announcement>().HasKey(e => e.AnnouncementId);

        modelBuilder.Entity<User>()
            .HasOne(u => u.Company)
            .WithMany(c => c.Users)
            .HasForeignKey(u => u.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<User>()
            .HasOne(u => u.Profile)
            .WithOne(p => p.User)
            .HasForeignKey<UserProfile>(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasOne(u => u.Preferences)
            .WithOne(p => p.User)
            .HasForeignKey<UserPreferences>(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserRole>()
            .HasOne(ur => ur.User)
            .WithMany(u => u.UserRoles)
            .HasForeignKey(ur => ur.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserRole>()
            .HasOne(ur => ur.Role)
            .WithMany(r => r.UserRoles)
            .HasForeignKey(ur => ur.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserDepartment>()
            .HasOne(ud => ud.User)
            .WithMany(u => u.UserDepartments)
            .HasForeignKey(ud => ud.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserDepartment>()
            .HasOne(ud => ud.Department)
            .WithMany(d => d.UserDepartments)
            .HasForeignKey(ud => ud.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserDepartment>()
            .HasIndex(ud => new { ud.UserId, ud.DepartmentId })
            .IsUnique();

        modelBuilder.Entity<ReportDepartment>()
            .HasOne(rd => rd.Report)
            .WithMany(r => r.ReportDepartments)
            .HasForeignKey(rd => rd.ReportId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ReportDepartment>()
            .HasOne(rd => rd.Department)
            .WithMany(d => d.ReportDepartments)
            .HasForeignKey(rd => rd.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ReportDepartment>()
            .HasIndex(rd => new { rd.ReportId, rd.DepartmentId })
            .IsUnique();

        modelBuilder.Entity<ReportGroup>()
            .HasOne(g => g.Hub)
            .WithMany(h => h.ReportGroups)
            .HasForeignKey(g => g.HubId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Report>()
            .HasOne(r => r.ReportGroup)
            .WithMany(g => g.Reports)
            .HasForeignKey(r => r.ReportGroupId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserFavorite>()
            .HasOne(f => f.User)
            .WithMany(u => u.Favorites)
            .HasForeignKey(f => f.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserFavorite>()
            .HasOne(f => f.Report)
            .WithMany(r => r.UserFavorites)
            .HasForeignKey(f => f.ReportId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserFavorite>()
            .HasIndex(f => new { f.UserId, f.ReportId })
            .IsUnique();

        modelBuilder.Entity<UserSession>()
            .HasOne(s => s.User)
            .WithMany(u => u.Sessions)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserHubAccess>()
            .HasOne(a => a.User)
            .WithMany(u => u.HubAccess)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserHubAccess>()
            .HasOne(a => a.Hub)
            .WithMany(h => h.UserHubAccess)
            .HasForeignKey(a => a.HubId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserReportAccess>()
            .HasOne(a => a.User)
            .WithMany(u => u.ReportAccess)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserReportAccess>()
            .HasOne(a => a.Report)
            .WithMany()
            .HasForeignKey(a => a.ReportId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserReportGroupAccess>()
            .HasOne(a => a.User)
            .WithMany(u => u.ReportGroupAccess)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserReportGroupAccess>()
            .HasOne(a => a.ReportGroup)
            .WithMany()
            .HasForeignKey(a => a.ReportGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.EntraObjectId)
            .IsUnique();

        modelBuilder.Entity<Company>()
            .HasIndex(c => c.CompanyCode)
            .IsUnique();

        modelBuilder.Entity<Role>()
            .HasIndex(r => r.RoleName)
            .IsUnique();

        modelBuilder.Entity<Department>()
            .HasIndex(d => d.DepartmentCode)
            .IsUnique();

        modelBuilder.Entity<ReportingHub>()
            .HasIndex(h => h.HubCode)
            .IsUnique();

        modelBuilder.Entity<Report>()
            .HasIndex(r => r.ReportCode)
            .IsUnique();

        modelBuilder.Entity<AppSetting>()
            .HasIndex(s => s.SettingKey)
            .IsUnique();
    }
}
