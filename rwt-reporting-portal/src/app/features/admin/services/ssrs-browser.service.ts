import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface SSRSCatalogItem {
  name: string;
  path: string;
  typeName: string;
  description?: string;
  modifiedDate?: string;
}

export interface SSRSFolderListResponse {
  currentPath: string;
  folders: SSRSCatalogItem[];
  reports: SSRSCatalogItem[];
  success: boolean;
  errorMessage?: string;
}

export interface SSRSConfigResponse {
  serverUrl: string;
  isAvailable: boolean;
  errorMessage?: string;
}

export interface SSRSReportSelection {
  reportPath: string;
  reportName: string;
  description?: string;
  serverUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class SSRSBrowserService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';

  private currentPath = new BehaviorSubject<string>('/');
  currentPath$ = this.currentPath.asObservable();

  private isLoading = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoading.asObservable();

  /**
   * Get SSRS server configuration
   */
  getConfig(): Observable<SSRSConfigResponse> {
    return this.http.get<SSRSConfigResponse>(`${this.API_BASE_URL}/admin/ssrs/config`).pipe(
      catchError(() => of({
        serverUrl: '',
        isAvailable: false,
        errorMessage: 'Unable to connect to API'
      }))
    );
  }

  /**
   * Browse SSRS folder
   */
  browse(path: string = '/'): Observable<SSRSFolderListResponse> {
    this.isLoading.next(true);
    this.currentPath.next(path);

    return this.http.get<SSRSFolderListResponse>(
      `${this.API_BASE_URL}/admin/ssrs/browse`,
      { params: { path } }
    ).pipe(
      tap(() => this.isLoading.next(false)),
      catchError(() => {
        this.isLoading.next(false);
        return of({
          currentPath: path,
          folders: [],
          reports: [],
          success: false,
          errorMessage: 'Unable to browse SSRS folder'
        });
      })
    );
  }

  /**
   * Navigate to parent folder
   */
  getParentPath(currentPath: string): string {
    if (currentPath === '/' || !currentPath) return '/';
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    return parts.length ? '/' + parts.join('/') : '/';
  }

  /**
   * Build breadcrumb from path
   */
  getBreadcrumbs(path: string): { name: string; path: string }[] {
    const breadcrumbs = [{ name: 'Root', path: '/' }];

    if (path === '/') return breadcrumbs;

    const parts = path.split('/').filter(p => p);
    let currentPath = '';

    for (const part of parts) {
      currentPath += '/' + part;
      breadcrumbs.push({ name: part, path: currentPath });
    }

    return breadcrumbs;
  }
}
