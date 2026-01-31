import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';

export interface PinnedReportDto {
  userPinnedReportId: number;
  reportId: number;
  reportCode: string;
  reportName: string;
  description?: string;
  reportType: string;
  hubId: number;
  hubName: string;
  sortOrder: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuickAccessApiService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';
  private readonly apiUrl = `${this.API_BASE_URL}/quick-access`;

  private pinnedReportsSubject = new BehaviorSubject<PinnedReportDto[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadedSubject = new BehaviorSubject<boolean>(false);

  public pinnedReports$ = this.pinnedReportsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public loaded$ = this.loadedSubject.asObservable();

  /**
   * Load pinned reports from the API
   */
  loadPinnedReports(): Observable<PinnedReportDto[]> {
    if (this.loadedSubject.value) {
      return of(this.pinnedReportsSubject.value);
    }

    this.loadingSubject.next(true);

    return this.http.get<PinnedReportDto[]>(this.apiUrl).pipe(
      tap(pinnedReports => {
        this.pinnedReportsSubject.next(pinnedReports);
        this.loadedSubject.next(true);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Error loading pinned reports:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Force reload pinned reports from the API (bypass cache)
   */
  refreshPinnedReports(): Observable<PinnedReportDto[]> {
    this.loadedSubject.next(false);
    return this.loadPinnedReports();
  }

  /**
   * Get current pinned reports synchronously
   */
  getPinnedReports(): PinnedReportDto[] {
    return this.pinnedReportsSubject.value;
  }

  /**
   * Check if a report is pinned
   */
  isPinned(reportId: number): boolean {
    return this.pinnedReportsSubject.value.some(p => p.reportId === reportId);
  }

  /**
   * Pin a report
   */
  pinReport(reportId: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/${reportId}`, {}).pipe(
      tap(() => {
        // Refresh the pinned reports list after adding
        this.refreshPinnedReports().subscribe();
      }),
      catchError(error => {
        console.error('Error pinning report:', error);
        throw error;
      })
    );
  }

  /**
   * Unpin a report
   */
  unpinReport(reportId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${reportId}`).pipe(
      tap(() => {
        // Update local state immediately
        const updated = this.pinnedReportsSubject.value.filter(p => p.reportId !== reportId);
        this.pinnedReportsSubject.next(updated);
      }),
      catchError(error => {
        console.error('Error unpinning report:', error);
        throw error;
      })
    );
  }

  /**
   * Reorder pinned reports
   */
  reorderPinnedReports(reportIds: number[]): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/reorder`, reportIds).pipe(
      tap(() => {
        // Refresh the pinned reports list after reordering
        this.refreshPinnedReports().subscribe();
      }),
      catchError(error => {
        console.error('Error reordering pinned reports:', error);
        throw error;
      })
    );
  }

  /**
   * Get pinned reports count
   */
  getPinnedReportsCount(): number {
    return this.pinnedReportsSubject.value.length;
  }

  /**
   * Clear local pinned reports state (for logout)
   */
  clearPinnedReports(): void {
    this.pinnedReportsSubject.next([]);
    this.loadedSubject.next(false);
  }
}
