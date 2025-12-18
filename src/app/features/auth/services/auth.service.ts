import { Injectable, inject } from '@angular/core';
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

  // TODO: Replace with actual .NET API endpoint
  private readonly API_URL = '/api/auth';

  private authState = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    error: null
  });

  public authState$ = this.authState.asObservable();

  constructor() {
    // Check for existing session on service initialization
    this.checkExistingSession();
  }

  /**
   * Check for existing authentication session
   */
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

      // Apply business theme if user has a business branch
      if ('businessBranch' in user) {
        this.themeService.setBusinessTheme((user as any).businessBranch);
      }
    } else {
      this.clearSession();
    }
  }

  /**
   * Login with username and password
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this.setLoading(true);

    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
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

  /**
   * Login with SSO provider
   */
  loginWithSSO(provider: string): void {
    // Redirect to .NET SSO endpoint
    window.location.href = `${this.API_URL}/sso/${provider}`;
  }

  /**
   * Handle SSO callback from .NET
   */
  handleSSOCallback(token: AuthToken, user: User): void {
    this.handleSuccessfulAuth(token, user, false);
  }

  /**
   * Logout user
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/logout`, {}).pipe(
      tap(() => this.clearSession()),
      catchError(() => {
        // Clear session even if API call fails
        this.clearSession();
        return of(void 0);
      })
    );
  }

  /**
   * Refresh authentication token
   */
  refreshToken(): Observable<AuthToken> {
    const currentToken = this.authState.value.token;

    if (!currentToken?.refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<AuthToken>(`${this.API_URL}/refresh`, {
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

  /**
   * Get available SSO providers from .NET
   */
  getSSOProviders(): Observable<SSOProvider[]> {
    return this.http.get<SSOProvider[]>(`${this.API_URL}/sso/providers`).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.value.isAuthenticated;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.authState.value.user;
  }

  /**
   * Get current auth token
   */
  getCurrentToken(): AuthToken | null {
    return this.authState.value.token;
  }

  /**
   * Handle successful authentication
   */
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

    // Apply business theme if user has a business branch
    if ('businessBranch' in user) {
      this.themeService.setBusinessTheme((user as any).businessBranch);
    }
  }

  /**
   * Clear authentication session
   */
  private clearSession(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');

    this.authState.next({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
      error: null
    });
  }

  /**
   * Store authentication token
   */
  private storeToken(token: AuthToken, rememberMe = false): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('auth_token', JSON.stringify(token));
  }

  /**
   * Store user data
   */
  private storeUser(user: User, rememberMe = false): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('auth_user', JSON.stringify(user));
  }

  /**
   * Get stored token
   */
  private getStoredToken(): AuthToken | null {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return token ? JSON.parse(token) : null;
  }

  /**
   * Get stored user
   */
  private getStoredUser(): User | null {
    const user = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: AuthToken): boolean {
    if (!token.expiresIn) return false;

    // Token expiration check logic
    // This would need to be implemented based on your token structure
    return false;
  }

  /**
   * Get current authentication state value
   */
  getCurrentAuthState(): AuthState {
    return this.authState.value;
  }

  /**
   * Set loading state
   */
  private setLoading(isLoading: boolean): void {
    this.authState.next({
      ...this.authState.value,
      isLoading
    });
  }

  /**
   * Set error state
   */
  private setError(error: string): void {
    this.authState.next({
      ...this.authState.value,
      error
    });
  }
}
