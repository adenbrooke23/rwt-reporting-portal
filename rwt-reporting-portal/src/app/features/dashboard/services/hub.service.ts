import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface HubDto {
  hubId: number;
  hubCode: string;
  hubName: string;
  description?: string;
  iconName?: string;
  backgroundImage?: string;
  reportCount: number;
}

export interface HubListResponse {
  hubs: HubDto[];
}

export interface HubReportDto {
  reportId: number;
  reportCode: string;
  reportName: string;
  description?: string;
  reportType: string;
  groupId: number;
  groupName: string;
  accessLevel: string;
}

export interface HubDetailResponse {
  hubId: number;
  hubName: string;
  description?: string;
  reports: HubReportDto[];
}

@Injectable({
  providedIn: 'root'
})
export class HubService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';

  
  getAccessibleHubs(): Observable<HubDto[]> {
    return this.http.get<HubListResponse>(`${this.API_BASE_URL}/hubs`).pipe(
      map(response => response.hubs),
      catchError(error => {
        console.error('Error fetching accessible hubs:', error);
        return of([]);
      })
    );
  }

  getHubDetail(hubId: number | string): Observable<HubDetailResponse | null> {
    return this.http.get<HubDetailResponse>(`${this.API_BASE_URL}/hubs/${hubId}`).pipe(
      catchError(error => {
        console.error('Error fetching hub detail:', error);
        return of(null);
      })
    );
  }
}
