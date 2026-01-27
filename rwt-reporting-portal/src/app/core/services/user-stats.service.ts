import { Injectable, inject } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map, delay } from 'rxjs/operators';
import { UserStats, QuickStat } from '../models/user-stats.model';
import { QuickAccessService } from './quick-access.service';
import { AuthService } from '../../features/auth/services/auth.service';
import { MockUserService } from '../../features/auth/services/mock-user.service';

@Injectable({
  providedIn: 'root'
})
export class UserStatsService {
  private quickAccessService = inject(QuickAccessService);
  private authService = inject(AuthService);
  private mockUserService = inject(MockUserService);

  private recentViewsCount = 24;

  
  getUserStats(): Observable<UserStats> {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      return of({
        availableReports: 0,
        pinnedFavorites: 0,
        recentViews: 0
      }).pipe(delay(200));
    }

    const userReports = this.mockUserService.getUserReports(currentUser.id);
    const pinnedReports = this.quickAccessService.getPinnedReports();

    return of({
      availableReports: userReports.length,
      pinnedFavorites: pinnedReports.length,
      recentViews: this.recentViewsCount
    }).pipe(delay(300));
  }

  
  getQuickStats(): Observable<QuickStat[]> {
    return this.getUserStats().pipe(
      map(stats => [
        { label: 'Available Reports', value: stats.availableReports, icon: 'report' },
        { label: 'Pinned Favorites', value: stats.pinnedFavorites, icon: 'star' },
        { label: 'Recent Views', value: stats.recentViews, icon: 'view' }
      ])
    );
  }

  
  getQuickStatsLive(): Observable<QuickStat[]> {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      return of([
        { label: 'Available Reports', value: 0, icon: 'report' },
        { label: 'Pinned Favorites', value: 0, icon: 'star' },
        { label: 'Recent Views', value: 0, icon: 'view' }
      ]);
    }

    const userReports = this.mockUserService.getUserReports(currentUser.id);

    return this.quickAccessService.pinnedReports$.pipe(
      map(pinnedReports => [
        { label: 'Available Reports', value: userReports.length, icon: 'report' },
        { label: 'Pinned Favorites', value: pinnedReports.length, icon: 'star' },
        { label: 'Recent Views', value: this.recentViewsCount, icon: 'view' }
      ])
    );
  }

  
  incrementRecentViews(): void {
    this.recentViewsCount++;
  }

  
  resetRecentViews(): void {
    this.recentViewsCount = 0;
  }
}
