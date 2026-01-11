import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { MockUserService } from '../../../auth/services/mock-user.service';
import { AdminUserService } from '../../services/admin-user.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationNotificationService } from '../../../../core/services/confirmation.service';
import { ContentManagementService } from '../../services/content-management.service';
import { UserProfile, SubReport } from '../../../auth/models/user-management.models';
import { Department } from '../../models/content-management.models';

// Local interface for hub-based categories (matching existing template structure)
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
  InputModule
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
    InputModule
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
  private contentService = inject(ContentManagementService);
  private router = inject(Router);
  private iconService = inject(IconService);

  // Search debounce
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
  originalUserDepartments: Set<string> = new Set(); // Track original for diff
  isSaving = false;
  isLoadingDepartments = false;
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
    // Case-insensitive check for admin role
    const hasAdminRole = this.currentUser?.roles?.some(
      role => role.toLowerCase() === 'admin'
    );
    if (!this.currentUser || !hasAdminRole) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Register Carbon icons
    this.iconService.registerAll([Search, Close, ChevronDown, Locked, Unlocked, Time, Renew, ArrowLeft, User]);

    // Set up search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.currentPage = 1;
      this.applyFilters();
    });

    this.loadUsers();
    this.loadReportCategories();
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.contentService.getDepartments(false).subscribe(departments => {
      this.departments = departments;
    });
  }

  loadReportCategories(): void {
    // Load hubs and their reports from ContentManagementService
    this.contentService.getHubs().subscribe(hubs => {
      // For each hub, load its reports (using undefined for groupId, hub.id for hubId)
      const hubObservables = hubs.map(hub =>
        this.contentService.getReports(undefined, hub.id)
      );

      if (hubObservables.length === 0) {
        this.reportCategories = [];
        return;
      }

      forkJoin(hubObservables).subscribe(reportsArrays => {
        this.reportCategories = hubs.map((hub, index) => ({
          id: hub.id,
          name: hub.name,
          description: hub.description,
          reports: reportsArrays[index].map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            type: r.type,
            route: `/hub/${hub.id}/report/${r.id}`,
            embedConfig: r.embedConfig
          }))
        }));
      });
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

    // Apply search filter
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

    // Apply pagination
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
    // Carbon pagination emits just the page number directly
    if (typeof event === 'number' && !isNaN(event)) {
      this.currentPage = event;
    }
    this.applyFilters();
  }

  selectUser(user: UserProfile): void {
    this.selectedUser = user;
    const permissions = this.mockUserService.getUserPermissions(user.id);
    this.userPermissions = new Set(permissions);

    // Fetch departments from real API
    this.isLoadingDepartments = true;
    this.userDepartments = new Set();
    this.originalUserDepartments = new Set();

    this.adminUserService.getUserDepartments(parseInt(user.id, 10)).subscribe({
      next: (departmentIds) => {
        this.userDepartments = new Set(departmentIds);
        this.originalUserDepartments = new Set(departmentIds); // Store original for diff
        this.isLoadingDepartments = false;
      },
      error: (error) => {
        console.error('Error loading user departments:', error);
        this.isLoadingDepartments = false;
        // Still allow editing with empty departments
      }
    });

    // Collapse all categories by default
    this.collapsedCategories = new Set(this.reportCategories.map(cat => cat.id));
  }

  togglePermission(reportId: string): void {
    if (this.userPermissions.has(reportId)) {
      this.userPermissions.delete(reportId);
    } else {
      this.userPermissions.add(reportId);
    }
  }

  toggleDepartment(departmentId: string): void {
    if (this.userDepartments.has(departmentId)) {
      this.userDepartments.delete(departmentId);
    } else {
      this.userDepartments.add(departmentId);
    }
  }

  hasPermission(reportId: string): boolean {
    return this.userPermissions.has(reportId);
  }

  hasDepartment(departmentId: string): boolean {
    return this.userDepartments.has(departmentId);
  }

  toggleCategoryPermissions(category: HubCategory): void {
    const allSelected = category.reports.every(report =>
      this.userPermissions.has(report.id)
    );

    if (allSelected) {
      category.reports.forEach(report => this.userPermissions.delete(report.id));
    } else {
      category.reports.forEach(report => this.userPermissions.add(report.id));
    }
  }

  isCategoryFullySelected(category: HubCategory): boolean {
    return category.reports.every(report => this.userPermissions.has(report.id));
  }

  isCategoryPartiallySelected(category: HubCategory): boolean {
    const selectedCount = category.reports.filter(report =>
      this.userPermissions.has(report.id)
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

    // For now, still use mock for permissions (will be connected later)
    const reportIds = Array.from(this.userPermissions);
    this.mockUserService.updateUserPermissions(this.selectedUser.id, reportIds)
      .subscribe({
        next: () => {
          // Save departments via real API
          this.saveDepartments(userId);
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

  private saveDepartments(userId: number): void {
    // Compute what was added and removed
    const currentDepts = Array.from(this.userDepartments);
    const originalDepts = Array.from(this.originalUserDepartments);

    const toAdd = currentDepts.filter(id => !this.originalUserDepartments.has(id));
    const toRemove = originalDepts.filter(id => !this.userDepartments.has(id));

    // If no changes, we're done
    if (toAdd.length === 0 && toRemove.length === 0) {
      this.isSaving = false;
      this.notificationService.success(
        'Changes Saved',
        'Permissions updated successfully'
      );
      return;
    }

    // Build array of observables for all add/remove operations
    const operations: Observable<{ success: boolean }>[] = [];

    toAdd.forEach(deptId => {
      operations.push(this.adminUserService.assignUserToDepartment(userId, parseInt(deptId, 10)));
    });

    toRemove.forEach(deptId => {
      operations.push(this.adminUserService.removeUserFromDepartment(userId, parseInt(deptId, 10)));
    });

    // Execute all operations
    forkJoin(operations).subscribe({
      next: () => {
        this.isSaving = false;
        // Update original to match current (so subsequent saves work correctly)
        this.originalUserDepartments = new Set(this.userDepartments);
        this.notificationService.success(
          'Changes Saved',
          'Permissions and departments updated successfully'
        );
        this.loadUsers();
      },
      error: (error) => {
        console.error('Error saving departments:', error);
        this.isSaving = false;
        this.notificationService.error(
          'Save Failed',
          'Error updating departments. Please try again.'
        );
      }
    });
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

    // Case-insensitive check for admin role
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
    // Just require that a ticket number is entered (not empty)
    return this.expireFormData.ticketNumber.trim().length > 0;
  }

  confirmExpireUser(): void {
    if (!this.userToExpire || !this.isExpireFormValid) return;

    this.isExpiring = true;
    const userName = `${this.userToExpire.firstName} ${this.userToExpire.lastName}`;
    const userId = this.userToExpire.id;

    // Build the expiration reason with ticket number
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

  /**
   * Helper method for template - case-insensitive admin role check
   */
  isUserAdmin(user: { roles: string[] }): boolean {
    return user.roles?.some(role => role.toLowerCase() === 'admin') || false;
  }
}
