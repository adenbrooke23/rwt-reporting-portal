using Microsoft.Identity.Client;
using System.Net.Http.Headers;
using System.Text.Json;

namespace RWTReportingPortal.API.Infrastructure.Auth;

public interface IEntraAuthService
{
    string GetAuthorizationUrl(string state, string redirectUri);
    Task<EntraTokenResult> ExchangeCodeForTokenAsync(string code, string redirectUri);
    Task<EntraTokenResult> AuthenticateWithPasswordAsync(string email, string password);
    Task<EntraUserInfo> GetUserInfoAsync(string accessToken);
}

public class EntraAuthService : IEntraAuthService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EntraAuthService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfidentialClientApplication _confidentialClient;

    public EntraAuthService(
        IConfiguration configuration,
        ILogger<EntraAuthService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClientFactory = httpClientFactory;

        var azureAdSettings = _configuration.GetSection("AzureAd");
        var tenantId = azureAdSettings["TenantId"]!;
        var clientId = azureAdSettings["ClientId"]!;
        var clientSecret = azureAdSettings["ClientSecret"]!;

        _confidentialClient = ConfidentialClientApplicationBuilder
            .Create(clientId)
            .WithClientSecret(clientSecret)
            .WithAuthority(AzureCloudInstance.AzurePublic, tenantId)
            .Build();
    }

    public string GetAuthorizationUrl(string state, string redirectUri)
    {
        var azureAdSettings = _configuration.GetSection("AzureAd");
        var tenantId = azureAdSettings["TenantId"]!;
        var clientId = azureAdSettings["ClientId"]!;

        var scopes = new[] { "openid", "profile", "email", "User.Read" };
        var scopeString = string.Join(" ", scopes);

        return $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize" +
               $"?client_id={clientId}" +
               $"&response_type=code" +
               $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
               $"&response_mode=query" +
               $"&scope={Uri.EscapeDataString(scopeString)}" +
               $"&state={state}";
    }

    public async Task<EntraTokenResult> ExchangeCodeForTokenAsync(string code, string redirectUri)
    {
        try
        {
            var azureAdSettings = _configuration.GetSection("AzureAd");
            var tenantId = azureAdSettings["TenantId"]!;
            var clientId = azureAdSettings["ClientId"]!;
            var clientSecret = azureAdSettings["ClientSecret"]!;

            var confidentialClient = ConfidentialClientApplicationBuilder
                .Create(clientId)
                .WithClientSecret(clientSecret)
                .WithAuthority(AzureCloudInstance.AzurePublic, tenantId)
                .WithRedirectUri(redirectUri)
                .Build();

            var scopes = new[] { "User.Read" };

            var result = await confidentialClient
                .AcquireTokenByAuthorizationCode(scopes, code)
                .ExecuteAsync();

            return new EntraTokenResult
            {
                AccessToken = result.AccessToken,
                IdToken = result.IdToken,
                ExpiresOn = result.ExpiresOn,
                Success = true
            };
        }
        catch (MsalException ex)
        {
            _logger.LogError(ex, "Failed to exchange authorization code for tokens");
            return new EntraTokenResult
            {
                Success = false,
                Error = ex.ErrorCode,
                ErrorDescription = ex.Message
            };
        }
    }

    public async Task<EntraTokenResult> AuthenticateWithPasswordAsync(string email, string password)
    {
        try
        {
            var azureAdSettings = _configuration.GetSection("AzureAd");
            var tenantId = azureAdSettings["TenantId"]!;
            var clientId = azureAdSettings["ClientId"]!;

            var publicClient = PublicClientApplicationBuilder
                .Create(clientId)
                .WithAuthority(AzureCloudInstance.AzurePublic, tenantId)
                .Build();

            var scopes = new[] { "User.Read" };

            var result = await publicClient
                .AcquireTokenByUsernamePassword(scopes, email, password)
                .ExecuteAsync();

            return new EntraTokenResult
            {
                AccessToken = result.AccessToken,
                IdToken = result.IdToken,
                ExpiresOn = result.ExpiresOn,
                Success = true
            };
        }
        catch (MsalException ex)
        {
            _logger.LogWarning(ex, "ROPC authentication failed for {Email}", email);
            return new EntraTokenResult
            {
                Success = false,
                Error = ex.ErrorCode,
                ErrorDescription = ex.Message
            };
        }
    }

    public async Task<EntraUserInfo> GetUserInfoAsync(string accessToken)
    {
        var httpClient = _httpClientFactory.CreateClient("MicrosoftGraph");
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try
        {

            var userResponse = await httpClient.GetAsync("me?$select=id,mail,userPrincipalName,givenName,surname,displayName,companyName");
            userResponse.EnsureSuccessStatusCode();

            var userJson = await userResponse.Content.ReadAsStringAsync();
            using var userDoc = JsonDocument.Parse(userJson);
            var root = userDoc.RootElement;

            var userInfo = new EntraUserInfo
            {
                ObjectId = root.GetProperty("id").GetString() ?? "",
                Email = root.TryGetProperty("mail", out var mail) && mail.ValueKind != JsonValueKind.Null
                    ? mail.GetString() ?? ""
                    : root.TryGetProperty("userPrincipalName", out var upn) ? upn.GetString() ?? "" : "",
                FirstName = root.TryGetProperty("givenName", out var givenName) && givenName.ValueKind != JsonValueKind.Null
                    ? givenName.GetString() ?? ""
                    : "",
                LastName = root.TryGetProperty("surname", out var surname) && surname.ValueKind != JsonValueKind.Null
                    ? surname.GetString() ?? ""
                    : "",
                DisplayName = root.TryGetProperty("displayName", out var displayName) && displayName.ValueKind != JsonValueKind.Null
                    ? displayName.GetString()
                    : null,
                CompanyName = root.TryGetProperty("companyName", out var companyName) && companyName.ValueKind != JsonValueKind.Null
                    ? companyName.GetString()
                    : null,
                Groups = new List<string>()
            };

            var groupsResponse = await httpClient.GetAsync("me/memberOf?$select=id,displayName");
            if (groupsResponse.IsSuccessStatusCode)
            {
                var groupsJson = await groupsResponse.Content.ReadAsStringAsync();
                using var groupsDoc = JsonDocument.Parse(groupsJson);

                if (groupsDoc.RootElement.TryGetProperty("value", out var groupsArray))
                {
                    foreach (var group in groupsArray.EnumerateArray())
                    {

                        if (group.TryGetProperty("@odata.type", out var odataType) &&
                            odataType.GetString() == "#microsoft.graph.group")
                        {
                            if (group.TryGetProperty("id", out var groupId))
                            {
                                userInfo.Groups.Add(groupId.GetString() ?? "");
                            }
                        }
                    }
                }
            }
            else
            {
                _logger.LogWarning("Failed to retrieve group memberships: {StatusCode}", groupsResponse.StatusCode);
            }

            return userInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get user info from Microsoft Graph");
            throw;
        }
    }
}

public class EntraTokenResult
{
    public bool Success { get; set; }
    public string? AccessToken { get; set; }
    public string? IdToken { get; set; }
    public DateTimeOffset ExpiresOn { get; set; }
    public string? Error { get; set; }
    public string? ErrorDescription { get; set; }
}

public class EntraUserInfo
{
    public string ObjectId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? CompanyName { get; set; }
    public List<string> Groups { get; set; } = new();
}
