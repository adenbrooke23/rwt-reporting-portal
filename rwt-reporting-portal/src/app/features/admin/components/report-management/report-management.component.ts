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
  Report,
  Department,
  CreateReportDto,
  UpdateReportDto
} from '../../models/content-management.models';
import { ReportType, ReportEmbedConfig } from '../../../auth/models/user-management.models';
import { SSRSBrowserComponent } from '../ssrs-browser/ssrs-browser.component';
import { SSRSBrowserService, SSRSReportSelection } from '../../services/ssrs-browser.service';
import { PowerBIBrowserComponent } from '../powerbi-browser/powerbi-browser.component';
import { PowerBIBrowserService, PowerBIReportSelection } from '../../services/powerbi-browser.service';
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
  ToggleModule,
  CheckboxModule,
  BreadcrumbModule
} from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import Add from '@carbon/icons/es/add/16';
import Edit from '@carbon/icons/es/edit/16';
import TrashCan from '@carbon/icons/es/trash-can/16';
import Renew from '@carbon/icons/es/renew/16';
import Document from '@carbon/icons/es/document/16';
import Folder from '@carbon/icons/es/folder/16';
import Category from '@carbon/icons/es/category/16';

@Component({
  selector: 'app-report-management',
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
    ToggleModule,
    CheckboxModule,
    BreadcrumbModule,
    SSRSBrowserComponent,
    PowerBIBrowserComponent
  ],
  templateUrl: './report-management.component.html',
  styleUrl: './report-management.component.scss'
})
export class ReportManagementComponent implements OnInit, OnDestroy {
  @ViewChild('statusTemplate') statusTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate') actionsTemplate!: TemplateRef<any>;
  @ViewChild('typeTemplate') typeTemplate!: TemplateRef<any>;
  @ViewChild('groupTemplate') groupTemplate!: TemplateRef<any>;

