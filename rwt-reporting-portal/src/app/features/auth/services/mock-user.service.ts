import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AuthToken, AuthResponse } from '../models/auth.models';
import { UserProfile, REPORT_CATEGORIES, SubReport, getAllReports } from '../models/user-management.models';

interface MockUser {
  email: string;
  password: string;
  user: UserProfile;
  permissions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MockUserService {
  private mockUsers: MockUser[] = [
    {
      email: 'Zachary.Schmidt@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-001',
        username: 'Zachary.Schmidt',
        email: 'Zachary.Schmidt@redwoodtrust.com',
        firstName: 'Zachary',
        lastName: 'Schmidt',
        displayName: 'Zachary Schmidt',
        roles: ['admin', 'user'],
        permissions: getAllReports().map(r => r.id),
        createdAt: new Date('2025-01-01'),
        groups: ['admin'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'sequoia',
        avatarId: 'mountain-peaks'
      },
      permissions: getAllReports().map(r => r.id)
    },
    {
      email: 'testuser1@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-002',
        username: 'testuser1',
        email: 'testuser1@redwoodtrust.com',
        firstName: 'Test',
        lastName: 'User',
        displayName: 'Test User',
        roles: ['user'],
        permissions: ['sequoia-monthly-summary'],
        createdAt: new Date('2025-01-01'),
        groups: ['finance'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'enterprise',
        avatarId: 'forest'
      },
      permissions: ['sequoia-monthly-summary']
    },
    {
      email: 'testuser1@corevest.com',
      password: '12345678',
      user: {
        id: 'user-003',
        username: 'testuser1.corevest',
        email: 'testuser1@corevest.com',
        firstName: 'CoreVest',
        lastName: 'User',
        displayName: 'CoreVest User',
        roles: ['user'],
        permissions: ['corevest-portfolio-overview', 'corevest-asset-analysis'],
        createdAt: new Date('2025-01-01'),
        groups: ['finance'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'corevest',
        avatarId: 'lake'
      },
      permissions: ['corevest-portfolio-overview', 'corevest-asset-analysis']
    },
    {
      email: 'john.smith@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-004',
        username: 'john.smith',
        email: 'john.smith@redwoodtrust.com',
        firstName: 'John',
        lastName: 'Smith',
        displayName: 'John Smith',
        roles: ['user'],
        permissions: ['sequoia-monthly-summary', 'sequoia-portfolio-analysis'],
        createdAt: new Date('2025-01-02'),
        groups: ['finance', 'reporting'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'sequoia',
        avatarId: 'desert'
      },
      permissions: ['sequoia-monthly-summary', 'sequoia-portfolio-analysis']
    },
    {
      email: 'jane.doe@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-005',
        username: 'jane.doe',
        email: 'jane.doe@redwoodtrust.com',
        firstName: 'Jane',
        lastName: 'Doe',
        displayName: 'Jane Doe',
        roles: ['user'],
        permissions: ['enterprise-financial-dashboard'],
        createdAt: new Date('2025-01-03'),
        groups: ['finance'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'enterprise',
        avatarId: 'ocean'
      },
      permissions: ['enterprise-financial-dashboard']
    },
    {
      email: 'michael.johnson@corevest.com',
      password: '12345678',
      user: {
        id: 'user-006',
        username: 'michael.johnson',
        email: 'michael.johnson@corevest.com',
        firstName: 'Michael',
        lastName: 'Johnson',
        displayName: 'Michael Johnson',
        roles: ['user'],
        permissions: ['corevest-portfolio-overview'],
        createdAt: new Date('2025-01-04'),
        groups: ['operations'],
        accountStatus: 'locked',
        failedLoginAttempts: 5,
        businessBranch: 'corevest',
        avatarId: 'city'
      },
      permissions: ['corevest-portfolio-overview']
    },
    {
      email: 'sarah.williams@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-007',
        username: 'sarah.williams',
        email: 'sarah.williams@redwoodtrust.com',
        firstName: 'Sarah',
        lastName: 'Williams',
        displayName: 'Sarah Williams',
        roles: ['user'],
        permissions: ['sequoia-monthly-summary', 'sequoia-risk-metrics'],
        createdAt: new Date('2025-01-05'),
        groups: ['risk-management'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'sequoia',
        avatarId: 'mountains'
      },
      permissions: ['sequoia-monthly-summary', 'sequoia-risk-metrics']
    },
    {
      email: 'robert.brown@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-008',
        username: 'robert.brown',
        email: 'robert.brown@redwoodtrust.com',
        firstName: 'Robert',
        lastName: 'Brown',
        displayName: 'Robert Brown',
        roles: ['user'],
        permissions: ['enterprise-financial-dashboard', 'enterprise-performance-metrics'],
        createdAt: new Date('2025-01-06'),
        groups: ['finance', 'reporting'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'enterprise',
        avatarId: 'river'
      },
      permissions: ['enterprise-financial-dashboard', 'enterprise-performance-metrics']
    },
    {
      email: 'emily.davis@corevest.com',
      password: '12345678',
      user: {
        id: 'user-009',
        username: 'emily.davis',
        email: 'emily.davis@corevest.com',
        firstName: 'Emily',
        lastName: 'Davis',
        displayName: 'Emily Davis',
        roles: ['user'],
        permissions: ['corevest-portfolio-overview', 'corevest-asset-analysis', 'corevest-risk-assessment'],
        createdAt: new Date('2025-01-07'),
        groups: ['finance', 'risk-management'],
        accountStatus: 'active',
        failedLoginAttempts: 2,
        businessBranch: 'corevest',
        avatarId: 'sunset'
      },
      permissions: ['corevest-portfolio-overview', 'corevest-asset-analysis', 'corevest-risk-assessment']
    },
    {
      email: 'david.wilson@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-010',
        username: 'david.wilson',
        email: 'david.wilson@redwoodtrust.com',
        firstName: 'David',
        lastName: 'Wilson',
        displayName: 'David Wilson',
        roles: ['user'],
        permissions: ['sequoia-monthly-summary'],
        createdAt: new Date('2025-01-08'),
        groups: ['operations'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'sequoia',
        avatarId: 'valley'
      },
      permissions: ['sequoia-monthly-summary']
    },
    {
      email: 'lisa.martinez@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-011',
        username: 'lisa.martinez',
        email: 'lisa.martinez@redwoodtrust.com',
        firstName: 'Lisa',
        lastName: 'Martinez',
        displayName: 'Lisa Martinez',
        roles: ['user'],
        permissions: ['enterprise-financial-dashboard', 'enterprise-performance-metrics', 'enterprise-compliance-report'],
        createdAt: new Date('2025-01-09'),
        groups: ['compliance', 'reporting'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'enterprise',
        avatarId: 'meadow'
      },
      permissions: ['enterprise-financial-dashboard', 'enterprise-performance-metrics', 'enterprise-compliance-report']
    },
    {
      email: 'james.anderson@corevest.com',
      password: '12345678',
      user: {
        id: 'user-012',
        username: 'james.anderson',
        email: 'james.anderson@corevest.com',
        firstName: 'James',
        lastName: 'Anderson',
        displayName: 'James Anderson',
        roles: ['user'],
        permissions: ['corevest-asset-analysis'],
        createdAt: new Date('2025-01-10'),
        groups: ['operations'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'corevest',
        avatarId: 'coast'
      },
      permissions: ['corevest-asset-analysis']
    },
    {
      email: 'patricia.taylor@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-013',
        username: 'patricia.taylor',
        email: 'patricia.taylor@redwoodtrust.com',
        firstName: 'Patricia',
        lastName: 'Taylor',
        displayName: 'Patricia Taylor',
        roles: ['user'],
        permissions: ['sequoia-monthly-summary', 'sequoia-portfolio-analysis', 'sequoia-risk-metrics'],
        createdAt: new Date('2025-01-11'),
        groups: ['finance', 'risk-management', 'reporting'],
        accountStatus: 'active',
        failedLoginAttempts: 0,
        businessBranch: 'sequoia',
        avatarId: 'canyon'
      },
      permissions: ['sequoia-monthly-summary', 'sequoia-portfolio-analysis', 'sequoia-risk-metrics']
    },
    {
      email: 'christopher.thomas@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-014',
        username: 'christopher.thomas',
        email: 'christopher.thomas@redwoodtrust.com',
        firstName: 'Christopher',
        lastName: 'Thomas',
        displayName: 'Christopher Thomas',
        roles: ['user'],
        permissions: ['enterprise-performance-metrics'],
        createdAt: new Date('2025-01-12'),
        groups: ['reporting'],
        accountStatus: 'active',
        failedLoginAttempts: 1,
        businessBranch: 'enterprise',
        avatarId: 'aurora'
      },
      permissions: ['enterprise-performance-metrics']
    },
    {
      email: 'nancy.jackson@corevest.com',
      password: '12345678',
      user: {
        id: 'user-015',
        username: 'nancy.jackson',
        email: 'nancy.jackson@corevest.com',
        firstName: 'Nancy',
        lastName: 'Jackson',
        displayName: 'Nancy Jackson',
        roles: ['user'],
        permissions: ['corevest-portfolio-overview', 'corevest-risk-assessment'],
        createdAt: new Date('2025-01-13'),
        groups: ['risk-management'],
        accountStatus: 'expired',
        failedLoginAttempts: 0,
        businessBranch: 'corevest',
        avatarId: 'storm'
      },
      permissions: ['corevest-portfolio-overview', 'corevest-risk-assessment']
    },
    {
      email: 'former.employee@redwoodtrust.com',
      password: '12345678',
      user: {
        id: 'user-016',
        username: 'former.employee',
        email: 'former.employee@redwoodtrust.com',
        firstName: 'Former',
        lastName: 'Employee',
        displayName: 'Former Employee',
        roles: ['user'],
        permissions: ['sequoia-monthly-summary'],
        createdAt: new Date('2024-06-01'),
        groups: ['finance'],
        accountStatus: 'expired',
        failedLoginAttempts: 0,
        businessBranch: 'sequoia',
        avatarId: 'desert'
      },
      permissions: ['sequoia-monthly-summary']
    }
  ];

  private userPermissionsSubject = new BehaviorSubject<Map<string, string[]>>(
    new Map([
      ['user-001', getAllReports().map(r => r.id)],
      ['user-002', ['sequoia-monthly-summary']],
      ['user-003', ['corevest-portfolio-overview', 'corevest-asset-analysis']],
      ['user-004', ['sequoia-monthly-summary', 'sequoia-portfolio-analysis']],
      ['user-005', ['enterprise-financial-dashboard']],
      ['user-006', ['corevest-portfolio-overview']],
      ['user-007', ['sequoia-monthly-summary', 'sequoia-risk-metrics']],
      ['user-008', ['enterprise-financial-dashboard', 'enterprise-performance-metrics']],
      ['user-009', ['corevest-portfolio-overview', 'corevest-asset-analysis', 'corevest-risk-assessment']],
      ['user-010', ['sequoia-monthly-summary']],
      ['user-011', ['enterprise-financial-dashboard', 'enterprise-performance-metrics', 'enterprise-compliance-report']],
      ['user-012', ['corevest-asset-analysis']],
      ['user-013', ['sequoia-monthly-summary', 'sequoia-portfolio-analysis', 'sequoia-risk-metrics']],
      ['user-014', ['enterprise-performance-metrics']],
      ['user-015', ['corevest-portfolio-overview', 'corevest-risk-assessment']]
    ])
  );

  private userGroupsSubject = new BehaviorSubject<Map<string, string[]>>(
    new Map([
      ['user-001', ['admin']],
      ['user-002', ['finance']],
      ['user-003', ['finance']],
      ['user-004', ['finance', 'reporting']],
      ['user-005', ['finance']],
      ['user-006', ['operations']],
      ['user-007', ['risk-management']],
      ['user-008', ['finance', 'reporting']],
      ['user-009', ['finance', 'risk-management']],
      ['user-010', ['operations']],
      ['user-011', ['compliance', 'reporting']],
      ['user-012', ['operations']],
      ['user-013', ['finance', 'risk-management', 'reporting']],
      ['user-014', ['reporting']],
      ['user-015', ['risk-management']]
    ])
  );

  public userPermissions$ = this.userPermissionsSubject.asObservable();
  public userGroups$ = this.userGroupsSubject.asObservable();

  private findMockUser(username: string, password: string): MockUser | undefined {
    return this.mockUsers.find(
      u => u.email.toLowerCase() === username.toLowerCase() && u.password === password
    );
  }

  login(username: string, password: string): Observable<AuthResponse> {
    const userByEmail = this.mockUsers.find(u => u.email.toLowerCase() === username.toLowerCase());

    if (!userByEmail) {
      return throwError(() => ({
        error: { message: 'Invalid username or password' }
      })).pipe(delay(500));
    }

    if (userByEmail.user.accountStatus === 'locked') {
      return throwError(() => ({
        error: { message: 'Account is locked. Please contact your administrator.' }
      })).pipe(delay(500));
    }

    if (userByEmail.password !== password) {
      userByEmail.user.failedLoginAttempts++;

      if (userByEmail.user.failedLoginAttempts >= 5) {
        userByEmail.user.accountStatus = 'locked';
        return throwError(() => ({
          error: { message: 'Account locked due to too many failed login attempts. Please contact your administrator.' }
        })).pipe(delay(500));
      }

      const attemptsLeft = 5 - userByEmail.user.failedLoginAttempts;
      return throwError(() => ({
        error: { message: `Invalid username or password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.` }
      })).pipe(delay(500));
    }

    userByEmail.user.failedLoginAttempts = 0;

    const token: AuthToken = {
      accessToken: 'mock-token-' + Date.now(),
      expiresIn: 3600,
      tokenType: 'Bearer'
    };

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        ...userByEmail.user,
        lastLogin: new Date()
      }
    };

