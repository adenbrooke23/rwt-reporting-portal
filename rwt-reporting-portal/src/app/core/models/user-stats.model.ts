
export interface UserStats {
  availableReports: number;
  pinnedFavorites: number;
  recentViews: number;
}

export interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
}
