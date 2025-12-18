namespace RWTReportingPortal.API.Models.Entities;

public class Announcement
{
    public int AnnouncementId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ImagePath { get; set; }
    public int ReadTimeMinutes { get; set; } = 1;
    public bool IsFeatured { get; set; } = false;
    public bool IsPublished { get; set; } = false;
    public DateTime? PublishedAt { get; set; }
    public int? AuthorId { get; set; }
    public string? AuthorName { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public User? Author { get; set; }
    public User? DeletedByUser { get; set; }
}