    return of(response).pipe(delay(500));
  }

  getAllUsers(): Observable<UserProfile[]> {
    return of(this.mockUsers.map(u => ({
      ...u.user,
      permissions: this.getUserPermissions(u.user.id),
      groups: this.getUserGroups(u.user.id)
    }))).pipe(delay(300));
  }

  getUserPermissions(userId: string): string[] {
    const permissions = this.userPermissionsSubject.value.get(userId);
    return permissions || [];
  }

  getUserGroups(userId: string): string[] {
    const groups = this.userGroupsSubject.value.get(userId);
    return groups || [];
  }

  updateUserPermissions(userId: string, reportIds: string[]): Observable<boolean> {
    const currentPermissions = this.userPermissionsSubject.value;
    currentPermissions.set(userId, reportIds);
    this.userPermissionsSubject.next(new Map(currentPermissions));

    const mockUser = this.mockUsers.find(u => u.user.id === userId);
    if (mockUser) {
      mockUser.permissions = reportIds;
      mockUser.user.permissions = reportIds;
    }

    return of(true).pipe(delay(300));
  }

  updateUserGroups(userId: string, groupIds: string[]): Observable<boolean> {
    const currentGroups = this.userGroupsSubject.value;
    currentGroups.set(userId, groupIds);
    this.userGroupsSubject.next(new Map(currentGroups));

    const mockUser = this.mockUsers.find(u => u.user.id === userId);
    if (mockUser) {
      mockUser.user.groups = groupIds;
    }

    return of(true).pipe(delay(300));
  }

  getReportCategories() {
    return REPORT_CATEGORIES;
  }

  getUserReports(userId: string): SubReport[] {
    const userPermissions = this.getUserPermissions(userId);
    return getAllReports().filter(report =>
      userPermissions.includes(report.id)
    );
  }

  getUserReportsByCategory(userId: string) {
    const userPermissions = this.getUserPermissions(userId);
    return REPORT_CATEGORIES.map(category => ({
      ...category,
      reports: category.reports.filter(report =>
        userPermissions.includes(report.id)
      )
    })).filter(category => category.reports.length > 0);
  }

  lockUser(userId: string): Observable<boolean> {
    const mockUser = this.mockUsers.find(u => u.user.id === userId);
    if (mockUser) {
      mockUser.user.accountStatus = 'locked';
    }
    return of(true).pipe(delay(300));
  }

  unlockUser(userId: string): Observable<boolean> {
    const mockUser = this.mockUsers.find(u => u.user.id === userId);
    if (mockUser) {
      mockUser.user.accountStatus = 'active';
      mockUser.user.failedLoginAttempts = 0;
    }
    return of(true).pipe(delay(300));
  }

  deleteUser(userId: string): Observable<boolean> {

    return this.expireUser(userId);
  }

  expireUser(userId: string, reason?: string): Observable<boolean> {
    const mockUser = this.mockUsers.find(u => u.user.id === userId);
    if (mockUser) {
      mockUser.user.accountStatus = 'expired';
      (mockUser.user as any).expiredAt = new Date();
      (mockUser.user as any).expirationReason = reason || '';
    }
    return of(true).pipe(delay(300));
  }

  restoreUser(userId: string): Observable<boolean> {
    const mockUser = this.mockUsers.find(u => u.user.id === userId);
    if (mockUser) {
      mockUser.user.accountStatus = 'active';
      delete (mockUser.user as any).expiredAt;
      delete (mockUser.user as any).expirationReason;
    }
    return of(true).pipe(delay(300));
  }

  updateUserAvatar(userId: string, avatarId: string): Observable<boolean> {
    const mockUser = this.mockUsers.find(u => u.user.id === userId);
    if (mockUser) {
      mockUser.user.avatarId = avatarId;
    }
    return of(true).pipe(delay(300));
  }
}
