using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using RWTReportingPortal.API.Data;
using RWTReportingPortal.API.Data.Repositories;
using RWTReportingPortal.API.Services.Implementations;
using RWTReportingPortal.API.Services.Interfaces;
using RWTReportingPortal.API.Infrastructure.Auth;
using System.Net;
using System.Text;

namespace RWTReportingPortal.API.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IHubRepository, HubRepository>();
        services.AddScoped<IReportRepository, ReportRepository>();
        services.AddScoped<IDepartmentRepository, DepartmentRepository>();
        services.AddScoped<IAnnouncementRepository, AnnouncementRepository>();

        // Services
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IHubService, HubService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IDepartmentService, DepartmentService>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IAnnouncementService, AnnouncementService>();
        services.AddScoped<IUserStatsService, UserStatsService>();
        services.AddScoped<IPowerBIService, PowerBIService>();
        services.AddScoped<ISSRSService, SSRSService>();
        services.AddScoped<IAuditService, AuditService>();

        // Infrastructure
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IEntraAuthService, EntraAuthService>();

        // Memory cache for SSRS folder caching
        services.AddMemoryCache();

        // HttpClient for Microsoft Graph API calls
        services.AddHttpClient("MicrosoftGraph", client =>
        {
            client.BaseAddress = new Uri("https://graph.microsoft.com/v1.0/");
        });

        // HttpClient for SSRS with Windows authentication
        services.AddHttpClient("SSRSClient", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            UseDefaultCredentials = true,  // Uses App Pool identity for Windows auth
            PreAuthenticate = true,
            Credentials = CredentialCache.DefaultNetworkCredentials
        });

        // SQL connection factory for stored procedures (ADO.NET)
        services.AddScoped<ISqlConnectionFactory, SqlConnectionFactory>();

        return services;
    }

    public static IServiceCollection AddAuthenticationServices(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSettings = configuration.GetSection("Jwt");
        var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings["Issuer"],
                ValidAudience = jwtSettings["Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                ClockSkew = TimeSpan.Zero
            };

            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    if (context.Exception.GetType() == typeof(SecurityTokenExpiredException))
                    {
                        context.Response.Headers.Append("Token-Expired", "true");
                    }
                    return Task.CompletedTask;
                }
            };
        });

        services.AddAuthorization(options =>
        {
            options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
            options.AddPolicy("UserOrAdmin", policy => policy.RequireRole("User", "Admin"));
        });

        return services;
    }
}
