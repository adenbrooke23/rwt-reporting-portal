using System.IO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RWTReportingPortal.API.Infrastructure.Auth;
using RWTReportingPortal.API.Services.Interfaces;

namespace RWTReportingPortal.API.Controllers;

/// <summary>
/// Proxies report requests to SSRS/Power BI servers using server-side authentication.
/// This allows users to view reports without needing direct access to the report servers.
/// </summary>
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

    /// <summary>
    /// Render an SSRS report by report ID.
    /// The report content is fetched server-side using Windows authentication and streamed to the client.
    /// Accepts JWT token via query string for iframe requests (which can't set Authorization header).
    /// </summary>
    [HttpGet("{reportId}/render")]
    public async Task<IActionResult> RenderReport(int reportId, [FromQuery] string? access_token = null)
    {
        try
        {
            // Validate authentication - check header first, then query string token
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

            // Get report details from database
            var report = await _reportService.GetReportByIdAsync(reportId);
            if (report == null)
            {
                return NotFound(new { error = "Report not found" });
            }

            // Currently only SSRS reports support proxy rendering
            if (report.ReportType != "SSRS")
            {
                return BadRequest(new { error = $"Proxy rendering not supported for report type: {report.ReportType}" });
            }

            if (string.IsNullOrEmpty(report.SSRSReportPath))
            {
                return BadRequest(new { error = "Report path not configured" });
            }

            _logger.LogInformation("Proxying SSRS report {ReportId} for user", reportId);

            // Set a session cookie for subsequent resource requests
            // This allows the browser to automatically authenticate resource requests
            // without needing the token in every URL
            SetProxySessionCookie(access_token);

            // Build proxy base URL for URL rewriting (just the path, no token needed)
            var proxyBaseUrl = $"{Request.Scheme}://{Request.Host}/api/reports/ssrs-resource";

            // Render the report via SSRS service with URL rewriting
            var result = await _ssrsService.RenderReportAsync(
                report.SSRSReportPath,
                report.SSRSReportServer,
                null,  // parameters
                proxyBaseUrl
            );

            if (!result.Success)
            {
                _logger.LogWarning("Failed to render report {ReportId}: {Error}", reportId, result.ErrorMessage);
                return StatusCode(502, new { error = result.ErrorMessage ?? "Failed to render report" });
            }

            // Return the report content
            return File(result.Content!, result.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying report {ReportId}", reportId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Render an SSRS report directly by path (for admin/testing purposes).
    /// </summary>
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

    /// <summary>
    /// Proxy SSRS resources (JavaScript, CSS, images, AJAX requests) for the report viewer.
    /// This catch-all endpoint handles all resources that the SSRS ReportViewer HTML references.
    /// Supports both GET and POST (for SSRS postbacks, session keepalive, etc.)
    /// Authentication is handled via session cookie set during report render, or via query string token.
    /// </summary>
    [HttpGet("ssrs-resource/{**resourcePath}")]
    [HttpPost("ssrs-resource/{**resourcePath}")]
    public async Task<IActionResult> ProxySSRSResource(string resourcePath, [FromQuery] string? access_token = null)
    {
        try
        {
            // Validate authentication - check header, cookie, or query string
            if (!(User.Identity?.IsAuthenticated ?? false))
            {
                // Check for session cookie first (set during report render)
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

            // Ensure resourcePath starts with /
            if (!resourcePath.StartsWith("/"))
            {
                resourcePath = "/" + resourcePath;
            }

            // Get query string (excluding access_token for the upstream request)
            var queryParams = Request.Query
                .Where(q => q.Key != "access_token")
                .Select(q => $"{Uri.EscapeDataString(q.Key)}={Uri.EscapeDataString(q.Value.ToString())}");
            var queryString = string.Join("&", queryParams);

            _logger.LogDebug("Proxying SSRS resource: {Method} {Path}", Request.Method, resourcePath);

            // Read request body for POST requests
            byte[]? requestBody = null;
            string? contentType = null;
            if (Request.Method == "POST" && Request.ContentLength > 0)
            {
                using var memoryStream = new MemoryStream();
                await Request.Body.CopyToAsync(memoryStream);
                requestBody = memoryStream.ToArray();
                contentType = Request.ContentType;
            }

            var result = await _ssrsService.ProxyResourceAsync(resourcePath, queryString, Request.Method, requestBody, contentType);

            if (!result.Success)
            {
                _logger.LogWarning("Failed to proxy SSRS resource {Path}: {Error}", resourcePath, result.ErrorMessage);
                return StatusCode(502, new { error = result.ErrorMessage ?? "Failed to fetch resource" });
            }

            // Set appropriate cache headers for static resources
            if (resourcePath.EndsWith(".js") || resourcePath.EndsWith(".css") ||
                resourcePath.EndsWith(".png") || resourcePath.EndsWith(".gif") ||
                resourcePath.EndsWith(".jpg") || resourcePath.EndsWith(".ico"))
            {
                Response.Headers.CacheControl = "public, max-age=3600";  // Cache for 1 hour
            }

            return File(result.Content!, result.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying SSRS resource {Path}", resourcePath);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Set a session cookie for SSRS proxy authentication.
    /// This cookie is automatically sent by the browser with subsequent resource requests.
    /// </summary>
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
            SameSite = SameSiteMode.None,  // Required for iframe cross-origin
            MaxAge = TimeSpan.FromHours(1),  // Match typical session duration
            Path = "/api/reports/ssrs-resource"  // Only send for SSRS resource requests
        });
    }
}
