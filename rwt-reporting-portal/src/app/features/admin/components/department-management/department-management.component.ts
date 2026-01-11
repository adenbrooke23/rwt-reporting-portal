import { Component, OnInit, OnDestroy, inject, TemplateRef, ViewChild, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, filter, take } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { ContentManagementService } from '../../services/content-management.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationNotificationService } from '../../../../core/services/confirmation.service';
import {
  Department,
  CreateDepartmentDto,
  UpdateDepartmentDto
} from '../../models/content-management.models';
import {
  TableModule,
  TableModel,
  TableItem,
  TableHeaderItem,
  Table,
  ButtonModule,
  IconModule,
  IconService,
  ModalModule,
  InputModule,
  TagModule,
  PaginationModule,
  PaginationModel,
  SearchModule,
  ToggleModule
} from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import Add from '@carbon/icons/es/add/16';
import Edit from '@carbon/icons/es/edit/16';
import TrashCan from '@carbon/icons/es/trash-can/16';
import Renew from '@carbon/icons/es/renew/16';
import Group from '@carbon/icons/es/group/16';

@Component({
  selector: 'app-department-management',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    IconModule,
    ModalModule,
    InputModule,
    TagModule,
    PaginationModule,
    SearchModule,
    ToggleModule
  ],
  templateUrl: './department-management.component.html',
  styleUrl: './department-management.component.scss'
})
export class DepartmentManagementComponent implements OnInit, OnDestroy {
  @ViewChild('statusTemplate') statusTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate') actionsTemplate!: TemplateRef<any>;

  private authService = inject(AuthService);
  private contentService = inject(ContentManagementService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationNotificationService);
  private router = inject(Router);
  private iconService = inject(IconService);
  private platformId = inject(PLATFORM_ID);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  currentUser = this.authService.getCurrentUser();
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  isLoading = true;

  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 4);

  paginationModel: PaginationModel = new PaginationModel();
  itemsPerPageOptions = [10, 20, 30, 50];

  searchQuery = '';
  showInactive = false;

  showModal = false;
  isEditing = false;
  editingDepartment: Department | null = null;
  isSaving = false;

  formData: CreateDepartmentDto = {
    name: '',
    description: ''
  };

  ngOnInit(): void {
    // Register icons (safe for SSR)
    this.iconService.registerAll([ArrowLeft, Add, Edit, TrashCan, Renew, Group]);

    this.paginationModel.currentPage = 1;
    this.paginationModel.pageLength = 10;

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.paginationModel.currentPage = 1;
      this.applyFilters();
    });

    // Skip API calls during SSR
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Wait for auth state to be ready before loading data
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

      this.loadData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.isLoading = true;

    this.contentService.getDepartments(true).subscribe({
      next: (departments) => {
        this.departments = departments;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to load departments');
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.departments];

    if (!this.showInactive) {
      filtered = filtered.filter(d => d.isActive);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.description.toLowerCase().includes(query)
      );
    }

    this.paginationModel.totalDataLength = filtered.length;

    const pageLength = this.paginationModel.pageLength || 10;
    const startIndex = (this.paginationModel.currentPage - 1) * pageLength;
    this.filteredDepartments = filtered.slice(startIndex, startIndex + pageLength);

    this.updateTableModel();
  }

  updateTableModel(): void {
    this.tableModel.header = [
      new TableHeaderItem({ data: 'Department Name' }),
      new TableHeaderItem({ data: 'Description' }),
      new TableHeaderItem({ data: 'Status' }),
      new TableHeaderItem({ data: 'Actions' })
    ];

    this.tableModel.data = this.filteredDepartments.map(department => [
      new TableItem({ data: department.name }),
      new TableItem({ data: department.description }),
      new TableItem({ data: department, template: this.statusTemplate }),
      new TableItem({ data: department, template: this.actionsTemplate })
    ]);
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  onPageChange(page: number): void {
    this.paginationModel.currentPage = page;
    this.applyFilters();
  }

  onPageSizeChange(pageLength: number): void {
    this.paginationModel.pageLength = pageLength;
    this.paginationModel.currentPage = 1;
    this.applyFilters();
  }

  toggleShowInactive(): void {
    this.showInactive = !this.showInactive;
    this.paginationModel.currentPage = 1;
    this.applyFilters();
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingDepartment = null;
    this.formData = {
      name: '',
      description: ''
    };
    this.showModal = true;
  }

  openEditModal(department: Department): void {
    this.isEditing = true;
    this.editingDepartment = department;
    this.formData = {
      name: department.name,
      description: department.description
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingDepartment = null;
  }

  saveDepartment(): void {
    if (!this.formData.name.trim()) {
      this.notificationService.warning('Validation', 'Department name is required');
      return;
    }

    this.isSaving = true;

    if (this.isEditing && this.editingDepartment) {
      const updateDto: UpdateDepartmentDto = {
        name: this.formData.name,
        description: this.formData.description
      };

      this.contentService.updateDepartment(this.editingDepartment.id, updateDto).subscribe({
        next: () => {
          this.notificationService.success('Updated', 'Department updated successfully');
          this.closeModal();
          this.loadData();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to update department');
          this.isSaving = false;
        }
      });
    } else {
      this.contentService.createDepartment(this.formData).subscribe({
        next: () => {
          this.notificationService.success('Created', 'Department created successfully');
          this.closeModal();
          this.loadData();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to create department');
          this.isSaving = false;
        }
      });
    }
  }

  async deleteDepartment(department: Department): Promise<void> {
    const confirmed = await this.confirmationService.danger(
      'Delete Department',
      `Are you sure you want to delete "${department.name}"? Users in this department will lose their group-based report access.`,
      'Delete'
    );

    if (confirmed) {
      this.contentService.deleteDepartment(department.id).subscribe({
        next: () => {
          this.notificationService.success('Deleted', 'Department has been deactivated');
          this.loadData();
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to delete department');
        }
      });
    }
  }

  restoreDepartment(department: Department): void {
    const updateDto: UpdateDepartmentDto = { isActive: true };
    this.contentService.updateDepartment(department.id, updateDto).subscribe({
      next: () => {
        this.notificationService.success('Restored', 'Department has been restored');
        this.loadData();
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to restore department');
      }
    });
  }

  backToContent(): void {
    this.router.navigate(['/admin/content']);
  }
}
