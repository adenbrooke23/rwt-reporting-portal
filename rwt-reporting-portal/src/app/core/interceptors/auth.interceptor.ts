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

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  private readonly API_BASE = 'https://erpqaapi.redwoodtrust.com/api';

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {

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

        if (error.status === 401 && request.url.startsWith(this.API_BASE)) {
          this.handleUnauthorized();
        }
        return throwError(() => error);
      })
    );
  }

  
  private handleUnauthorized(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');

    setTimeout(() => {
      this.router.navigate(['/login'], {
        queryParams: { sessionExpired: 'true' }
      });
    }, 0);
  }

  
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

    }
    return null;
  }
}

export const authInterceptorProvider = {
  provide: HTTP_INTERCEPTORS,
  useClass: AuthInterceptor,
  multi: true
};
