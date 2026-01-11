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
  CreateHubDto,
  UpdateHubDto,
  HUB_ICONS,
  HUB_COLORS
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
import Folder from '@carbon/icons/es/folder/16';

@Component({
  selector: 'app-hub-management',
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
  templateUrl: './hub-management.component.html',
  styleUrl: './hub-management.component.scss'
})
export class HubManagementComponent implements OnInit, OnDestroy {
  @ViewChild('statusTemplate') statusTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate') actionsTemplate!: TemplateRef<any>;
  @ViewChild('nameTemplate') nameTemplate!: TemplateRef<any>;

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
  hubs: Hub[] = [];
  filteredHubs: Hub[] = [];
  isLoading = true;

  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5);

  paginationModel: PaginationModel = new PaginationModel();
  itemsPerPageOptions = [10, 20, 30, 50];

  searchQuery = '';
  showInactive = false;

  showModal = false;
  isEditing = false;
  editingHub: Hub | null = null;
  isSaving = false;

  formData: CreateHubDto = {
    name: '',
    description: '',
    iconName: 'folder',
    colorClass: 'default'
  };

  iconOptions = HUB_ICONS;
  colorOptions = HUB_COLORS;

  get iconDropdownItems(): ListItem[] {
    return this.iconOptions.map(icon => ({
      content: icon.name,
      value: icon.id,
      selected: this.formData.iconName === icon.id
    }));
  }

  get colorDropdownItems(): ListItem[] {
    return this.colorOptions.map(color => ({
      content: color.name,
      value: color.class,
      selected: this.formData.colorClass === color.class
    }));
  }

  onIconSelect(event: any): void {
    if (event?.item?.value) {
      this.formData.iconName = event.item.value as string;
    }
  }

  onColorSelect(event: any): void {
    if (event?.item?.value) {
      this.formData.colorClass = event.item.value as string;
    }
  }

  ngOnInit(): void {
    // Register icons (safe for SSR)
    this.iconService.registerAll([ArrowLeft, Add, Edit, TrashCan, Renew, Folder]);

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

      this.loadHubs();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadHubs(): void {
    this.isLoading = true;
    this.contentService.getHubs(true).subscribe({
      next: (hubs) => {
        this.hubs = hubs;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to load hubs');
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.hubs];

    if (!this.showInactive) {
      filtered = filtered.filter(h => h.isActive);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(h =>
        h.name.toLowerCase().includes(query) ||
        h.description.toLowerCase().includes(query)
      );
    }

    this.paginationModel.totalDataLength = filtered.length;

    const pageLength = this.paginationModel.pageLength || 10;
    const startIndex = (this.paginationModel.currentPage - 1) * pageLength;
    this.filteredHubs = filtered.slice(startIndex, startIndex + pageLength);

    this.updateTableModel();
  }

  updateTableModel(): void {
    this.tableModel.header = [
      new TableHeaderItem({ data: 'Hub Name' }),
      new TableHeaderItem({ data: 'Description' }),
      new TableHeaderItem({ data: 'Groups' }),
      new TableHeaderItem({ data: 'Reports' }),
      new TableHeaderItem({ data: 'Status' }),
      new TableHeaderItem({ data: 'Actions' })
    ];

    this.tableModel.data = this.filteredHubs.map(hub => [
      new TableItem({ data: hub, template: this.nameTemplate }),
      new TableItem({ data: hub.description }),
      new TableItem({ data: hub.reportGroupCount || 0 }),
      new TableItem({ data: hub.reportCount || 0 }),
      new TableItem({ data: hub, template: this.statusTemplate }),
      new TableItem({ data: hub, template: this.actionsTemplate })
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
    this.editingHub = null;
    this.formData = {
      name: '',
      description: '',
      iconName: 'folder',
      colorClass: 'default'
    };
    this.showModal = true;
  }

  openEditModal(hub: Hub): void {
    this.isEditing = true;
    this.editingHub = hub;
    this.formData = {
      name: hub.name,
      description: hub.description,
      iconName: hub.iconName || 'folder',
      colorClass: hub.colorClass || 'default'
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingHub = null;
  }

  saveHub(): void {
    if (!this.formData.name.trim()) {
      this.notificationService.warning('Validation', 'Hub name is required');
      return;
    }

    this.isSaving = true;

    if (this.isEditing && this.editingHub) {
      const updateDto: UpdateHubDto = {
        name: this.formData.name,
        description: this.formData.description,
        iconName: this.formData.iconName,
        colorClass: this.formData.colorClass
      };

      this.contentService.updateHub(this.editingHub.id, updateDto).subscribe({
        next: () => {
          this.notificationService.success('Updated', 'Hub updated successfully');
          this.closeModal();
          this.loadHubs();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to update hub');
          this.isSaving = false;
        }
      });
    } else {
      this.contentService.createHub(this.formData).subscribe({
        next: () => {
          this.notificationService.success('Created', 'Hub created successfully');
          this.closeModal();
          this.loadHubs();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to create hub');
          this.isSaving = false;
        }
      });
    }
  }

  async deleteHub(hub: Hub): Promise<void> {
    const confirmed = await this.confirmationService.danger(
      'Delete Hub',
      `Are you sure you want to delete "${hub.name}"? This will also hide all associated report groups and reports.`,
      'Delete'
    );

    if (confirmed) {
      this.contentService.deleteHub(hub.id).subscribe({
        next: () => {
          this.notificationService.success('Deleted', 'Hub has been deactivated');
          this.loadHubs();
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to delete hub');
        }
      });
    }
  }

  restoreHub(hub: Hub): void {
    const updateDto: UpdateHubDto = { isActive: true };
    this.contentService.updateHub(hub.id, updateDto).subscribe({
      next: () => {
        this.notificationService.success('Restored', 'Hub has been restored');
        this.loadHubs();
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to restore hub');
      }
    });
  }

  backToContent(): void {
    this.router.navigate(['/admin/content']);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
