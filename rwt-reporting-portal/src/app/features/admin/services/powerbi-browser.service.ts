import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

export interface PowerBIWorkspace {
  workspaceId: string;
  workspaceName: string;
  description?: string;
  type: string;
  reportCount: number;
  paginatedReportCount: number;
}

export interface PowerBIReport {
  reportId: string;
  reportName: string;
  description?: string;
  datasetId: string;
  embedUrl: string;
  reportType: 'PowerBIReport' | 'PaginatedReport';
  modifiedDateTime?: string;
  alreadyImported: boolean;
  existingReportId?: number;
}

export interface PowerBIConfigResponse {
  isConfigured: boolean;
  isConnected: boolean;
  tenantId?: string;
  clientId?: string;
  errorMessage?: string;
}

export interface PowerBIReportSelection {
  workspaceId: string;
  workspaceName: string;
  reportId: string;
  reportName: string;
  description?: string;
  embedUrl: string;
  reportType: 'PowerBIReport' | 'PaginatedReport';
}

@Injectable({
  providedIn: 'root'
})
export class PowerBIBrowserService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';

  private isLoading = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoading.asObservable();

  private selectedWorkspace = new BehaviorSubject<PowerBIWorkspace | null>(null);
  selectedWorkspace$ = this.selectedWorkspace.asObservable();

  
  getConfig(): Observable<PowerBIConfigResponse> {
    return this.http.get<PowerBIConfigResponse>(`${this.API_BASE_URL}/admin/powerbi/config`).pipe(
      catchError(() => of({
        isConfigured: false,
        isConnected: false,
        errorMessage: 'Unable to connect to API'
      }))
    );
  }

  
  testConnection(): Observable<{ isConnected: boolean; error?: string }> {
    return this.http.get<{ isConnected: boolean; error?: string }>(
      `${this.API_BASE_URL}/admin/powerbi/test`
    ).pipe(
      catchError(() => of({ isConnected: false, error: 'Unable to connect to API' }))
    );
  }

  
  getWorkspaces(): Observable<PowerBIWorkspace[]> {
    this.isLoading.next(true);

    return this.http.get<{ workspaces: PowerBIWorkspace[] }>(
      `${this.API_BASE_URL}/admin/powerbi/workspaces`
    ).pipe(
      map(response => response.workspaces),
      tap(() => this.isLoading.next(false)),
      catchError(error => {
        this.isLoading.next(false);
        console.error('Failed to get Power BI workspaces:', error);
        return of([]);
      })
    );
  }

  
  getWorkspaceReports(workspaceId: string): Observable<PowerBIReport[]> {
    this.isLoading.next(true);

    return this.http.get<{ reports: PowerBIReport[] }>(
      `${this.API_BASE_URL}/admin/powerbi/workspaces/${workspaceId}/reports`
    ).pipe(
      map(response => response.reports),
      tap(() => this.isLoading.next(false)),
      catchError(error => {
        this.isLoading.next(false);
        console.error('Failed to get workspace reports:', error);
        return of([]);
      })
    );
  }

  
  setSelectedWorkspace(workspace: PowerBIWorkspace | null): void {
    this.selectedWorkspace.next(workspace);
  }

  
  getEmbedInfo(workspaceId: string, reportId: string): Observable<{
    embedUrl: string;
    embedToken: string;
    reportId: string;
    tokenExpiry: string;
  }> {
    return this.http.get<{
      embedUrl: string;
      embedToken: string;
      reportId: string;
      tokenExpiry: string;
    }>(`${this.API_BASE_URL}/admin/powerbi/workspaces/${workspaceId}/reports/${reportId}/embed`);
  }

  
  getReportTypeLabel(reportType: string): string {
    switch (reportType) {
      case 'PowerBIReport':
        return 'Power BI';
      case 'PaginatedReport':
        return 'Paginated';
      default:
        return reportType;
    }
  }
}
