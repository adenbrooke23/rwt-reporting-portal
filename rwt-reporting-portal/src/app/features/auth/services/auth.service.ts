import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { LoginCredentials, AuthResponse, AuthState, User, AuthToken, SSOProvider } from '../models/auth.models';
import { ThemeService } from '../../../core/services/theme.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';
  private readonly AUTH_API_URL = `${this.API_BASE_URL}/auth`;
  private readonly USERS_API_URL = `${this.API_BASE_URL}/users`;

  private authState = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    error: null
  });

  public authState$ = this.authState.asObservable();

  constructor() {

    if (isPlatformBrowser(this.platformId)) {
      this.checkExistingSession();
    }
  }

  
  private checkExistingSession(): void {
    const token = this.getStoredToken();
    const user = this.getStoredUser();

    if (token && user && !this.isTokenExpired(token)) {
      this.authState.next({
        isAuthenticated: true,
        user,
        token,
        isLoading: false,
        error: null
      });

      this.fetchUserProfile().subscribe({
        next: (profile) => {
          if (profile.avatarId) {
            const updatedUser: User = {
              ...user,
              avatarId: profile.avatarId
            };
            this.storeUser(updatedUser, true);
            this.authState.next({
              ...this.authState.value,
              user: updatedUser
            });
          }
        },
        error: () => {

        }
      });

      this.themeService.loadThemeFromApi();

      if ('businessBranch' in user) {
        this.themeService.setBusinessTheme((user as any).businessBranch);
      }
    } else {
      this.clearSession();
    }
  }

  
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this.setLoading(true);

    return this.http.post<AuthResponse>(`${this.AUTH_API_URL}/login`, credentials).pipe(
      tap(response => {
        if (response.success && response.token && response.user) {
          this.handleSuccessfulAuth(response.token, response.user, credentials.rememberMe);
        }
        this.setLoading(false);
      }),
      catchError(error => {
        this.setError(error.error?.message || 'Login failed. Please try again.');
        this.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  
  loginWithSSO(provider: string): void {

    window.location.href = `${this.AUTH_API_URL}/sso/${provider}`;
  }

  
  handleSSOCallback(token: AuthToken, user: User): void {
    this.handleSuccessfulAuth(token, user, false);
  }

  
  handleSSOTokens(accessToken: string, refreshToken?: string): void {
    const token: AuthToken = {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer'
    };

    const user = this.decodeJwtUser(accessToken);
    this.storeToken(token, true);

    this.authState.next({
      isAuthenticated: true,
      user,
      token,
      isLoading: false,
      error: null
    });

    this.fetchUserProfile().subscribe({
      next: (profile) => {
        const updatedUser: User = {
          ...user,
          avatarId: profile.avatarId
        };
        this.storeUser(updatedUser, true);
        this.authState.next({
          ...this.authState.value,
          user: updatedUser
        });
      },
      error: (err) => {
        console.error('Failed to fetch user profile:', err);

        this.storeUser(user, true);
      }
    });

    this.themeService.loadThemeFromApi();
  }

  
  private fetchUserProfile(): Observable<{ avatarId?: string }> {
    return this.http.get<{ avatarId?: string }>(`${this.USERS_API_URL}/profile`).pipe(
      catchError(() => of({}))
    );
  }

  
  private decodeJwtUser(token: string): User {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      const CLAIMS = {
        nameId: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        givenName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        surname: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
      };

      const firstName = payload[CLAIMS.givenName] || payload.given_name || '';
      const lastName = payload[CLAIMS.surname] || payload.family_name || '';
      const email = payload[CLAIMS.email] || payload.email || payload.preferred_username || '';
      const id = payload[CLAIMS.nameId] || payload.sub || payload.oid || payload.nameid || '';

      const displayName = (firstName && lastName)
        ? `${firstName} ${lastName}`
        : payload.name || email.split('@')[0] || '';

      const rolesClaim = payload[CLAIMS.role] || payload.role;
      const roles = rolesClaim
        ? (Array.isArray(rolesClaim) ? rolesClaim : [rolesClaim])
        : [];

      return {
        id,
        username: email,
        email,
        firstName,
        lastName,
        displayName,
        roles,
        permissions: [],
        accountStatus: 'active',
        failedLoginAttempts: 0
      };
    } catch {

      return {
        id: '',
        username: 'user',
        email: '',
        roles: [],
        permissions: [],
        accountStatus: 'active',
        failedLoginAttempts: 0
      };
    }
  }

  
  logout(): Observable<void> {
    this.clearSession();
    return of(void 0);
  }

  
  refreshToken(): Observable<AuthToken> {
    const currentToken = this.authState.value.token;

    if (!currentToken?.refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<AuthToken>(`${this.AUTH_API_URL}/refresh`, {
      refreshToken: currentToken.refreshToken
    }).pipe(
      tap(newToken => {
        const currentState = this.authState.value;
        if (currentState.user) {
          this.storeToken(newToken);
          this.authState.next({
            ...currentState,
            token: newToken
          });
        }
      }),
      catchError(error => {
        this.clearSession();
        return throwError(() => error);
      })
    );
  }

  
  getSSOProviders(): Observable<SSOProvider[]> {
    return this.http.get<SSOProvider[]>(`${this.AUTH_API_URL}/sso/providers`).pipe(
      catchError(() => of([]))
    );
  }

  
  isAuthenticated(): boolean {
    return this.authState.value.isAuthenticated;
  }

  
  getCurrentUser(): User | null {
    return this.authState.value.user;
  }

  
  updateUserPreferences(updates: Partial<User>): void {
    const currentUser = this.authState.value.user;
    if (!currentUser) return;

    if (updates.avatarId) {
      this.updateAvatarOnServer(updates.avatarId).subscribe({
        next: () => {
          this.updateLocalUserState(updates);
        },
        error: (err) => {
          console.error('Failed to update avatar on server:', err);

          this.updateLocalUserState(updates);
        }
      });
    } else {
      this.updateLocalUserState(updates);
    }
  }

  
  private updateAvatarOnServer(avatarId: string): Observable<{ success: boolean; avatarId: string }> {
    return this.http.put<{ success: boolean; avatarId: string }>(
      `${this.USERS_API_URL}/profile/avatar`,
      { avatarId }
    );
  }

  
  private updateLocalUserState(updates: Partial<User>): void {
    const currentUser = this.authState.value.user;
    if (!currentUser) return;

    const updatedUser: User = {
      ...currentUser,
      ...updates
    };

    this.storeUser(updatedUser, true);

    this.authState.next({
      ...this.authState.value,
      user: updatedUser
    });
  }

  
  getCurrentToken(): AuthToken | null {
    return this.authState.value.token;
  }

  
  private handleSuccessfulAuth(token: AuthToken, user: User, rememberMe?: boolean): void {
    this.storeToken(token, rememberMe);
    this.storeUser(user, rememberMe);

    this.authState.next({
      isAuthenticated: true,
      user,
      token,
      isLoading: false,
      error: null
    });

    if ('businessBranch' in user) {
      this.themeService.setBusinessTheme((user as any).businessBranch);
    }
  }

  
  private clearSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
    }

    this.authState.next({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
      error: null
    });
  }

  
  private storeToken(token: AuthToken, rememberMe = false): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('auth_token', JSON.stringify(token));
  }

  
  private storeUser(user: User, rememberMe = false): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('auth_user', JSON.stringify(user));
  }

  
  private getStoredToken(): AuthToken | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return token ? JSON.parse(token) : null;
  }

  
  private getStoredUser(): User | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const user = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    return user ? JSON.parse(user) : null;
  }

  
  private isTokenExpired(token: AuthToken): boolean {
    if (!token.accessToken) return true;

    try {

      const payload = JSON.parse(atob(token.accessToken.split('.')[1]));

      if (!payload.exp) {
        return false;
      }

      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();

      const bufferMs = 30 * 1000;

      return currentTime >= (expirationTime - bufferMs);
    } catch {

      return true;
    }
  }

  
  getCurrentAuthState(): AuthState {
    return this.authState.value;
  }

  
  private setLoading(isLoading: boolean): void {
    this.authState.next({
      ...this.authState.value,
      isLoading
    });
  }

  
  private setError(error: string): void {
    this.authState.next({
      ...this.authState.value,
      error
    });
  }
}