  private authService = inject(AuthService);
  private contentService = inject(ContentManagementService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationNotificationService);
  private ssrsBrowserService = inject(SSRSBrowserService);
  private powerBIBrowserService = inject(PowerBIBrowserService);
  private router = inject(Router);
  private iconService = inject(IconService);
  private platformId = inject(PLATFORM_ID);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  currentUser = this.authService.getCurrentUser();
  reports: Report[] = [];
  filteredReports: Report[] = [];
  hubs: Hub[] = [];
  groups: ReportGroup[] = [];
  filteredGroups: ReportGroup[] = [];
  departments: Department[] = [];
  isLoading = true;

  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 6);

  paginationModel: PaginationModel = new PaginationModel();
  itemsPerPageOptions = [10, 20, 30, 50];

  searchQuery = '';
  selectedHubFilter = '';
  selectedGroupFilter = '';
  selectedTypeFilter: ReportType | '' = '';
  showInactive = false;

  showModal = false;
  isEditing = false;
  editingReport: Report | null = null;
  isSaving = false;

  showSSRSBrowser = false;
  ssrsServerUrl = '';

  showPowerBIBrowser = false;

  formData = {
    reportGroupId: '',
    name: '',
    description: '',
    type: 'PowerBI' as ReportType,
    embedUrl: '',
    workspaceId: '',
    reportId: '',
    serverUrl: '',
    reportPath: '',
    departmentIds: [] as string[]
  };

  reportTypes: { id: ReportType; name: string }[] = [
    { id: 'PowerBI', name: 'Power BI' },
    { id: 'SSRS', name: 'SSRS' },
    { id: 'Paginated', name: 'Paginated' }
  ];

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

  get groupFilterDropdownItems(): ListItem[] {
    const items: ListItem[] = [
      { content: 'All Groups', value: '', selected: this.selectedGroupFilter === '' }
    ];
    return items.concat(this.filteredGroups.map(group => ({
      content: group.name,
      value: group.id,
      selected: this.selectedGroupFilter === group.id
    })));
  }

  get typeFilterDropdownItems(): ListItem[] {
    const items: ListItem[] = [
      { content: 'All Types', value: '', selected: this.selectedTypeFilter === '' }
    ];
    return items.concat(this.reportTypes.map(type => ({
      content: type.name,
      value: type.id,
      selected: this.selectedTypeFilter === type.id
    })));
  }

  get groupFormDropdownItems(): ListItem[] {
    return this.groups.map(group => ({
      content: `${group.name} (${this.getHubNameByGroupId(group.id) || 'Unknown Hub'})`,
      value: group.id,
      selected: this.formData.reportGroupId === group.id
    }));
  }

  get typeFormDropdownItems(): ListItem[] {
    return this.reportTypes.map(type => ({
      content: type.name,
      value: type.id,
      selected: this.formData.type === type.id
    }));
  }

  onHubFilterSelect(event: any): void {
    this.onHubFilterChange(event?.item?.value as string || '');
  }

  onGroupFilterSelect(event: any): void {
    this.onGroupFilterChange(event?.item?.value as string || '');
  }

  onTypeFilterSelect(event: any): void {
    this.onTypeFilterChange(event?.item?.value as ReportType | '' || '');
  }

  onGroupFormSelect(event: any): void {
    if (event?.item?.value) {
      this.formData.reportGroupId = event.item.value as string;
    }
  }

  onTypeFormSelect(event: any): void {
    if (event?.item?.value) {
      this.formData.type = event.item.value as ReportType;
    }
  }

  ngOnInit(): void {

    this.iconService.registerAll([ArrowLeft, Add, Edit, TrashCan, Renew, Document, Folder, Category]);

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

    this.contentService.getReportGroups(undefined, false).subscribe(groups => {
      this.groups = groups;
      this.filteredGroups = groups;
    });

    this.contentService.getDepartments(false).subscribe(departments => {
      this.departments = departments;
    });

    this.contentService.getReports(undefined, undefined, true).subscribe({
      next: (reports) => {
        this.reports = reports;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to load reports');
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.reports];

    if (!this.showInactive) {
      filtered = filtered.filter(r => r.isActive);
    }

    if (this.selectedHubFilter) {
      filtered = filtered.filter(r => r.hubId === this.selectedHubFilter);
    }

    if (this.selectedGroupFilter) {
      filtered = filtered.filter(r => r.reportGroupId === this.selectedGroupFilter);
    }

    if (this.selectedTypeFilter) {
      filtered = filtered.filter(r => r.type === this.selectedTypeFilter);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query)
      );
    }

    this.paginationModel.totalDataLength = filtered.length;

    const pageLength = this.paginationModel.pageLength || 10;
    const startIndex = (this.paginationModel.currentPage - 1) * pageLength;
    this.filteredReports = filtered.slice(startIndex, startIndex + pageLength);

    this.updateTableModel();
  }

  updateTableModel(): void {
    this.tableModel.header = [
      new TableHeaderItem({ data: 'Report Name' }),
      new TableHeaderItem({ data: 'Group' }),
      new TableHeaderItem({ data: 'Type' }),
      new TableHeaderItem({ data: 'Description' }),
      new TableHeaderItem({ data: 'Status' }),
      new TableHeaderItem({ data: 'Actions' })
    ];

    this.tableModel.data = this.filteredReports.map(report => [
      new TableItem({ data: report.name }),
      new TableItem({ data: report, template: this.groupTemplate }),
      new TableItem({ data: report, template: this.typeTemplate }),
      new TableItem({ data: report.description }),
      new TableItem({ data: report, template: this.statusTemplate }),
      new TableItem({ data: report, template: this.actionsTemplate })
    ]);
  }

  getGroupName(groupId: string): string {
    const group = this.groups.find(g => g.id === groupId);
    return group?.name || 'Unknown';
  }

  getHubNameByGroupId(groupId: string): string {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      const hub = this.hubs.find(h => h.id === group.hubId);
      return hub?.name || '';
    }
    return '';
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  onHubFilterChange(hubId: string): void {
    this.selectedHubFilter = hubId;
    this.selectedGroupFilter = '';

    if (hubId) {
      this.filteredGroups = this.groups.filter(g => g.hubId === hubId);
    } else {
      this.filteredGroups = this.groups;
    }

    this.paginationModel.currentPage = 1;
    this.applyFilters();
  }

  onGroupFilterChange(groupId: string): void {
    this.selectedGroupFilter = groupId;
    this.paginationModel.currentPage = 1;
    this.applyFilters();
  }

  onTypeFilterChange(type: ReportType | ''): void {
    this.selectedTypeFilter = type;
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

  isDepartmentSelected(departmentId: string): boolean {
    return this.formData.departmentIds.includes(departmentId);
  }

  toggleDepartment(departmentId: string): void {
    const index = this.formData.departmentIds.indexOf(departmentId);
    if (index === -1) {
      this.formData.departmentIds = [...this.formData.departmentIds, departmentId];
    } else {
      this.formData.departmentIds = this.formData.departmentIds.filter(id => id !== departmentId);
    }
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingReport = null;
    this.formData = {
      reportGroupId: this.selectedGroupFilter || '',
      name: '',
      description: '',
      type: 'PowerBI',
      embedUrl: '',
      workspaceId: '',
      reportId: '',
      serverUrl: '',
      reportPath: '',
      departmentIds: []
    };
    this.showModal = true;
  }

  openEditModal(report: Report): void {
    this.isEditing = true;
    this.editingReport = report;
    this.formData = {
      reportGroupId: report.reportGroupId,
      name: report.name,
      description: report.description,
      type: report.type,
      embedUrl: report.embedConfig?.embedUrl || '',
      workspaceId: report.embedConfig?.workspaceId || '',
      reportId: report.embedConfig?.reportId || '',
      serverUrl: report.embedConfig?.serverUrl || '',
      reportPath: report.embedConfig?.reportPath || '',
      departmentIds: report.departmentIds || []
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingReport = null;
  }

  saveReport(): void {
    if (!this.formData.name.trim()) {
      this.notificationService.warning('Validation', 'Report name is required');
      return;
    }

    if (!this.formData.reportGroupId) {
      this.notificationService.warning('Validation', 'Please select a report group');
      return;
    }

    this.isSaving = true;

    const embedConfig: ReportEmbedConfig = {};

    if (this.formData.type === 'PowerBI' || this.formData.type === 'Paginated') {
      if (this.formData.embedUrl) embedConfig.embedUrl = this.formData.embedUrl;
      if (this.formData.workspaceId) embedConfig.workspaceId = this.formData.workspaceId;
      if (this.formData.reportId) embedConfig.reportId = this.formData.reportId;
    }

    if (this.formData.type === 'SSRS') {
      if (this.formData.serverUrl) embedConfig.serverUrl = this.formData.serverUrl;
      if (this.formData.reportPath) embedConfig.reportPath = this.formData.reportPath;
    }

    if (this.isEditing && this.editingReport) {
      const updateDto: UpdateReportDto = {
        name: this.formData.name,
        description: this.formData.description,
        type: this.formData.type,
        reportGroupId: this.formData.reportGroupId,
        embedConfig: Object.keys(embedConfig).length > 0 ? embedConfig : undefined,
        departmentIds: this.formData.departmentIds.length > 0 ? this.formData.departmentIds : undefined
      };

      this.contentService.updateReport(this.editingReport.id, updateDto).subscribe({
        next: () => {
          this.notificationService.success('Updated', 'Report updated successfully');
          this.closeModal();
          this.loadData();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to update report');
          this.isSaving = false;
        }
      });
    } else {
      const createDto: CreateReportDto = {
        reportGroupId: this.formData.reportGroupId,
        name: this.formData.name,
        description: this.formData.description,
        type: this.formData.type,
        embedConfig: Object.keys(embedConfig).length > 0 ? embedConfig : undefined,
        departmentIds: this.formData.departmentIds.length > 0 ? this.formData.departmentIds : undefined
      };

      this.contentService.createReport(createDto).subscribe({
        next: () => {
          this.notificationService.success('Created', 'Report created successfully');
          this.closeModal();
          this.loadData();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to create report');
          this.isSaving = false;
        }
      });
    }
  }

  async deleteReport(report: Report): Promise<void> {
    const confirmed = await this.confirmationService.danger(
      'Delete Report',
      `Are you sure you want to delete "${report.name}"?`,
      'Delete'
    );

    if (confirmed) {
      this.contentService.deleteReport(report.id).subscribe({
        next: () => {
          this.notificationService.success('Deleted', 'Report has been deactivated');
          this.loadData();
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to delete report');
        }
      });
    }
  }

  restoreReport(report: Report): void {
    const updateDto: UpdateReportDto = { isActive: true };
    this.contentService.updateReport(report.id, updateDto).subscribe({
      next: () => {
        this.notificationService.success('Restored', 'Report has been restored');
        this.loadData();
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to restore report');
      }
    });
  }

  backToContent(): void {
    this.router.navigate(['/admin/content']);
  }

  getTypeTagColor(type: ReportType): 'blue' | 'green' | 'purple' {
    switch (type) {
      case 'PowerBI': return 'blue';
      case 'SSRS': return 'green';
      case 'Paginated': return 'purple';
      default: return 'blue';
    }
  }

  openSSRSBrowser(): void {
    this.ssrsBrowserService.getConfig().subscribe(config => {
      this.ssrsServerUrl = config.serverUrl;
      this.showSSRSBrowser = true;
    });
  }

  onSSRSReportSelected(selection: SSRSReportSelection): void {
    this.formData.serverUrl = selection.serverUrl;
    this.formData.reportPath = selection.reportPath;

    if (!this.formData.name) {
      this.formData.name = selection.reportName;
    }
    if (!this.formData.description && selection.description) {
      this.formData.description = selection.description;
    }
    this.showSSRSBrowser = false;
  }

  closeSSRSBrowser(): void {
    this.showSSRSBrowser = false;
  }

  openPowerBIBrowser(): void {
    this.showPowerBIBrowser = true;
  }

  onPowerBIReportSelected(selection: PowerBIReportSelection): void {
    this.formData.workspaceId = selection.workspaceId;
    this.formData.reportId = selection.reportId;
    this.formData.embedUrl = selection.embedUrl;

    if (selection.reportType === 'PaginatedReport') {
      this.formData.type = 'Paginated';
    } else {
      this.formData.type = 'PowerBI';
    }

    if (!this.formData.name) {
      this.formData.name = selection.reportName;
    }
    if (!this.formData.description && selection.description) {
      this.formData.description = selection.description;
    }

    this.showPowerBIBrowser = false;
  }

  closePowerBIBrowser(): void {
    this.showPowerBIBrowser = false;
  }
}
