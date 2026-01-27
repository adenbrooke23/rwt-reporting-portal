using System.IO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Infrastructure.Auth;
using RWTReportingPortal.API.Services.Interfaces;

namespace RWTReportingPortal.API.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportProxyController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ISSRSService _ssrsService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<ReportProxyController> _logger;

    public ReportProxyController(
        IReportService reportService,
        ISSRSService ssrsService,
        IJwtTokenService jwtTokenService,
        ILogger<ReportProxyController> logger)
    {
        _reportService = reportService;
        _ssrsService = ssrsService;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
    }

    [HttpGet("{reportId}/render")]
    public async Task<IActionResult> RenderReport(int reportId, [FromQuery] string? access_token = null)
    {
        try
        {

            if (!(User.Identity?.IsAuthenticated ?? false))
            {
                if (string.IsNullOrEmpty(access_token))
                {
                    _logger.LogWarning("Report render request without authentication");
                    return Unauthorized(new { error = "Authentication required" });
                }

                var principal = _jwtTokenService.ValidateToken(access_token);
                if (principal == null)
                {
                    _logger.LogWarning("Report render request with invalid token");
                    return Unauthorized(new { error = "Invalid or expired token" });
                }

                _logger.LogDebug("Report render authenticated via query string token");
            }

            var report = await _reportService.GetReportByIdAsync(reportId);
            if (report == null)
            {
                return NotFound(new { error = "Report not found" });
            }

            if (report.ReportType != "SSRS")
            {
                return BadRequest(new { error = $"Proxy rendering not supported for report type: {report.ReportType}" });
            }

            if (string.IsNullOrEmpty(report.SSRSReportPath))
            {
                return BadRequest(new { error = "Report path not configured" });
            }

            _logger.LogInformation("Proxying SSRS report {ReportId} for user", reportId);

            var sessionKey = report.SSRSReportPath.GetHashCode().ToString();

            SetProxySessionCookie(access_token);
            SetSSRSSessionCookie(sessionKey);

            var proxyBaseUrl = $"{Request.Scheme}://{Request.Host}/api/reports/ssrs-resource";

            var result = await _ssrsService.RenderReportAsync(
                report.SSRSReportPath,
                report.SSRSReportServer,
                null,
                proxyBaseUrl
            );

            if (!result.Success)
            {
                _logger.LogWarning("Failed to render report {ReportId}: {Error}", reportId, result.ErrorMessage);
                return StatusCode(502, new { error = result.ErrorMessage ?? "Failed to render report" });
            }

            return File(result.Content!, result.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying report {ReportId}", reportId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("ssrs/render")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> RenderSSRSReport([FromQuery] string path, [FromQuery] string? server = null)
    {
        if (string.IsNullOrEmpty(path))
        {
            return BadRequest(new { error = "Report path is required" });
        }

        _logger.LogInformation("Admin proxying SSRS report path: {Path}", path);

        var result = await _ssrsService.RenderReportAsync(path, server);

        if (!result.Success)
        {
            return StatusCode(502, new { error = result.ErrorMessage ?? "Failed to render report" });
        }

        return File(result.Content!, result.ContentType);
    }

    [HttpGet("ssrs-resource/{**resourcePath}")]
    [HttpPost("ssrs-resource/{**resourcePath}")]
    public async Task<IActionResult> ProxySSRSResource(string resourcePath, [FromQuery] string? access_token = null)
    {
        try
        {

            if (!(User.Identity?.IsAuthenticated ?? false))
            {

                var cookieToken = Request.Cookies["ssrs_proxy_session"];
                var tokenToValidate = !string.IsNullOrEmpty(cookieToken) ? cookieToken : access_token;

                if (string.IsNullOrEmpty(tokenToValidate))
                {
                    _logger.LogWarning("SSRS resource request without authentication: {Path}", resourcePath);
                    return Unauthorized(new { error = "Authentication required" });
                }

                var principal = _jwtTokenService.ValidateToken(tokenToValidate);
                if (principal == null)
                {
                    _logger.LogWarning("SSRS resource request with invalid token: {Path}", resourcePath);
                    return Unauthorized(new { error = "Invalid or expired token" });
                }
            }

            if (!resourcePath.StartsWith("/"))
            {
                resourcePath = "/" + resourcePath;
            }

            var queryParams = Request.Query
                .Where(q => q.Key != "access_token")
                .Select(q => $"{Uri.EscapeDataString(q.Key)}={Uri.EscapeDataString(q.Value.ToString())}");
            var queryString = string.Join("&", queryParams);

            _logger.LogDebug("Proxying SSRS resource: {Method} {Path}", Request.Method, resourcePath);

            byte[]? requestBody = null;
            string? contentType = null;
            if (Request.Method == "POST" && Request.ContentLength > 0)
            {
                using var memoryStream = new MemoryStream();
                await Request.Body.CopyToAsync(memoryStream);
                requestBody = memoryStream.ToArray();
                contentType = Request.ContentType;
            }

            var sessionKey = Request.Cookies["ssrs_session_key"];

            var result = await _ssrsService.ProxyResourceAsync(resourcePath, queryString, Request.Method, requestBody, contentType, sessionKey);

            if (!result.Success)
            {
                _logger.LogWarning("Failed to proxy SSRS resource {Path}: {Error}", resourcePath, result.ErrorMessage);
                return StatusCode(502, new { error = result.ErrorMessage ?? "Failed to fetch resource" });
            }

            if (resourcePath.EndsWith(".js") || resourcePath.EndsWith(".css") ||
                resourcePath.EndsWith(".png") || resourcePath.EndsWith(".gif") ||
                resourcePath.EndsWith(".jpg") || resourcePath.EndsWith(".ico"))
            {
                Response.Headers.CacheControl = "public, max-age=3600";
            }

            return File(result.Content!, result.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying SSRS resource {Path}", resourcePath);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    private void SetProxySessionCookie(string? accessToken)
    {
        if (string.IsNullOrEmpty(accessToken))
        {
            return;
        }

        Response.Cookies.Append("ssrs_proxy_session", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            MaxAge = TimeSpan.FromHours(1),
            Path = "/api/reports/ssrs-resource"
        });
    }

    private void SetSSRSSessionCookie(string sessionKey)
    {
        Response.Cookies.Append("ssrs_session_key", sessionKey, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            MaxAge = TimeSpan.FromHours(1),
            Path = "/api/reports/ssrs-resource"
        });
    }
}
