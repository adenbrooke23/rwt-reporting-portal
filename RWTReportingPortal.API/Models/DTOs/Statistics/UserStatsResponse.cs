namespace RWTReportingPortal.API.Models.DTOs.Statistics;

public class UserStatsResponse
{
    public int AvailableReports { get; set; }
    public int PinnedFavorites { get; set; }
    public int RecentViews { get; set; }
}
