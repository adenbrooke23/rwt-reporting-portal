import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import { MockUserService } from '../../auth/services/mock-user.service';
import { SubReport, getCategoryByReportId, getReportById } from '../../auth/models/user-management.models';

export interface FavoriteReportsByCategory {
  categoryId: string;
  categoryName: string;
  reports: SubReport[];
}

@Injectable({
  providedIn: 'root'
})
export class PersonalDashboardService {
  private authService = inject(AuthService);
  private mockUserService = inject(MockUserService);
  private platformId = inject(PLATFORM_ID);

  private favoritesSubject = new BehaviorSubject<string[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  constructor() {
    this.loadFavorites();
  }

  
  private loadFavorites(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const user = this.authService.getCurrentUser();
    if (user) {
      const stored = localStorage.getItem(`favorites_${user.id}`);
      const favorites = stored ? JSON.parse(stored) : [];
      this.favoritesSubject.next(favorites);
    }
  }

  
  private saveFavorites(favorites: string[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const user = this.authService.getCurrentUser();
    if (user) {
      localStorage.setItem(`favorites_${user.id}`, JSON.stringify(favorites));
      this.favoritesSubject.next(favorites);
    }
  }

  
  addFavorite(reportId: string): void {
    const currentFavorites = this.favoritesSubject.value;
    if (!currentFavorites.includes(reportId)) {
      this.saveFavorites([...currentFavorites, reportId]);
    }
  }

  
  removeFavorite(reportId: string): void {
    const currentFavorites = this.favoritesSubject.value;
    const updated = currentFavorites.filter(id => id !== reportId);
    this.saveFavorites(updated);
  }

  
  isFavorite(reportId: string): boolean {
    return this.favoritesSubject.value.includes(reportId);
  }

  
  getFavoriteIds(): string[] {
    return this.favoritesSubject.value;
  }

  
  getFavoriteReportsByCategory(): FavoriteReportsByCategory[] {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return [];
    }

    const userPermissions = this.mockUserService.getUserPermissions(user.id);
    const favoriteIds = this.favoritesSubject.value;

    const accessibleFavorites = favoriteIds.filter(id => userPermissions.includes(id));

    const categoriesMap = new Map<string, SubReport[]>();

    for (const reportId of accessibleFavorites) {
      const report = getReportById(reportId);
      if (!report) continue;

      const category = getCategoryByReportId(reportId);
      if (!category) continue;

      if (!categoriesMap.has(category.id)) {
        categoriesMap.set(category.id, []);
      }

      categoriesMap.get(category.id)!.push(report);
    }

    const result: FavoriteReportsByCategory[] = [];
    for (const [categoryId, reports] of categoriesMap.entries()) {
      const category = getCategoryByReportId(reports[0].id);
      if (category) {
        result.push({
          categoryId: category.id,
          categoryName: category.name,
          reports: reports
        });
      }
    }

    return result;
  }

  
  getFavoritesCount(): number {
    return this.favoritesSubject.value.length;
  }

  
  clearFavorites(): void {
    this.saveFavorites([]);
  }
}
