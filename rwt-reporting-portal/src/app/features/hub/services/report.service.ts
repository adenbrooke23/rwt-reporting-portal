import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Report } from '../../admin/models/content-management.models';
import { ReportType, ReportEmbedConfig } from '../../auth/models/user-management.models';

interface ReportApiResponse {
  reportId: number;
  reportCode: string;
  reportName: string;
  description?: string;
  reportType: string;
  hubId: number;
  hubName: string;
  reportGroupId: number;
  reportGroupName: string;
  embedConfig?: {
    workspaceId?: string;
    reportId?: string;
    embedUrl?: string;
    serverUrl?: string;
    reportPath?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';

  getReport(reportId: string | number): Observable<Report | null> {
    return this.http.get<ReportApiResponse>(`${this.API_BASE_URL}/reports/${reportId}`).pipe(
      map(response => this.mapApiResponseToReport(response)),
      catchError(error => {
        console.error('Error fetching report:', error);
        return of(null);
      })
    );
  }

  private mapApiResponseToReport(response: ReportApiResponse): Report {
    const embedConfig: ReportEmbedConfig = {};

    if (response.embedConfig) {
      embedConfig.workspaceId = response.embedConfig.workspaceId;
      embedConfig.reportId = response.embedConfig.reportId;
      embedConfig.embedUrl = response.embedConfig.embedUrl;
      embedConfig.serverUrl = response.embedConfig.serverUrl;
      embedConfig.reportPath = response.embedConfig.reportPath;
    }

    return {
      id: response.reportId.toString(),
      reportGroupId: response.reportGroupId.toString(),
      hubId: response.hubId.toString(),
      name: response.reportName,
      description: response.description || '',
      type: response.reportType as ReportType,
      embedConfig: embedConfig,
      sortOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: ''
    };
  }
}
