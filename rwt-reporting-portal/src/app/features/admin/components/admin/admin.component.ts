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
  private router = inject(Router);
  private iconService = inject(IconService);
  private platformId = inject(PLATFORM_ID);

  // Search debounce
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  currentUser = this.authService.getCurrentUser(); // Will be updated via subscription on init
  users: UserProfile[] = [];
  filteredUsers: UserProfile[] = [];
  reportCategories: HubCategory[] = [];
  departments: Department[] = [];
  selectedUser: UserProfile | null = null;
  userPermissions: Set<string> = new Set(); // Legacy - still used for mock data
  userDepartments: Set<string> = new Set();
  originalUserDepartments: Set<string> = new Set(); // Track original for diff
  // Hub permissions (ad-hoc hub access)
  userHubPermissions: Set<string> = new Set();
  originalUserHubPermissions: Set<string> = new Set();
  // Report permissions (ad-hoc report access)
  userReportPermissions: Set<string> = new Set();
  originalUserReportPermissions: Set<string> = new Set();
  originalIsAdmin = false; // Track original admin status
  pendingIsAdmin = false; // Track pending admin status change
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
    // Register Carbon icons first (safe for SSR)
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

    // Skip API calls during SSR - they will run on client after hydration
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Wait for auth state to be ready before loading data
    // This ensures the JWT token is available for API calls
    this.authService.authState$.pipe(
      filter(state => state.isAuthenticated),
      take(1),
      takeUntil(this.destroy$)
    ).subscribe(state => {
      this.currentUser = state.user;

      // Case-insensitive check for admin role
      const hasAdminRole = state.user?.roles?.some(
        role => role.toLowerCase() === 'admin'
      );
      if (!state.user || !hasAdminRole) {
        this.router.navigate(['/dashboard']);
        return;
      }

      // Now load data - auth token is guaranteed to be available
      this.loadUsers();
      this.loadReportCategories();
      this.loadDepartments();
    });
  }

  loadDepartments(): void {
    // Load departments from real API
    console.log('[DEBUG] Loading departments from API...');
    this.adminUserService.getAllDepartments(false).subscribe({
      next: (apiDepartments) => {
        console.log('[DEBUG] Departments loaded:', apiDepartments);
        // Map API response to existing Department interface format
        // Filter out "Admin" department since we now have a dedicated Administrator Access section
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
        console.log('[DEBUG] Mapped departments (Admin filtered):', this.departments);
      },
      error: (err) => {
        console.error('[DEBUG] Error loading departments:', err);
      }
    });
  }

  loadReportCategories(): void {
    // Load hubs with their reports from real API
    console.log('[DEBUG] Loading hubs with reports from API...');
    this.adminUserService.getHubsWithReports(false).subscribe({
      next: (hubsWithReports) => {
        console.log('[DEBUG] Hubs with reports loaded:', hubsWithReports);
        this.reportCategories = hubsWithReports.map(hub => ({
          id: hub.hubId.toString(), // Convert numeric ID to string for consistency
          name: hub.hubName,
          description: hub.description || '',
          reports: hub.reports.map(r => ({
            id: r.reportId.toString(), // Convert numeric ID to string
            name: r.reportName,
            description: r.description || '',
            type: 'PowerBI' as const, // Default type - could be fetched from API if needed
            route: `/hub/${hub.hubId}/report/${r.reportId}`,
            embedConfig: undefined
          }))
        }));
        console.log('[DEBUG] Report categories mapped:', this.reportCategories);
      },
      error: (err) => {
        console.error('[DEBUG] Error loading hubs with reports:', err);
        // Keep empty categories on error
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

    // Track admin status
    this.originalIsAdmin = this.isUserAdmin(user);
    this.pendingIsAdmin = this.originalIsAdmin;
    console.log('[DEBUG] User admin status:', this.originalIsAdmin);

    // Reset permissions state
    this.userDepartments = new Set();
    this.originalUserDepartments = new Set();
    this.userHubPermissions = new Set();
    this.originalUserHubPermissions = new Set();
    this.userReportPermissions = new Set();
    this.originalUserReportPermissions = new Set();

    // Fetch all permissions (departments, hubs, reports) from real API
    this.isLoadingDepartments = true;
    this.isLoadingPermissions = true;

    const userId = parseInt(user.id, 10);
    console.log('[DEBUG] Fetching permissions for user:', userId);

    // Fetch departments
    this.adminUserService.getUserDepartments(userId).subscribe({
      next: (departmentIds) => {
        console.log('[DEBUG] User departments loaded:', departmentIds);
        this.userDepartments = new Set(departmentIds);
        this.originalUserDepartments = new Set(departmentIds);
        this.isLoadingDepartments = false;
        this.updateUserDepartmentCount(user.id, departmentIds.length);
      },
      error: (error) => {
        console.error('[DEBUG] Error loading user departments:', error);
        this.isLoadingDepartments = false;
      }
    });

    // Fetch hub and report permissions
    this.adminUserService.getUserPermissions(userId).subscribe({
      next: (response) => {
        console.log('[DEBUG] User permissions loaded:', response);

        // Load hub permissions
        const hubIds = response.permissions.hubs.map(h => h.hubId.toString());
        this.userHubPermissions = new Set(hubIds);
        this.originalUserHubPermissions = new Set(hubIds);

        // Load report permissions
        const reportIds = response.permissions.reports.map(r => r.reportId.toString());
        this.userReportPermissions = new Set(reportIds);
        this.originalUserReportPermissions = new Set(reportIds);

        this.isLoadingPermissions = false;
        console.log('[DEBUG] Hub permissions:', hubIds);
        console.log('[DEBUG] Report permissions:', reportIds);
      },
      error: (error) => {
        console.error('[DEBUG] Error loading user permissions:', error);
        this.isLoadingPermissions = false;
      }
    });

    // Collapse all categories by default
    this.collapsedCategories = new Set(this.reportCategories.map(cat => cat.id));
  }

  /**
   * Update the user's department count in the users array for display
   */
  private updateUserDepartmentCount(userId: string, count: number): void {
    // Find the user in the main users array
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      // Create a groups array of the right length for display purposes
      // We just need the length to be correct for {{ user.groups.length }}
      this.users[userIndex] = {
        ...this.users[userIndex],
        groups: Array(count).fill('dept') // Array with correct length
      };
      // Also update selectedUser if it's the same user
      if (this.selectedUser?.id === userId) {
        this.selectedUser = this.users[userIndex];
      }
      // Refresh the filtered view
      this.applyFilters();
    }
  }

  togglePermission(reportId: string): void {
    // Toggle individual report permission
    if (this.userReportPermissions.has(reportId)) {
      this.userReportPermissions.delete(reportId);
    } else {
      this.userReportPermissions.add(reportId);
    }
  }

  toggleHubPermission(hubId: string): void {
    // Toggle hub-level permission
    if (this.userHubPermissions.has(hubId)) {
      this.userHubPermissions.delete(hubId);
    } else {
      this.userHubPermissions.add(hubId);
    }
  }

  toggleDepartment(departmentId: string): void {
    console.log('[DEBUG] toggleDepartment called with:', departmentId);
    console.log('[DEBUG] userDepartments before:', Array.from(this.userDepartments));
    if (this.userDepartments.has(departmentId)) {
      this.userDepartments.delete(departmentId);
    } else {
      this.userDepartments.add(departmentId);
    }
    console.log('[DEBUG] userDepartments after:', Array.from(this.userDepartments));
  }

  async toggleAdminRole(): Promise<void> {
    if (!this.selectedUser) return;

    // Don't allow modifying own admin status
    if (this.selectedUser.id === this.currentUser?.id) {
      this.notificationService.warning(
        'Action Not Allowed',
        'You cannot modify your own administrator status.'
      );
      return;
    }

    const newAdminStatus = !this.isUserAdmin(this.selectedUser);
    const userName = `${this.selectedUser.firstName} ${this.selectedUser.lastName}`;

    console.log('[DEBUG] toggleAdminRole called');
    console.log('[DEBUG] Current admin status:', this.isUserAdmin(this.selectedUser));
    console.log('[DEBUG] New admin status will be:', newAdminStatus);

    // Confirm the action
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

    if (!confirmed) {
      console.log('[DEBUG] Admin role change cancelled by user');
      return;
    }

    // Save the admin role change immediately
    this.isSavingAdminRole = true;
    const userId = parseInt(this.selectedUser.id, 10);

    console.log('[DEBUG] Calling API to update admin role for user:', userId, 'to:', newAdminStatus);

    this.adminUserService.updateUserAdminRole(userId, newAdminStatus).subscribe({
      next: () => {
        console.log('[DEBUG] Admin role updated successfully');
        this.isSavingAdminRole = false;

        // Update the local user's roles
        if (this.selectedUser) {
          if (newAdminStatus) {
            // Add Admin role if not present
            if (!this.selectedUser.roles.some(r => r.toLowerCase() === 'admin')) {
              this.selectedUser.roles = [...this.selectedUser.roles, 'Admin'];
            }
          } else {
            // Remove Admin role
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

        // Refresh user list to reflect changes
        this.loadUsers();
      },
      error: (error) => {
        console.error('[DEBUG] Error updating admin role:', error);
        this.isSavingAdminRole = false;
        this.notificationService.error(
          'Update Failed',
          'Failed to update administrator access. Please try again.'
        );
      }
    });
  }

  hasPermission(reportId: string): boolean {
    // Check if user has direct report permission
    return this.userReportPermissions.has(reportId);
  }

  hasHubPermission(hubId: string): boolean {
    // Check if user has direct hub permission
    return this.userHubPermissions.has(hubId);
  }

  hasDepartment(departmentId: string): boolean {
    return this.userDepartments.has(departmentId);
  }

  toggleCategoryPermissions(category: HubCategory): void {
    // Toggle hub-level permission
    // If hub is already granted, revoke it
    // If hub is not granted, grant it (gives access to all reports in hub)
    if (this.userHubPermissions.has(category.id)) {
      this.userHubPermissions.delete(category.id);
    } else {
      this.userHubPermissions.add(category.id);
      // When granting hub access, remove individual report permissions
      // since hub access supersedes them
      category.reports.forEach(report => {
        this.userReportPermissions.delete(report.id);
      });
    }
  }

  isCategoryFullySelected(category: HubCategory): boolean {
    // Hub is "fully selected" if user has direct hub access
    return this.userHubPermissions.has(category.id);
  }

  isCategoryPartiallySelected(category: HubCategory): boolean {
    // Hub is "partially selected" if user has some report permissions
    // but not hub-level access
    if (this.userHubPermissions.has(category.id)) {
      return false; // Has full hub access, not partial
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

    // Build array of all operations (departments, hubs, reports)
    const operations: Observable<{ success: boolean }>[] = [];

    // Compute department changes
    const currentDepts = Array.from(this.userDepartments);
    const originalDepts = Array.from(this.originalUserDepartments);
    const deptsToAdd = currentDepts.filter(id => !this.originalUserDepartments.has(id));
    const deptsToRemove = originalDepts.filter(id => !this.userDepartments.has(id));

    // Compute hub permission changes
    const currentHubs = Array.from(this.userHubPermissions);
    const originalHubs = Array.from(this.originalUserHubPermissions);
    const hubsToAdd = currentHubs.filter(id => !this.originalUserHubPermissions.has(id));
    const hubsToRemove = originalHubs.filter(id => !this.userHubPermissions.has(id));

    // Compute report permission changes
    const currentReports = Array.from(this.userReportPermissions);
    const originalReports = Array.from(this.originalUserReportPermissions);
    const reportsToAdd = currentReports.filter(id => !this.originalUserReportPermissions.has(id));
    const reportsToRemove = originalReports.filter(id => !this.userReportPermissions.has(id));

    console.log('[DEBUG] savePermissions - changes:');
    console.log('[DEBUG]   Departments: add=', deptsToAdd, 'remove=', deptsToRemove);
    console.log('[DEBUG]   Hubs: add=', hubsToAdd, 'remove=', hubsToRemove);
    console.log('[DEBUG]   Reports: add=', reportsToAdd, 'remove=', reportsToRemove);

    // If no changes, we're done
    if (deptsToAdd.length === 0 && deptsToRemove.length === 0 &&
        hubsToAdd.length === 0 && hubsToRemove.length === 0 &&
        reportsToAdd.length === 0 && reportsToRemove.length === 0) {
      this.isSaving = false;
      this.notificationService.info('No Changes', 'No permission changes to save.');
      return;
    }

    // Add department operations
    deptsToAdd.forEach(deptId => {
      operations.push(this.adminUserService.assignUserToDepartment(userId, parseInt(deptId, 10)));
    });
    deptsToRemove.forEach(deptId => {
      operations.push(this.adminUserService.removeUserFromDepartment(userId, parseInt(deptId, 10)));
    });

    // Add hub operations
    hubsToAdd.forEach(hubId => {
      operations.push(this.adminUserService.grantHubAccess(userId, parseInt(hubId, 10)));
    });
    hubsToRemove.forEach(hubId => {
      operations.push(this.adminUserService.revokeHubAccess(userId, parseInt(hubId, 10)));
    });

    // Add report operations
    reportsToAdd.forEach(reportId => {
      operations.push(this.adminUserService.grantReportAccess(userId, parseInt(reportId, 10)));
    });
    reportsToRemove.forEach(reportId => {
      operations.push(this.adminUserService.revokeReportAccess(userId, parseInt(reportId, 10)));
    });

    // Execute all operations
    console.log('[DEBUG] Executing', operations.length, 'permission operations');
    forkJoin(operations).subscribe({
      next: (results) => {
        console.log('[DEBUG] Permission operations completed:', results);
        this.isSaving = false;

        // Update original values to match current (so subsequent saves work correctly)
        this.originalUserDepartments = new Set(this.userDepartments);
        this.originalUserHubPermissions = new Set(this.userHubPermissions);
        this.originalUserReportPermissions = new Set(this.userReportPermissions);

        // Update the user's counts in the list
        if (this.selectedUser) {
          this.updateUserDepartmentCount(this.selectedUser.id, this.userDepartments.size);
          this.updateUserReportCount(this.selectedUser.id, this.userHubPermissions.size, this.userReportPermissions.size);
        }

        this.notificationService.success(
          'Changes Saved',
          'Permissions updated successfully'
        );
      },
      error: (error) => {
        console.error('[DEBUG] Error saving permissions:', error);
        this.isSaving = false;
        this.notificationService.error(
          'Save Failed',
          'Error updating permissions. Please try again.'
        );
      }
    });
  }

  /**
   * Update the user's report count in the users array for display
   */
  private updateUserReportCount(userId: string, hubCount: number, reportCount: number): void {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      // Create a permissions array of the right length for display
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
