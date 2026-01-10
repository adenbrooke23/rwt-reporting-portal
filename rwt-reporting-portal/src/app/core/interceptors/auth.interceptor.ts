import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);

  // API base URL that requires authentication
  private readonly API_BASE = 'https://erpqaapi.redwoodtrust.com/api';

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only add auth header for requests to our API
    if (request.url.startsWith(this.API_BASE)) {
      const token = this.authService.getCurrentToken();

      if (token?.accessToken) {
        request = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token.accessToken}`
          }
        });
      }
    }

    return next.handle(request);
  }
}

// Provider for the interceptor
export const authInterceptorProvider = {
  provide: HTTP_INTERCEPTORS,
  useClass: AuthInterceptor,
  multi: true
};
