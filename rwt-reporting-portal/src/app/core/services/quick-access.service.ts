import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, map, takeUntil, Subject } from 'rxjs';
import { SubReport } from '../../features/auth/models/user-management.models';
import { QuickAccessApiService, PinnedReportDto } from './quick-access-api.service';

export interface PinnedReport {
  report: SubReport;
  hubId: string;
  hubName: string;
}

@Injectable({
  providedIn: 'root'
})
export class QuickAccessService {
  private platformId = inject(PLATFORM_ID);
  private quickAccessApi = inject(QuickAccessApiService);
  private destroy$ = new Subject<void>();

  private pinnedReportsSubject = new BehaviorSubject<PinnedReport[]>([]);
  public pinnedReports$: Observable<PinnedReport[]>;

  constructor() {
    // Map API response to the PinnedReport interface used by components
    this.pinnedReports$ = this.quickAccessApi.pinnedReports$.pipe(
      map(apiReports => this.mapApiToPinnedReports(apiReports))
    );

    // Keep the local subject in sync for getPinnedReports()
    this.pinnedReports$.pipe(takeUntil(this.destroy$)).subscribe(reports => {
      this.pinnedReportsSubject.next(reports);
    });

    // Load pinned reports from API on service init (only in browser)
    if (isPlatformBrowser(this.platformId)) {
      this.quickAccessApi.loadPinnedReports().subscribe();
    }
  }

  private mapApiToPinnedReports(apiReports: PinnedReportDto[]): PinnedReport[] {
    return apiReports.map(dto => ({
      report: {
        id: dto.reportId.toString(),
        name: dto.reportName,
        description: dto.description || '',
        route: `/hub/${dto.hubId}/report/${dto.reportId}`,
        type: dto.reportType as 'SSRS' | 'PowerBI' | 'Paginated'
      },
      hubId: dto.hubId.toString(),
      hubName: dto.hubName
    }));
  }

  getPinnedReports(): PinnedReport[] {
    return this.pinnedReportsSubject.value;
  }

  isPinned(reportId: string): boolean {
    const reportIdNum = parseInt(reportId, 10);
    return this.quickAccessApi.isPinned(reportIdNum);
  }

  pinReport(report: SubReport, hubId: string, hubName: string): void {
    const reportIdNum = parseInt(report.id, 10);
    if (isNaN(reportIdNum)) {
      console.error('Invalid report ID for pinning:', report.id);
      return;
    }

    this.quickAccessApi.pinReport(reportIdNum).subscribe({
      error: (err) => console.error('Failed to pin report:', err)
    });
  }

  unpinReport(reportId: string): void {
    const reportIdNum = parseInt(reportId, 10);
    if (isNaN(reportIdNum)) {
      console.error('Invalid report ID for unpinning:', reportId);
      return;
    }

    this.quickAccessApi.unpinReport(reportIdNum).subscribe({
      error: (err) => console.error('Failed to unpin report:', err)
    });
  }

  togglePin(report: SubReport, hubId: string, hubName: string): void {
    if (this.isPinned(report.id)) {
      this.unpinReport(report.id);
    } else {
      this.pinReport(report, hubId, hubName);
    }
  }

  getPinnedByHub(): Map<string, { hubName: string; reports: SubReport[] }> {
    const pinnedReports = this.pinnedReportsSubject.value;
    const byHub = new Map<string, { hubName: string; reports: SubReport[] }>();

    pinnedReports.forEach(pr => {
      if (!byHub.has(pr.hubId)) {
        byHub.set(pr.hubId, { hubName: pr.hubName, reports: [] });
      }
      byHub.get(pr.hubId)!.reports.push(pr.report);
    });

    return byHub;
  }

  /**
   * Reload pinned reports from API
   */
  refresh(): void {
    this.quickAccessApi.refreshPinnedReports().subscribe();
  }

  /**
   * Clear pinned reports (for logout)
   */
  clear(): void {
    this.quickAccessApi.clearPinnedReports();
  }
}
