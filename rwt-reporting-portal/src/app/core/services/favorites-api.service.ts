import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';

export interface FavoriteReport {
  userFavoriteId: number;
  reportId: number;
  reportCode: string;
  reportName: string;
  description?: string;
  reportType: string;
  hubName: string;
  sortOrder: number;
}

@Injectable({
  providedIn: 'root'
})
export class FavoritesApiService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';
  private readonly apiUrl = `${this.API_BASE_URL}/favorites`;

  private favoritesSubject = new BehaviorSubject<FavoriteReport[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadedSubject = new BehaviorSubject<boolean>(false);

  public favorites$ = this.favoritesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public loaded$ = this.loadedSubject.asObservable();

  /**
   * Load favorites from the API
   */
  loadFavorites(): Observable<FavoriteReport[]> {
    if (this.loadedSubject.value) {
      return of(this.favoritesSubject.value);
    }

    this.loadingSubject.next(true);

    return this.http.get<FavoriteReport[]>(this.apiUrl).pipe(
      tap(favorites => {
        this.favoritesSubject.next(favorites);
        this.loadedSubject.next(true);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Error loading favorites:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Force reload favorites from the API (bypass cache)
   */
  refreshFavorites(): Observable<FavoriteReport[]> {
    this.loadedSubject.next(false);
    return this.loadFavorites();
  }

  /**
   * Get current favorites synchronously
   */
  getFavorites(): FavoriteReport[] {
    return this.favoritesSubject.value;
  }

  /**
   * Check if a report is favorited
   */
  isFavorite(reportId: number): boolean {
    return this.favoritesSubject.value.some(f => f.reportId === reportId);
  }

  /**
   * Add a report to favorites
   */
  addFavorite(reportId: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/${reportId}`, {}).pipe(
      tap(() => {
        // Refresh the favorites list after adding
        this.refreshFavorites().subscribe();
      }),
      catchError(error => {
        console.error('Error adding favorite:', error);
        throw error;
      })
    );
  }

  /**
   * Remove a report from favorites
   */
  removeFavorite(reportId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${reportId}`).pipe(
      tap(() => {
        // Update local state immediately
        const updated = this.favoritesSubject.value.filter(f => f.reportId !== reportId);
        this.favoritesSubject.next(updated);
      }),
      catchError(error => {
        console.error('Error removing favorite:', error);
        throw error;
      })
    );
  }

  /**
   * Toggle favorite status for a report
   */
  toggleFavorite(reportId: number): Observable<{ success: boolean }> {
    if (this.isFavorite(reportId)) {
      return this.removeFavorite(reportId);
    } else {
      return this.addFavorite(reportId);
    }
  }

  /**
   * Reorder favorites
   */
  reorderFavorites(reportIds: number[]): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/reorder`, reportIds).pipe(
      tap(() => {
        // Refresh the favorites list after reordering
        this.refreshFavorites().subscribe();
      }),
      catchError(error => {
        console.error('Error reordering favorites:', error);
        throw error;
      })
    );
  }

  /**
   * Get favorites count
   */
  getFavoritesCount(): number {
    return this.favoritesSubject.value.length;
  }

  /**
   * Clear local favorites state (for logout)
   */
  clearFavorites(): void {
    this.favoritesSubject.next([]);
    this.loadedSubject.next(false);
  }
}
