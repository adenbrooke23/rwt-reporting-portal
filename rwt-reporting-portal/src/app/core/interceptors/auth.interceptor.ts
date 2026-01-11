import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Auth Interceptor - Adds JWT token to API requests
 *
 * IMPORTANT: This interceptor reads directly from localStorage to avoid
 * a circular dependency (HttpClient -> Interceptor -> AuthService -> HttpClient).
 * Do NOT inject AuthService here.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private platformId = inject(PLATFORM_ID);

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

    return next.handle(request);
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
