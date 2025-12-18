/**
 * Authentication models for .NET integration
 */

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  lastLogin?: Date;
  accountStatus: 'active' | 'locked' | 'expired';
  failedLoginAttempts: number;
}

export interface AuthResponse {
  success: boolean;
  token?: AuthToken;
  user?: User;
  message?: string;
  errors?: string[];
}

export interface SSOProvider {
  name: string;
  displayName: string;
  enabled: boolean;
  authUrl: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: AuthToken | null;
  isLoading: boolean;
  error: string | null;
}
