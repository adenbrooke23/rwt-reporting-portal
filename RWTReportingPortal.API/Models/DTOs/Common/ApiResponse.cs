namespace RWTReportingPortal.API.Models.DTOs.Common;

public class ApiResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
}

public class ApiResponse<T> : ApiResponse
{
    public T? Data { get; set; }
}

public class ErrorResponse
{
    public string Error { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public object? Details { get; set; }
    public string? TraceId { get; set; }
}
