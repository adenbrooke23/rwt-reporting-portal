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
  Hub,
  ReportGroup,
  CreateReportGroupDto,
  UpdateReportGroupDto
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
  DropdownModule,
  ListItem,
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
import Category from '@carbon/icons/es/category/16';

@Component({
  selector: 'app-group-management',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    IconModule,
    ModalModule,
    InputModule,
    DropdownModule,
    TagModule,
    PaginationModule,
    SearchModule,
    ToggleModule
  ],
  templateUrl: './group-management.component.html',
  styleUrl: './group-management.component.scss'
})
export class GroupManagementComponent implements OnInit, OnDestroy {
  @ViewChild('statusTemplate') statusTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate') actionsTemplate!: TemplateRef<any>;
  @ViewChild('hubTemplate') hubTemplate!: TemplateRef<any>;

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
  groups: ReportGroup[] = [];
  filteredGroups: ReportGroup[] = [];
  hubs: Hub[] = [];
  isLoading = true;

  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5);

  paginationModel: PaginationModel = new PaginationModel();
  itemsPerPageOptions = [10, 20, 30, 50];

  searchQuery = '';
  selectedHubFilter = '';
  showInactive = false;

  showModal = false;
  isEditing = false;
  editingGroup: ReportGroup | null = null;
  isSaving = false;

  formData: CreateReportGroupDto = {
    hubId: '',
    name: '',
    description: ''
  };

  get hubFilterDropdownItems(): ListItem[] {
    const items: ListItem[] = [
      { content: 'All Hubs', value: '', selected: this.selectedHubFilter === '' }
    ];
    return items.concat(this.hubs.map(hub => ({
      content: hub.name,
      value: hub.id,
      selected: this.selectedHubFilter === hub.id
    })));
  }

  get hubFormDropdownItems(): ListItem[] {
    return this.hubs.map(hub => ({
      content: hub.name,
      value: hub.id,
      selected: this.formData.hubId === hub.id
    }));
  }

  onHubFilterSelect(event: any): void {
    this.onHubFilterChange(event?.item?.value as string || '');
  }

  onHubFormSelect(event: any): void {
    if (event?.item?.value) {
      this.formData.hubId = event.item.value as string;
    }
  }

  ngOnInit(): void {
    // Register icons (safe for SSR)
    this.iconService.registerAll([ArrowLeft, Add, Edit, TrashCan, Renew, Category]);

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

    this.contentService.getHubs(false).subscribe(hubs => {
      this.hubs = hubs;
    });

    this.contentService.getReportGroups(undefined, true).subscribe({
      next: (groups) => {
        this.groups = groups;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to load report categories');
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.groups];

    if (!this.showInactive) {
      filtered = filtered.filter(g => g.isActive);
    }

    if (this.selectedHubFilter) {
      filtered = filtered.filter(g => g.hubId === this.selectedHubFilter);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(query) ||
        g.description.toLowerCase().includes(query)
      );
    }

    this.paginationModel.totalDataLength = filtered.length;

    const pageLength = this.paginationModel.pageLength || 10;
    const startIndex = (this.paginationModel.currentPage - 1) * pageLength;
    this.filteredGroups = filtered.slice(startIndex, startIndex + pageLength);

    this.updateTableModel();
  }

  updateTableModel(): void {
    this.tableModel.header = [
      new TableHeaderItem({ data: 'Category Name' }),
      new TableHeaderItem({ data: 'Hub' }),
      new TableHeaderItem({ data: 'Description' }),
      new TableHeaderItem({ data: 'Reports' }),
      new TableHeaderItem({ data: 'Status' }),
      new TableHeaderItem({ data: 'Actions' })
    ];

    this.tableModel.data = this.filteredGroups.map(group => [
      new TableItem({ data: group.name }),
      new TableItem({ data: group, template: this.hubTemplate }),
      new TableItem({ data: group.description }),
      new TableItem({ data: group.reportCount || 0 }),
      new TableItem({ data: group, template: this.statusTemplate }),
      new TableItem({ data: group, template: this.actionsTemplate })
    ]);
  }

  getHubName(hubId: string): string {
    const hub = this.hubs.find(h => h.id === hubId);
    return hub?.name || 'Unknown';
  }

  getHubColorClass(hubId: string): string {
    const hub = this.hubs.find(h => h.id === hubId);
    return hub?.colorClass || 'default';
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  onHubFilterChange(hubId: string): void {
    this.selectedHubFilter = hubId;
    this.paginationModel.currentPage = 1;
    this.applyFilters();
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
    this.editingGroup = null;
    this.formData = {
      hubId: this.selectedHubFilter || '',
      name: '',
      description: ''
    };
    this.showModal = true;
  }

  openEditModal(group: ReportGroup): void {
    this.isEditing = true;
    this.editingGroup = group;
    this.formData = {
      hubId: group.hubId,
      name: group.name,
      description: group.description
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingGroup = null;
  }

  saveGroup(): void {
    if (!this.formData.name.trim()) {
      this.notificationService.warning('Validation', 'Category name is required');
      return;
    }

    if (!this.formData.hubId) {
      this.notificationService.warning('Validation', 'Please select a hub');
      return;
    }

    this.isSaving = true;

    if (this.isEditing && this.editingGroup) {
      const updateDto: UpdateReportGroupDto = {
        name: this.formData.name,
        description: this.formData.description,
        hubId: this.formData.hubId
      };

      this.contentService.updateReportGroup(this.editingGroup.id, updateDto).subscribe({
        next: () => {
          this.notificationService.success('Updated', 'Report category updated successfully');
          this.closeModal();
          this.loadData();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to update report category');
          this.isSaving = false;
        }
      });
    } else {
      this.contentService.createReportGroup(this.formData).subscribe({
        next: () => {
          this.notificationService.success('Created', 'Report category created successfully');
          this.closeModal();
          this.loadData();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to create report category');
          this.isSaving = false;
        }
      });
    }
  }

  async deleteGroup(group: ReportGroup): Promise<void> {
    const confirmed = await this.confirmationService.danger(
      'Delete Report Category',
      `Are you sure you want to delete "${group.name}"? This will also hide all associated reports.`,
      'Delete'
    );

    if (confirmed) {
      this.contentService.deleteReportGroup(group.id).subscribe({
        next: () => {
          this.notificationService.success('Deleted', 'Report category has been deactivated');
          this.loadData();
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to delete report category');
        }
      });
    }
  }

  restoreGroup(group: ReportGroup): void {
    const updateDto: UpdateReportGroupDto = { isActive: true };
    this.contentService.updateReportGroup(group.id, updateDto).subscribe({
      next: () => {
        this.notificationService.success('Restored', 'Report category has been restored');
        this.loadData();
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to restore report category');
      }
    });
  }

  backToContent(): void {
    this.router.navigate(['/admin/content']);
  }
}
