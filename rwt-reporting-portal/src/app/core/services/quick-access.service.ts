import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { SubReport } from '../../features/auth/models/user-management.models';

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
  private readonly STORAGE_KEY = 'quick_access_reports';
  private pinnedReportsSubject: BehaviorSubject<PinnedReport[]>;

  public pinnedReports$: Observable<PinnedReport[]>;

  constructor() {

    const initialData = this.loadFromStorage();
    this.pinnedReportsSubject = new BehaviorSubject<PinnedReport[]>(initialData);
    this.pinnedReports$ = this.pinnedReportsSubject.asObservable();
  }

  private loadFromStorage(): PinnedReport[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private saveToStorage(reports: PinnedReport[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  getPinnedReports(): PinnedReport[] {
    return this.pinnedReportsSubject.value;
  }

  isPinned(reportId: string): boolean {
    return this.pinnedReportsSubject.value.some(pr => pr.report.id === reportId);
  }

  pinReport(report: SubReport, hubId: string, hubName: string): void {
    const current = this.pinnedReportsSubject.value;

    if (this.isPinned(report.id)) {
      return;
    }

    const updated = [...current, { report, hubId, hubName }];
    this.pinnedReportsSubject.next(updated);
    this.saveToStorage(updated);
  }

  unpinReport(reportId: string): void {
    const current = this.pinnedReportsSubject.value;
    const updated = current.filter(pr => pr.report.id !== reportId);
    this.pinnedReportsSubject.next(updated);
    this.saveToStorage(updated);
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
}
