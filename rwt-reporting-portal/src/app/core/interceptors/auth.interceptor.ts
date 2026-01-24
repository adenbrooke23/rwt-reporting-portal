import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Auth Interceptor - Adds JWT token to API requests and handles 401 errors
 *
 * IMPORTANT: This interceptor reads directly from localStorage to avoid
 * a circular dependency (HttpClient -> Interceptor -> AuthService -> HttpClient).
 * Do NOT inject AuthService here.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  // API base URL that requires authentication
  private readonly API_BASE = 'https://erpqaapi.redwoodtrust.com/api';

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only add auth header for requests to our API
    if (request.url.startsWith(this.API_BASE)) {
      const accessToken = this.getAccessToken();

      if (accessToken) {
        request = request.clone({
          setHeaders: {
            Authorization: `Bearer ${accessToken}`
          }
        });
      }
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized - token expired or invalid
        if (error.status === 401 && request.url.startsWith(this.API_BASE)) {
          this.handleUnauthorized();
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Handle 401 Unauthorized response
   * Clears session and redirects to login
   */
  private handleUnauthorized(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Clear all auth data from storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');

    // Redirect to login page
    // Use setTimeout to avoid issues with change detection during error handling
    setTimeout(() => {
      this.router.navigate(['/login'], {
        queryParams: { sessionExpired: 'true' }
      });
    }, 0);
  }

  /**
   * Get access token directly from storage to avoid circular dependency
   */
  private getAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const tokenStr = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (tokenStr) {
        const token = JSON.parse(tokenStr);
        return token?.accessToken || null;
      }
    } catch {
      // JSON parse error - ignore
    }
    return null;
  }
}

// Provider for the interceptor
export const authInterceptorProvider = {
  provide: HTTP_INTERCEPTORS,
  useClass: AuthInterceptor,
  multi: true
};
