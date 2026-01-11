import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard - Protects routes that require authentication
 *
 * SSR Note: During Server-Side Rendering, we cannot access localStorage/sessionStorage
 * to check authentication state. The guard returns `true` during SSR to allow the
 * server to render the page. The client-side will handle the actual authentication
 * check after hydration completes and redirect if necessary.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);

  // During SSR, allow the request to pass through.
  // The client-side will handle authentication after hydration.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

/**
 * Admin Guard - Protects routes that require admin role
 *
 * SSR Note: Same as authGuard - during SSR we cannot determine user roles
 * from browser storage. The guard returns `true` during SSR.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);

  // During SSR, allow the request to pass through
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const currentUser = authService.getCurrentUser();

  // Case-insensitive check for admin role
  const hasAdminRole = currentUser?.roles?.some(
    role => role.toLowerCase() === 'admin'
  );

  if (currentUser && hasAdminRole) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
