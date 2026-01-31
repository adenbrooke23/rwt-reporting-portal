import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, filter, take } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { MockUserService } from '../../../auth/services/mock-user.service';
import { AdminUserService } from '../../services/admin-user.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationNotificationService } from '../../../../core/services/confirmation.service';
import { UserProfile, SubReport } from '../../../auth/models/user-management.models';
import { Department } from '../../models/content-management.models';

interface HubCategory {
  id: string;
  name: string;
  description: string;
  reports: SubReport[];
}
import {
  SearchModule,
  ButtonModule,
  CheckboxModule,
  IconModule,
  IconService,
  StructuredListModule,
  PaginationModule,
  TagModule,
  ModalModule,
  InputModule,
  BreadcrumbModule
} from 'carbon-components-angular';
import Search from '@carbon/icons/es/search/20';
import Close from '@carbon/icons/es/close/20';
import ChevronDown from '@carbon/icons/es/chevron--down/20';
import Locked from '@carbon/icons/es/locked/16';
import Unlocked from '@carbon/icons/es/unlocked/16';
import Time from '@carbon/icons/es/time/16';
import Renew from '@carbon/icons/es/renew/16';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import User from '@carbon/icons/es/user/32';

@Component({
  selector: 'app-admin',
  imports: [
    CommonModule,
    FormsModule,
    SearchModule,
    ButtonModule,
    CheckboxModule,
    IconModule,
    StructuredListModule,
    PaginationModule,
    TagModule,
    ModalModule,
    InputModule,
    BreadcrumbModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private mockUserService = inject(MockUserService);
  private adminUserService = inject(AdminUserService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationNotificationService);
  private router = inject(Router);
  private iconService = inject(IconService);
  private platformId = inject(PLATFORM_ID);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  currentUser = this.authService.getCurrentUser();
  users: UserProfile[] = [];
  filteredUsers: UserProfile[] = [];
  reportCategories: HubCategory[] = [];
  departments: Department[] = [];
  selectedUser: UserProfile | null = null;
  userPermissions: Set<string> = new Set();
  userDepartments: Set<string> = new Set();
  originalUserDepartments: Set<string> = new Set();

  userHubPermissions: Set<string> = new Set();
  originalUserHubPermissions: Set<string> = new Set();

  userReportPermissions: Set<string> = new Set();
  originalUserReportPermissions: Set<string> = new Set();
  originalIsAdmin = false;
  pendingIsAdmin = false;
  isSaving = false;
  isLoadingDepartments = false;
  isLoadingPermissions = false;
  isSavingAdminRole = false;
  collapsedCategories: Set<string> = new Set();

  searchQuery = '';
  currentPage = 1;
  pageSize = 10;
  totalUsers = 0;
  pageSizeOptions = [10, 25, 50, 100];

  showExpireModal = false;
  expireFormData = {
    ticketNumber: '',
    reason: ''
  };
  userToExpire: UserProfile | null = null;
  isExpiring = false;

  isLocking = false;
  isUnlocking = false;
  isRestoring = false;

  ngOnInit(): void {

    this.iconService.registerAll([Search, Close, ChevronDown, Locked, Unlocked, Time, Renew, ArrowLeft, User]);

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.currentPage = 1;
      this.applyFilters();
    });

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.authService.authState$.pipe(
      filter(state => state.isAuthenticated),
      take(1),
      takeUntil(this.destroy$)
    ).subscribe(state => {
      this.currentUser = state.user;

      const hasAdminRole = state.user?.roles?.some(
        role => role.toLowerCase() === 'admin'
      );
      if (!state.user || !hasAdminRole) {
        this.router.navigate(['/dashboard']);
        return;
      }

      this.loadUsers();
      this.loadReportCategories();
      this.loadDepartments();
    });
  }

  loadDepartments(): void {
    this.adminUserService.getAllDepartments(false).subscribe({
      next: (apiDepartments) => {

        this.departments = apiDepartments
          .filter(d => d.departmentName.toLowerCase() !== 'admin')
          .map(d => ({
            id: d.departmentId.toString(),
            name: d.departmentName,
            description: d.description || '',
            sortOrder: d.sortOrder,
            isActive: d.isActive,
            createdAt: new Date(d.createdAt),
            updatedAt: new Date(),
            createdBy: d.createdByEmail || ''
          }));
      },
      error: () => {}
    });
  }

  loadReportCategories(): void {
    this.adminUserService.getHubsWithReports(false).subscribe({
      next: (hubsWithReports) => {
        this.reportCategories = hubsWithReports.map(hub => ({
          id: hub.hubId.toString(),
          name: hub.hubName,
          description: hub.description || '',
          reports: hub.reports.map(r => ({
            id: r.reportId.toString(),
            name: r.reportName,
            description: r.description || '',
            type: 'PowerBI' as const,
            route: `/hub/${hub.hubId}/report/${r.reportId}`,
            embedConfig: undefined
          }))
        }));
      },
      error: () => {
        this.reportCategories = [];
      }
    });
  }

  loadUsers(): void {
    this.adminUserService.getAllUsers(1, 1000, '', true, true).subscribe({
      next: (response) => {
        this.users = response.users;
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error loading users from API:', error);
        this.notificationService.error(
          'Load Failed',
          'Failed to load users from database. Please try again.'
        );
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.users];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query)
      );
    }

    this.totalUsers = filtered.length;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.filteredUsers = filtered.slice(startIndex, endIndex);
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  get totalPages(): number {
    return Math.ceil(this.totalUsers / this.pageSize);
  }

  get paginationInfo(): string {
    if (this.totalUsers === 0) return 'No users found';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalUsers);
    return `${start}-${end} of ${this.totalUsers} users`;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.applyFilters();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFilters();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFilters();
    }
  }

  onPaginationChange(event: any): void {

    if (typeof event === 'number' && !isNaN(event)) {
      this.currentPage = event;
    }
    this.applyFilters();
  }

  selectUser(user: UserProfile): void {
    this.selectedUser = user;

    this.originalIsAdmin = this.isUserAdmin(user);
    this.pendingIsAdmin = this.originalIsAdmin;

    this.userDepartments = new Set();
    this.originalUserDepartments = new Set();
    this.userHubPermissions = new Set();
    this.originalUserHubPermissions = new Set();
    this.userReportPermissions = new Set();
    this.originalUserReportPermissions = new Set();

    this.isLoadingDepartments = true;
    this.isLoadingPermissions = true;

    const userId = parseInt(user.id, 10);

    this.adminUserService.getUserDepartments(userId).subscribe({
      next: (departmentIds) => {
        this.userDepartments = new Set(departmentIds);
        this.originalUserDepartments = new Set(departmentIds);
        this.isLoadingDepartments = false;
        this.updateUserDepartmentCount(user.id, departmentIds.length);
      },
      error: () => {
        this.isLoadingDepartments = false;
      }
    });

    this.adminUserService.getUserPermissions(userId).subscribe({
      next: (response) => {
        const hubIds = response.permissions.hubs.map(h => h.hubId.toString());
        this.userHubPermissions = new Set(hubIds);
        this.originalUserHubPermissions = new Set(hubIds);

        const reportIds = response.permissions.reports.map(r => r.reportId.toString());
        this.userReportPermissions = new Set(reportIds);
        this.originalUserReportPermissions = new Set(reportIds);

        this.isLoadingPermissions = false;
      },
      error: () => {
        this.isLoadingPermissions = false;
      }
    });

    this.collapsedCategories = new Set(this.reportCategories.map(cat => cat.id));
  }

  
  private updateUserDepartmentCount(userId: string, count: number): void {

    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {

      this.users[userIndex] = {
        ...this.users[userIndex],
        groups: Array(count).fill('dept')
      };

      if (this.selectedUser?.id === userId) {
        this.selectedUser = this.users[userIndex];
      }

      this.applyFilters();
    }
  }

  togglePermission(reportId: string): void {

    if (this.userReportPermissions.has(reportId)) {
      this.userReportPermissions.delete(reportId);
    } else {
      this.userReportPermissions.add(reportId);
    }
  }

  toggleHubPermission(hubId: string): void {

    if (this.userHubPermissions.has(hubId)) {
      this.userHubPermissions.delete(hubId);
    } else {
      this.userHubPermissions.add(hubId);
    }
  }

  toggleDepartment(departmentId: string): void {
    if (this.userDepartments.has(departmentId)) {
      this.userDepartments.delete(departmentId);
    } else {
      this.userDepartments.add(departmentId);
    }
  }

  async toggleAdminRole(): Promise<void> {
    if (!this.selectedUser) return;

    if (this.selectedUser.id === this.currentUser?.id) {
      this.notificationService.warning(
        'Action Not Allowed',
        'You cannot modify your own administrator status.'
      );
      return;
    }

    const newAdminStatus = !this.isUserAdmin(this.selectedUser);
    const userName = `${this.selectedUser.firstName} ${this.selectedUser.lastName}`;

    const action = newAdminStatus ? 'grant' : 'revoke';
    const confirmed = await this.confirmationService.confirm(
      newAdminStatus ? 'info' : 'warning',
      `${newAdminStatus ? 'Grant' : 'Revoke'} Administrator Access`,
      `Are you sure you want to ${action} administrator privileges for ${userName}? ${
        newAdminStatus
          ? 'They will have full access to manage users, content, and system settings.'
          : 'They will lose access to administrative functions.'
      }`,
      `${newAdminStatus ? 'Grant' : 'Revoke'} Admin`
    );

    if (!confirmed) return;

    this.isSavingAdminRole = true;
    const userId = parseInt(this.selectedUser.id, 10);

    this.adminUserService.updateUserAdminRole(userId, newAdminStatus).subscribe({
      next: () => {
        this.isSavingAdminRole = false;

        if (this.selectedUser) {
          if (newAdminStatus) {

            if (!this.selectedUser.roles.some(r => r.toLowerCase() === 'admin')) {
              this.selectedUser.roles = [...this.selectedUser.roles, 'Admin'];
            }
          } else {

            this.selectedUser.roles = this.selectedUser.roles.filter(
              r => r.toLowerCase() !== 'admin'
            );
          }
          this.originalIsAdmin = newAdminStatus;
          this.pendingIsAdmin = newAdminStatus;
        }

        this.notificationService.success(
          'Administrator Access Updated',
          `${userName} has been ${newAdminStatus ? 'granted' : 'revoked'} administrator access.`
        );

        this.loadUsers();
      },
      error: () => {
        this.isSavingAdminRole = false;
        this.notificationService.error(
          'Update Failed',
          'Failed to update administrator access. Please try again.'
        );
      }
    });
  }

  hasPermission(reportId: string): boolean {

    return this.userReportPermissions.has(reportId);
  }

  hasHubPermission(hubId: string): boolean {

    return this.userHubPermissions.has(hubId);
  }

  hasDepartment(departmentId: string): boolean {
    return this.userDepartments.has(departmentId);
  }

  toggleCategoryPermissions(category: HubCategory): void {

    if (this.userHubPermissions.has(category.id)) {
      this.userHubPermissions.delete(category.id);
    } else {
      this.userHubPermissions.add(category.id);

      category.reports.forEach(report => {
        this.userReportPermissions.delete(report.id);
      });
    }
  }

  isCategoryFullySelected(category: HubCategory): boolean {

    return this.userHubPermissions.has(category.id);
  }

  isCategoryPartiallySelected(category: HubCategory): boolean {

    if (this.userHubPermissions.has(category.id)) {
      return false;
    }
    const selectedCount = category.reports.filter(report =>
      this.userReportPermissions.has(report.id)
    ).length;
    return selectedCount > 0 && selectedCount < category.reports.length;
  }

  toggleCategoryCollapse(categoryId: string): void {
    if (this.collapsedCategories.has(categoryId)) {
      this.collapsedCategories.delete(categoryId);
    } else {
      this.collapsedCategories.add(categoryId);
    }
  }

  isCategoryCollapsed(categoryId: string): boolean {
    return this.collapsedCategories.has(categoryId);
  }

  savePermissions(): void {
    if (!this.selectedUser) return;

    this.isSaving = true;
    const userId = parseInt(this.selectedUser.id, 10);

    const operations: Observable<{ success: boolean }>[] = [];

    const currentDepts = Array.from(this.userDepartments);
    const originalDepts = Array.from(this.originalUserDepartments);
    const deptsToAdd = currentDepts.filter(id => !this.originalUserDepartments.has(id));
    const deptsToRemove = originalDepts.filter(id => !this.userDepartments.has(id));

    const currentHubs = Array.from(this.userHubPermissions);
    const originalHubs = Array.from(this.originalUserHubPermissions);
    const hubsToAdd = currentHubs.filter(id => !this.originalUserHubPermissions.has(id));
    const hubsToRemove = originalHubs.filter(id => !this.userHubPermissions.has(id));

    const currentReports = Array.from(this.userReportPermissions);
    const originalReports = Array.from(this.originalUserReportPermissions);
    const reportsToAdd = currentReports.filter(id => !this.originalUserReportPermissions.has(id));
    const reportsToRemove = originalReports.filter(id => !this.userReportPermissions.has(id));

    if (deptsToAdd.length === 0 && deptsToRemove.length === 0 &&
        hubsToAdd.length === 0 && hubsToRemove.length === 0 &&
        reportsToAdd.length === 0 && reportsToRemove.length === 0) {
      this.isSaving = false;
      this.notificationService.info('No Changes', 'No permission changes to save.');
      return;
    }

    deptsToAdd.forEach(deptId => {
      operations.push(this.adminUserService.assignUserToDepartment(userId, parseInt(deptId, 10)));
    });
    deptsToRemove.forEach(deptId => {
      operations.push(this.adminUserService.removeUserFromDepartment(userId, parseInt(deptId, 10)));
    });

    hubsToAdd.forEach(hubId => {
      operations.push(this.adminUserService.grantHubAccess(userId, parseInt(hubId, 10)));
    });
    hubsToRemove.forEach(hubId => {
      operations.push(this.adminUserService.revokeHubAccess(userId, parseInt(hubId, 10)));
    });

    reportsToAdd.forEach(reportId => {
      operations.push(this.adminUserService.grantReportAccess(userId, parseInt(reportId, 10)));
    });
    reportsToRemove.forEach(reportId => {
      operations.push(this.adminUserService.revokeReportAccess(userId, parseInt(reportId, 10)));
    });

    forkJoin(operations).subscribe({
      next: () => {
        this.isSaving = false;

        this.originalUserDepartments = new Set(this.userDepartments);
        this.originalUserHubPermissions = new Set(this.userHubPermissions);
        this.originalUserReportPermissions = new Set(this.userReportPermissions);

        if (this.selectedUser) {
          this.updateUserDepartmentCount(this.selectedUser.id, this.userDepartments.size);
          this.updateUserReportCount(this.selectedUser.id, this.userHubPermissions.size, this.userReportPermissions.size);
        }

        this.notificationService.success(
          'Changes Saved',
          'Permissions updated successfully'
        );
      },
      error: () => {
        this.isSaving = false;
        this.notificationService.error(
          'Save Failed',
          'Error updating permissions. Please try again.'
        );
      }
    });
  }

  
  private updateUserReportCount(userId: string, hubCount: number, reportCount: number): void {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {

      const totalPermissions = hubCount + reportCount;
      this.users[userIndex] = {
        ...this.users[userIndex],
        permissions: Array(totalPermissions).fill('permission')
      };
      if (this.selectedUser?.id === userId) {
        this.selectedUser = this.users[userIndex];
      }
      this.applyFilters();
    }
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  async lockUser(userId: string): Promise<void> {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const userName = `${user.firstName} ${user.lastName}`;
    const confirmed = await this.confirmationService.warning(
      'Lock User Account',
      `Are you sure you want to lock ${userName}'s account? They will not be able to log in until the account is unlocked.`,
      'Lock Account'
    );

    if (confirmed) {
      this.isLocking = true;
      this.adminUserService.lockUser(parseInt(user.id, 10)).subscribe({
        next: () => {
          this.isLocking = false;
          this.notificationService.success(
            'User Locked',
            `${userName} account has been locked successfully`
          );
          this.loadUsers();
          this.selectedUser = null;
        },
        error: () => {
          this.isLocking = false;
          this.notificationService.error(
            'Lock Failed',
            'Failed to lock user account. Please try again.'
          );
        }
      });
    }
  }

  async unlockUser(userId: string): Promise<void> {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const userName = `${user.firstName} ${user.lastName}`;
    const confirmed = await this.confirmationService.confirm(
      'info',
      'Unlock User Account',
      `Are you sure you want to unlock ${userName}'s account? They will be able to log in again.`,
      'Unlock Account'
    );

    if (confirmed) {
      this.isUnlocking = true;
      this.adminUserService.unlockUser(parseInt(user.id, 10)).subscribe({
        next: () => {
          this.isUnlocking = false;
          this.notificationService.success(
            'User Unlocked',
            `${userName} account has been unlocked successfully`
          );
          this.loadUsers();
          this.selectedUser = null;
        },
        error: () => {
          this.isUnlocking = false;
          this.notificationService.error(
            'Unlock Failed',
            'Failed to unlock user account. Please try again.'
          );
        }
      });
    }
  }

  openExpireModal(userId: string): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const userIsAdmin = user.roles.some(role => role.toLowerCase() === 'admin');
    if (userIsAdmin && user.id === this.currentUser?.id) {
      this.notificationService.warning(
        'Action Not Allowed',
        'You cannot expire your own admin account.'
      );
      return;
    }

    this.userToExpire = user;
    this.expireFormData = {
      ticketNumber: '',
      reason: ''
    };
    this.showExpireModal = true;
  }

  closeExpireModal(): void {
    this.showExpireModal = false;
    this.userToExpire = null;
    this.expireFormData = {
      ticketNumber: '',
      reason: ''
    };
  }

  get isExpireFormValid(): boolean {

    return this.expireFormData.ticketNumber.trim().length > 0;
  }

  confirmExpireUser(): void {
    if (!this.userToExpire || !this.isExpireFormValid) return;

    this.isExpiring = true;
    const userName = `${this.userToExpire.firstName} ${this.userToExpire.lastName}`;
    const userId = this.userToExpire.id;

    const expirationReason = `Ticket: ${this.expireFormData.ticketNumber.trim().toUpperCase()}${this.expireFormData.reason.trim() ? ' - ' + this.expireFormData.reason.trim() : ''}`;

    this.adminUserService.expireUser(parseInt(userId, 10), expirationReason).subscribe({
      next: () => {
        this.isExpiring = false;
        this.notificationService.success(
          'User Account Expired',
          `${userName}'s account has been expired. Reference: ${this.expireFormData.ticketNumber.trim().toUpperCase()}`
        );
        this.closeExpireModal();
        this.loadUsers();
        if (this.selectedUser && this.selectedUser.id === userId) {
          this.selectedUser = null;
        }
      },
      error: () => {
        this.isExpiring = false;
        this.notificationService.error(
          'Expire Failed',
          'Failed to expire user account. Please try again.'
        );
      }
    });
  }

  async restoreUser(userId: string): Promise<void> {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const userName = `${user.firstName} ${user.lastName}`;
    const confirmed = await this.confirmationService.confirm(
      'info',
      'Restore User Account',
      `Are you sure you want to restore ${userName}'s account? They will be able to log in again.`,
      'Restore Account'
    );

    if (confirmed) {
      this.isRestoring = true;
      this.adminUserService.restoreUser(parseInt(userId, 10)).subscribe({
        next: () => {
          this.isRestoring = false;
          this.notificationService.success(
            'User Restored',
            `${userName}'s account has been restored successfully`
          );
          this.loadUsers();
          if (this.selectedUser && this.selectedUser.id === userId) {
            this.selectedUser = null;
          }
        },
        error: () => {
          this.isRestoring = false;
          this.notificationService.error(
            'Restore Failed',
            'Failed to restore user account. Please try again.'
          );
        }
      });
    }
  }

  
  isUserAdmin(user: { roles: string[] }): boolean {
    return user.roles?.some(role => role.toLowerCase() === 'admin') || false;
  }
}
