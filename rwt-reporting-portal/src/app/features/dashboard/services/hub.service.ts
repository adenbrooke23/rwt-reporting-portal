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
}
