namespace RWTReportingPortal.API.Models.DTOs.Announcements;

public class AnnouncementDto
{
    public int AnnouncementId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ImagePath { get; set; }
    public int ReadTimeMinutes { get; set; }
    public bool IsFeatured { get; set; }
    public string? AuthorName { get; set; }
    public DateTime? PublishedAt { get; set; }
}

public class AnnouncementListResponse
{
    public List<AnnouncementDto> Announcements { get; set; } = new();
}

public class AdminAnnouncementDto : AnnouncementDto
{
    public bool IsPublished { get; set; }
    public int? AuthorId { get; set; }
    public string? AuthorEmail { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
}

public class CreateAnnouncementRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ImagePath { get; set; }
    public int ReadTimeMinutes { get; set; } = 1;
    public bool IsFeatured { get; set; } = false;
    public bool IsPublished { get; set; } = false;
    public string? AuthorName { get; set; }
}

public class UpdateAnnouncementRequest
{
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string? Content { get; set; }
    public string? ImagePath { get; set; }
    public int? ReadTimeMinutes { get; set; }
    public bool? IsFeatured { get; set; }
}
