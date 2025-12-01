/**
 * User dashboard statistics model
 * Matches the usp_UserStats_GetDashboard output from DATABASE_STORED_PROCEDURES.md
 */
export interface UserStats {
  availableReports: number;
  pinnedFavorites: number;
  recentViews: number;
}

/**
 * Quick stat display item for the dashboard
 */
export interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
}
