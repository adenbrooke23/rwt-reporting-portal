import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { UserProfile } from '../../auth/models/user-management.models';

export interface AdminUserDto {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  company: string;
  roles: string[];
  isActive: boolean;
  isExpired: boolean;
  expiredAt?: string;
  expirationReason?: string;
  isLockedOut: boolean;
  lastLoginAt?: string;
  loginCount: number;
  createdAt: string;
}

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AdminUserListResponse {
  users: AdminUserDto[];
  pagination: PaginationInfo;
}

export interface UserPermissionsResponse {
  userId: number;
  email: string;
  isAdmin: boolean;
  departments: UserDepartmentPermissionDto[];
  permissions: PermissionsDto;
}

export interface UserDepartmentPermissionDto {
  userDepartmentId: number;
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  grantedAt: string;
  grantedBy?: string;
}

export interface PermissionsDto {
  hubs: HubPermissionDto[];
  reportGroups: ReportGroupPermissionDto[];
  reports: ReportPermissionDto[];
}

export interface HubPermissionDto {
  permissionId: number;
  hubId: number;
  hubName: string;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
}

export interface ReportGroupPermissionDto {
  permissionId: number;
  reportGroupId: number;
  groupName: string;
  hubName: string;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
}

export interface ReportPermissionDto {
  permissionId: number;
  reportId: number;
  reportName: string;
  groupName: string;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private http = inject(HttpClient);

  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';
  private readonly ADMIN_USERS_URL = `${this.API_BASE_URL}/admin/users`;

  /**
   * Get all users with pagination and search
   */
  getAllUsers(
    page = 1,
    pageSize = 50,
    search?: string,
    includeInactive = true,
    includeExpired = false
  ): Observable<{ users: UserProfile[]; pagination: PaginationInfo }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString())
      .set('includeInactive', includeInactive.toString())
      .set('includeExpired', includeExpired.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<AdminUserListResponse>(this.ADMIN_USERS_URL, { params }).pipe(
      map(response => ({
        users: response.users.map(u => this.mapToUserProfile(u)),
        pagination: response.pagination
      })),
      catchError(error => {
        console.error('Error fetching users:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user permissions (departments, hubs, reports)
   */
  getUserPermissions(userId: number): Observable<UserPermissionsResponse> {
    return this.http.get<UserPermissionsResponse>(`${this.ADMIN_USERS_URL}/${userId}/permissions`).pipe(
      catchError(error => {
        console.error('Error fetching user permissions:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's department memberships
   */
  getUserDepartments(userId: number): Observable<string[]> {
    return this.http.get<{ userId: number; email: string; departments: UserDepartmentPermissionDto[] }>(
      `${this.ADMIN_USERS_URL}/${userId}/departments`
    ).pipe(
      map(response => response.departments.map(d => d.departmentId.toString())),
      catchError(error => {
        console.error('Error fetching user departments:', error);
        return of([]);
      })
    );
  }

  /**
   * Assign user to department
   */
  assignUserToDepartment(userId: number, departmentId: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.ADMIN_USERS_URL}/${userId}/departments`,
      { departmentId }
    ).pipe(
      catchError(error => {
        console.error('Error assigning department:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Remove user from department
   */
  removeUserFromDepartment(userId: number, departmentId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.ADMIN_USERS_URL}/${userId}/departments/${departmentId}`
    ).pipe(
      catchError(error => {
        console.error('Error removing department:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Unlock user account
   */
  unlockUser(userId: number): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.ADMIN_USERS_URL}/${userId}/unlock`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error unlocking user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Expire user account
   */
  expireUser(userId: number, reason?: string): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.ADMIN_USERS_URL}/${userId}/expire`,
      { reason }
    ).pipe(
      catchError(error => {
        console.error('Error expiring user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Restore expired user account
   */
  restoreUser(userId: number): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.ADMIN_USERS_URL}/${userId}/restore`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error restoring user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Grant hub access to user
   */
  grantHubAccess(userId: number, hubId: number, expiresAt?: Date): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.ADMIN_USERS_URL}/${userId}/permissions/hub`,
      { hubId, expiresAt: expiresAt?.toISOString() }
    ).pipe(
      catchError(error => {
        console.error('Error granting hub access:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Map API DTO to frontend UserProfile model
   */
  private mapToUserProfile(dto: AdminUserDto): UserProfile {
    // Determine account status
    let accountStatus: 'active' | 'locked' | 'expired' = 'active';
    if (dto.isExpired) {
      accountStatus = 'expired';
    } else if (dto.isLockedOut) {
      accountStatus = 'locked';
    } else if (!dto.isActive) {
      accountStatus = 'locked';
    }

    return {
      id: dto.userId.toString(),
      username: dto.email.split('@')[0],
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      displayName: dto.displayName || `${dto.firstName} ${dto.lastName}`.trim(),
      roles: dto.roles || [],
      permissions: [],
      groups: [],
      createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
      accountStatus,
      failedLoginAttempts: 0
    };
  }
}
