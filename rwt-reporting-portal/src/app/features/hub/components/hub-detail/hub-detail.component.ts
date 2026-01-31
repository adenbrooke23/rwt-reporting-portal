import { Component, OnInit, AfterViewInit, inject, TemplateRef, ViewChild, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { HubService } from '../../../dashboard/services/hub.service';
import { PersonalDashboardService } from '../../../dashboard/services/personal-dashboard.service';
import { QuickAccessService } from '../../../../core/services/quick-access.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TilesModule, IconModule, IconService, ButtonModule, TableModule, TagModule, SearchModule, PaginationModule, DialogModule, DropdownModule, BreadcrumbModule, ListItem, Table, TableModel, TableHeaderItem, TableItem, PaginationModel } from 'carbon-components-angular';
import { ReportType } from '../../../auth/models/user-management.models';

interface HubReport {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  route: string;
  categoryId: string;
  categoryName: string;
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
  imports: [CommonModule, RouterLink, TilesModule, IconModule, ButtonModule, TableModule, TagModule, SearchModule, PaginationModule, DialogModule, DropdownModule, BreadcrumbModule],
  templateUrl: './hub-detail.component.html',
  styleUrl: './hub-detail.component.scss'
})
export class HubDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private hubService = inject(HubService);
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

  categories: { id: string; name: string }[] = [];
  selectedCategoryId: string = '';

  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5);
  isLoading = true;
  searchQuery = '';
  tableRowSize: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  paginationModel: PaginationModel = new PaginationModel();
  allReports: HubReport[] = [];

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

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {

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

    if (isPlatformBrowser(this.platformId)) {
      const savedRowSize = localStorage.getItem('tableRowSize') as 'xs' | 'sm' | 'md' | 'lg';
      if (savedRowSize && ['xs', 'sm', 'md', 'lg'].includes(savedRowSize)) {
        this.tableRowSize = savedRowSize;
      }
    }

    this.paginationModel.currentPage = 1;
    this.paginationModel.pageLength = 6;
    this.paginationModel.totalDataLength = 0;

    this.route.params.subscribe(params => {
      this.hubId = params['hubId'];
      this.loadHubReports();
    });

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

    if (this.reports.length > 0) {
      this.buildTable();
    }
  }

  loadHubReports(): void {
    this.isLoading = true;

    this.hubService.getHubDetail(this.hubId).subscribe({
      next: (hubDetail) => {
        if (!hubDetail) {
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
          return;
        }

        this.hubName = hubDetail.hubName;
        this.hubDescription = hubDetail.description || '';

        const categorySet = new Map<number, string>();
        hubDetail.reports.forEach(r => {
          if (r.groupId && r.groupName) {
            categorySet.set(r.groupId, r.groupName);
          }
        });
        this.categories = Array.from(categorySet.entries()).map(([id, name]) => ({
          id: id.toString(),
          name
        }));

        this.reports = hubDetail.reports.map(r => ({
          id: r.reportId.toString(),
          name: r.reportName,
          description: r.description || '',
          type: r.reportType as ReportType,
          route: `/hub/${this.hubId}/report/${r.reportId}`,
          categoryId: r.groupId.toString(),
          categoryName: r.groupName || 'Uncategorized'
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

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildTable(): void {

    let filteredReports = this.reports;

    if (this.selectedCategoryId) {
      filteredReports = filteredReports.filter(report =>
        report.categoryId === this.selectedCategoryId
      );
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredReports = filteredReports.filter(report =>
        report.name.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.type.toLowerCase().includes(query) ||
        report.categoryName.toLowerCase().includes(query)
      );
    }

    this.allReports = filteredReports;

    this.paginationModel.totalDataLength = filteredReports.length;

    const startIndex = (this.paginationModel.currentPage - 1) * (this.paginationModel.pageLength || 6);
    const endIndex = startIndex + (this.paginationModel.pageLength || 6);
    const paginatedReports = filteredReports.slice(startIndex, endIndex);

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
    return this.personalDashboardService.isFavorite(parseInt(reportId, 10));
  }

  toggleFavorite(reportId: string): void {
    const report = this.reports.find(r => r.id === reportId);
    const reportName = report?.name || 'Report';
    const reportIdNum = parseInt(reportId, 10);

    if (this.isFavorite(reportId)) {
      this.personalDashboardService.removeFavorite(reportIdNum)
        .subscribe({
          next: () => {
            this.notificationService.info('Removed from Favorites', `${reportName} has been removed from your favorites`);
          },
          error: () => {
            this.notificationService.error('Error', 'Failed to remove from favorites');
          }
        });
    } else {
      this.personalDashboardService.addFavorite(reportIdNum)
        .subscribe({
          next: () => {
            this.notificationService.success('Added to Favorites', `${reportName} has been added to your favorites`);
          },
          error: () => {
            this.notificationService.error('Error', 'Failed to add to favorites');
          }
        });
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
