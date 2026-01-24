import { Component, OnInit, AfterViewInit, inject, TemplateRef, ViewChild, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { ContentManagementService } from '../../../admin/services/content-management.service';
import { ReportGroup, Department } from '../../../admin/models/content-management.models';
import { PersonalDashboardService } from '../../../dashboard/services/personal-dashboard.service';
import { QuickAccessService } from '../../../../core/services/quick-access.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TilesModule, IconModule, IconService, ButtonModule, TableModule, TagModule, SearchModule, PaginationModule, DialogModule, DropdownModule, ListItem, Table, TableModel, TableHeaderItem, TableItem, PaginationModel } from 'carbon-components-angular';
import { ReportType, ReportEmbedConfig } from '../../../auth/models/user-management.models';

// Extended report interface with category and department info
interface HubReport {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  route: string;
  embedConfig?: ReportEmbedConfig;
  categoryId: string;
  categoryName: string;
  departmentIds: string[];
  departmentNames: string[];
}
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import Document from '@carbon/icons/es/document/16';
import DocumentBlank from '@carbon/icons/es/document--blank/20';
import Star16 from '@carbon/icons/es/star/16';
import Star20 from '@carbon/icons/es/star/20';
import StarFilled from '@carbon/icons/es/star--filled/16';
import Pin from '@carbon/icons/es/pin/16';
import PinFilled from '@carbon/icons/es/pin--filled/16';
import TrashCan from '@carbon/icons/es/trash-can/16';
import View from '@carbon/icons/es/view/16';
import Settings from '@carbon/icons/es/settings/16';
import Checkmark from '@carbon/icons/es/checkmark/16';
import Category from '@carbon/icons/es/category/16';
import Filter from '@carbon/icons/es/filter/16';

@Component({
  selector: 'app-hub-detail',
  imports: [CommonModule, RouterLink, TilesModule, IconModule, ButtonModule, TableModule, TagModule, SearchModule, PaginationModule, DialogModule, DropdownModule],
  templateUrl: './hub-detail.component.html',
  styleUrl: './hub-detail.component.scss'
})
export class HubDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private contentService = inject(ContentManagementService);
  private personalDashboardService = inject(PersonalDashboardService);
  private quickAccessService = inject(QuickAccessService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private iconService = inject(IconService);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('reportNameTemplate', { static: false }) reportNameTemplate!: TemplateRef<any>;
  @ViewChild('categoryTemplate', { static: false }) categoryTemplate!: TemplateRef<any>;
  @ViewChild('descriptionTemplate', { static: false }) descriptionTemplate!: TemplateRef<any>;
  @ViewChild('typeTemplate', { static: false }) typeTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate', { static: false }) actionsTemplate!: TemplateRef<any>;

  currentUser = this.authService.getCurrentUser();
  hubId: string = '';
  hubName: string = '';
  hubDescription: string = '';
  reports: HubReport[] = [];

  // Categories and departments for filtering
  categories: ReportGroup[] = [];
  departments: Department[] = [];
  selectedCategoryId: string = '';
  selectedDepartmentId: string = '';

  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5); // 5 columns now (added Category)
  isLoading = true;
  searchQuery = '';
  tableRowSize: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  paginationModel: PaginationModel = new PaginationModel();
  allReports: HubReport[] = [];

  // Dropdown items for filters
  get categoryDropdownItems(): ListItem[] {
    const items: ListItem[] = [
      { content: 'All Categories', value: '', selected: this.selectedCategoryId === '' }
    ];
    this.categories.forEach(cat => {
      items.push({
        content: cat.name,
        value: cat.id,
        selected: this.selectedCategoryId === cat.id
      });
    });
    return items;
  }

  get departmentDropdownItems(): ListItem[] {
    const items: ListItem[] = [
      { content: 'All Departments', value: '', selected: this.selectedDepartmentId === '' }
    ];
    this.departments.forEach(dept => {
      items.push({
        content: dept.name,
        value: dept.id,
        selected: this.selectedDepartmentId === dept.id
      });
    });
    return items;
  }

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Register Carbon icons
    this.iconService.registerAll([
      ArrowLeft,
      Document,
      DocumentBlank,
      Star16,
      Star20,
      StarFilled,
      Pin,
      PinFilled,
      TrashCan,
      View,
      Settings,
      Checkmark,
      Category,
      Filter
    ]);

    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Load row size preference from localStorage (only in browser)
    if (isPlatformBrowser(this.platformId)) {
      const savedRowSize = localStorage.getItem('tableRowSize') as 'xs' | 'sm' | 'md' | 'lg';
      if (savedRowSize && ['xs', 'sm', 'md', 'lg'].includes(savedRowSize)) {
        this.tableRowSize = savedRowSize;
      }
    }

    // Initialize pagination model
    this.paginationModel.currentPage = 1;
    this.paginationModel.pageLength = 6;  // Match my-dashboard
    this.paginationModel.totalDataLength = 0;

    this.route.params.subscribe(params => {
      this.hubId = params['hubId'];
      this.loadHubReports();
    });

    // Set up search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.paginationModel.currentPage = 1;
      this.isLoading = true;
      this.buildTable();
      setTimeout(() => {
        this.isLoading = false;
      }, 200);
    });
  }

  ngAfterViewInit(): void {
    // Templates are now available, rebuild the table if data already loaded
    if (this.reports.length > 0) {
      this.buildTable();
    }
  }

  loadHubReports(): void {
    this.isLoading = true;

    // Load hub details, reports, categories, and departments
    forkJoin({
      hub: this.contentService.getHubById(this.hubId),
      reports: this.contentService.getReports(undefined, this.hubId),
      categories: this.contentService.getReportGroups(this.hubId),
      departments: this.contentService.getDepartments()
    }).subscribe({
      next: ({ hub, reports, categories, departments }) => {
        if (!hub) {
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
          return;
        }

        this.hubName = hub.name;
        this.hubDescription = hub.description;
        this.categories = categories.filter(c => c.isActive);
        this.departments = departments.filter(d => d.isActive);

        // Create lookup maps for category and department names
        const categoryMap = new Map(this.categories.map(c => [c.id, c.name]));
        const departmentMap = new Map(this.departments.map(d => [d.id, d.name]));

        // Convert Report to HubReport format with category and department info
        this.reports = reports.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          type: r.type,
          route: `/hub/${this.hubId}/report/${r.id}`,
          embedConfig: r.embedConfig,
          categoryId: r.reportGroupId,
          categoryName: categoryMap.get(r.reportGroupId) || 'Uncategorized',
          departmentIds: r.departmentIds || [],
          departmentNames: (r.departmentIds || []).map(id => departmentMap.get(id) || '').filter(n => n)
        }));

        this.buildTable();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      }
    });
  }

  onCategoryFilterChange(event: any): void {
    this.selectedCategoryId = event?.item?.value || '';
    this.paginationModel.currentPage = 1;
    this.buildTable();
  }

  onDepartmentFilterChange(event: any): void {
    this.selectedDepartmentId = event?.item?.value || '';
    this.paginationModel.currentPage = 1;
    this.buildTable();
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildTable(): void {
    // Filter reports based on search query, category, and department
    let filteredReports = this.reports;

    // Apply category filter
    if (this.selectedCategoryId) {
      filteredReports = filteredReports.filter(report =>
        report.categoryId === this.selectedCategoryId
      );
    }

    // Apply department filter
    if (this.selectedDepartmentId) {
      filteredReports = filteredReports.filter(report =>
        report.departmentIds.includes(this.selectedDepartmentId)
      );
    }

    // Apply search query (includes category and department names)
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredReports = filteredReports.filter(report =>
        report.name.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.type.toLowerCase().includes(query) ||
        report.categoryName.toLowerCase().includes(query) ||
        report.departmentNames.some(d => d.toLowerCase().includes(query))
      );
    }

    // Store all filtered reports for pagination
    this.allReports = filteredReports;

    // Update pagination model total
    this.paginationModel.totalDataLength = filteredReports.length;

    // Calculate pagination
    const startIndex = (this.paginationModel.currentPage - 1) * (this.paginationModel.pageLength || 6);
    const endIndex = startIndex + (this.paginationModel.pageLength || 6);
    const paginatedReports = filteredReports.slice(startIndex, endIndex);

    // Set table headers
    this.tableModel.header = [
      new TableHeaderItem({
        data: 'Report',
        sortable: true,
        compare: (a: any, b: any) => a.data.name.localeCompare(b.data.name)
      }),
      new TableHeaderItem({
        data: 'Category',
        sortable: true,
        compare: (a: any, b: any) => a.data.categoryName.localeCompare(b.data.categoryName)
      }),
      new TableHeaderItem({
        data: 'Description',
        sortable: true,
        compare: (a: any, b: any) => (a.data || '').localeCompare(b.data || '')
      }),
      new TableHeaderItem({
        data: 'Type',
        sortable: true,
        compare: (a: any, b: any) => a.data.type.localeCompare(b.data.type)
      }),
      new TableHeaderItem({
        data: 'Actions',
        sortable: false
      })
    ];

    // Set table data
    this.tableModel.data = paginatedReports.map(report => [
      new TableItem({ data: report, template: this.reportNameTemplate }),
      new TableItem({ data: report, template: this.categoryTemplate }),
      new TableItem({ data: report.description, template: this.descriptionTemplate }),
      new TableItem({ data: report, template: this.typeTemplate }),
      new TableItem({ data: report, template: this.actionsTemplate })
    ]);
  }

  onPageChange(page: number): void {
    this.paginationModel.currentPage = page;
    this.isLoading = true;
    this.buildTable();
    setTimeout(() => {
      this.isLoading = false;
    }, 200);
  }

  setRowSize(size: 'xs' | 'sm' | 'md' | 'lg'): void {
    this.tableRowSize = size;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('tableRowSize', size);
    }
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  isFavorite(reportId: string): boolean {
    return this.personalDashboardService.isFavorite(reportId);
  }

  toggleFavorite(reportId: string): void {
    const report = this.reports.find(r => r.id === reportId);
    const reportName = report?.name || 'Report';

    if (this.isFavorite(reportId)) {
      this.personalDashboardService.removeFavorite(reportId);
      this.notificationService.info('Removed from Favorites', `${reportName} has been removed from your favorites`);
    } else {
      this.personalDashboardService.addFavorite(reportId);
      this.notificationService.success('Added to Favorites', `${reportName} has been added to your favorites`);
    }
  }

  isPinned(reportId: string): boolean {
    return this.quickAccessService.isPinned(reportId);
  }

  togglePin(reportId: string): void {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return;

    const reportName = report.name;

    if (this.isPinned(reportId)) {
      this.quickAccessService.unpinReport(reportId);
      this.notificationService.info('Removed from Quick Access', `${reportName} has been removed from quick access`);
    } else {
      this.quickAccessService.pinReport(report, this.hubId, this.hubName);
      this.notificationService.success('Added to Quick Access', `${reportName} has been added to quick access`);
    }
  }
}
