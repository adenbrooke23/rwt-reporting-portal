import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FavoritesApiService, FavoriteReport } from '../../../core/services/favorites-api.service';

export interface FavoriteReportsByCategory {
  categoryId: string;
  categoryName: string;
  reports: FavoriteReport[];
}

@Injectable({
  providedIn: 'root'
})
export class PersonalDashboardService {
  private favoritesApi = inject(FavoritesApiService);

  /**
   * Observable of all favorite reports
   */
  public favorites$ = this.favoritesApi.favorites$;

  /**
   * Observable of loading state
   */
  public loading$ = this.favoritesApi.loading$;

  /**
   * Load favorites from the API
   */
  loadFavorites(): Observable<FavoriteReport[]> {
    return this.favoritesApi.loadFavorites();
  }

  /**
   * Refresh favorites from the API (bypass cache)
   */
  refreshFavorites(): Observable<FavoriteReport[]> {
    return this.favoritesApi.refreshFavorites();
  }

  /**
   * Add a report to favorites
   */
  addFavorite(reportId: number): Observable<{ success: boolean }> {
    return this.favoritesApi.addFavorite(reportId);
  }

  /**
   * Remove a report from favorites
   */
  removeFavorite(reportId: number): Observable<{ success: boolean }> {
    return this.favoritesApi.removeFavorite(reportId);
  }

  /**
   * Check if a report is favorited
   */
  isFavorite(reportId: number): boolean {
    return this.favoritesApi.isFavorite(reportId);
  }

  /**
   * Get all favorite report IDs
   */
  getFavoriteIds(): number[] {
    return this.favoritesApi.getFavorites().map(f => f.reportId);
  }

  /**
   * Get favorites count
   */
  getFavoritesCount(): number {
    return this.favoritesApi.getFavoritesCount();
  }

  /**
   * Get favorites grouped by hub
   */
  getFavoritesByHub(): Observable<Map<string, FavoriteReport[]>> {
    return this.favorites$.pipe(
      map(favorites => {
        const byHub = new Map<string, FavoriteReport[]>();

        for (const fav of favorites) {
          const hubName = fav.hubName || 'Unknown';
          if (!byHub.has(hubName)) {
            byHub.set(hubName, []);
          }
          byHub.get(hubName)!.push(fav);
        }

        return byHub;
      })
    );
  }

  /**
   * Clear favorites state (for logout)
   */
  clearFavorites(): void {
    this.favoritesApi.clearFavorites();
  }
}
