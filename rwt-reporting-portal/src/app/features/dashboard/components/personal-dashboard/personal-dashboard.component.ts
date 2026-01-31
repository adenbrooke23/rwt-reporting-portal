import { Component, OnInit, AfterViewInit, inject, TemplateRef, ViewChild, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { PersonalDashboardService } from '../../services/personal-dashboard.service';
import { FavoriteReport } from '../../../../core/services/favorites-api.service';
import { QuickAccessService } from '../../../../core/services/quick-access.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonModule, IconModule, IconService, TableModule, TagModule, SearchModule, DialogModule, PaginationModule, BreadcrumbModule, Table, TableModel, TableHeaderItem, TableItem, PaginationModel } from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import Document from '@carbon/icons/es/document/16';
import Star from '@carbon/icons/es/star/20';
import StarFilled from '@carbon/icons/es/star--filled/20';
import Pin from '@carbon/icons/es/pin/16';
import PinFilled from '@carbon/icons/es/pin--filled/16';
import TrashCan from '@carbon/icons/es/trash-can/16';
import OverflowMenuVertical from '@carbon/icons/es/overflow-menu--vertical/16';
import View from '@carbon/icons/es/view/16';
import Settings from '@carbon/icons/es/settings/16';
import Checkmark from '@carbon/icons/es/checkmark/16';

@Component({
  selector: 'app-personal-dashboard',
  imports: [CommonModule, ButtonModule, IconModule, TableModule, TagModule, SearchModule, DialogModule, PaginationModule, BreadcrumbModule],
  templateUrl: './personal-dashboard.component.html',
  styleUrl: './personal-dashboard.component.scss'
})
export class PersonalDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private personalDashboardService = inject(PersonalDashboardService);
  private quickAccessService = inject(QuickAccessService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private iconService = inject(IconService);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('reportNameTemplate', { static: false }) reportNameTemplate!: TemplateRef<any>;
  @ViewChild('hubTemplate', { static: false }) hubTemplate!: TemplateRef<any>;
  @ViewChild('descriptionTemplate', { static: false }) descriptionTemplate!: TemplateRef<any>;
  @ViewChild('typeTemplate', { static: false }) typeTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate', { static: false }) actionsTemplate!: TemplateRef<any>;

  currentUser = this.authService.getCurrentUser();
  favorites: FavoriteReport[] = [];
  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5);
  isLoading = true;
  totalFavoritesCount = 0;
  searchQuery = '';
  tableRowSize: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  paginationModel: PaginationModel = new PaginationModel();
  allReports: FavoriteReport[] = [];

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.iconService.registerAll([ArrowLeft, Document, Star, StarFilled, Pin, PinFilled, TrashCan, OverflowMenuVertical, View, Settings, Checkmark]);

    if (isPlatformBrowser(this.platformId)) {
      const savedRowSize = localStorage.getItem('tableRowSize') as 'xs' | 'sm' | 'md' | 'lg';
      if (savedRowSize && ['xs', 'sm', 'md', 'lg'].includes(savedRowSize)) {
        this.tableRowSize = savedRowSize;
      }
    }

    this.paginationModel.currentPage = 1;
    this.paginationModel.pageLength = 6;
    this.paginationModel.totalDataLength = 0;

    // Subscribe to favorites updates
    this.personalDashboardService.favorites$
      .pipe(takeUntil(this.destroy$))
      .subscribe(favorites => {
        this.favorites = favorites;
        this.totalFavoritesCount = favorites.length;
        this.buildTables();
      });

    // Load favorites from API
    this.personalDashboardService.loadFavorites()
      .pipe(takeUntil(this.destroy$))
      .subscribe();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.paginationModel.currentPage = 1;
      this.buildTables();
    });
  }

  ngAfterViewInit(): void {
    // Build tables after view initializes (templates are ready)
    setTimeout(() => {
      this.buildTables();
      this.isLoading = false;
    }, 300);
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildTables(): void {
    let filteredReports = [...this.favorites];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredReports = this.favorites.filter(report =>
        report.reportName.toLowerCase().includes(query) ||
        report.hubName.toLowerCase().includes(query) ||
        (report.description || '').toLowerCase().includes(query) ||
        report.reportType.toLowerCase().includes(query)
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
        compare: (a: any, b: any) => a.data.reportName.localeCompare(b.data.reportName)
      }),
      new TableHeaderItem({
        data: 'Hub',
        sortable: true,
        compare: (a: any, b: any) => a.data.localeCompare(b.data)
      }),
      new TableHeaderItem({
        data: 'Description',
        sortable: true,
        compare: (a: any, b: any) => (a.data || '').localeCompare(b.data || '')
      }),
      new TableHeaderItem({
        data: 'Type',
        sortable: true,
        compare: (a: any, b: any) => a.data.reportType.localeCompare(b.data.reportType)
      }),
      new TableHeaderItem({
        data: 'Actions',
        sortable: false
      })
    ];

    this.tableModel.data = paginatedReports.map(report => [
      new TableItem({ data: report, template: this.reportNameTemplate }),
      new TableItem({ data: report.hubName, template: this.hubTemplate }),
      new TableItem({ data: report.description || '', template: this.descriptionTemplate }),
      new TableItem({ data: report, template: this.typeTemplate }),
      new TableItem({ data: report, template: this.actionsTemplate })
    ]);
  }

  onPageChange(page: number): void {
    this.paginationModel.currentPage = page;
    this.buildTables();
  }

  removeFavorite(reportId: number): void {
    const report = this.favorites.find(r => r.reportId === reportId);
    const reportName = report?.reportName || 'Report';

    this.personalDashboardService.removeFavorite(reportId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.info('Removed from Favorites', `${reportName} has been removed from your favorites`);
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to remove favorite');
        }
      });
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  getHubColorClass(hubName: string): string {
    const colorMap: Record<string, string> = {
      'Sequoia': 'sequoia',
      'CoreVest': 'corevest',
      'Enterprise': 'enterprise',
      'Aspire': 'aspire'
    };
    return colorMap[hubName] || 'default';
  }

  isPinned(reportId: number): boolean {
    return this.quickAccessService.isPinned(reportId.toString());
  }

  togglePin(report: FavoriteReport): void {
    const reportIdStr = report.reportId.toString();

    // Create a SubReport-like object for the QuickAccessService
    // Need to derive the hub slug from the hub name for the route
    const hubSlug = report.hubName.toLowerCase().replace(/\s+/g, '-');
    const subReport = {
      id: reportIdStr,
      name: report.reportName,
      description: report.description || '',
      type: report.reportType as 'SSRS' | 'PowerBI',
      route: `/hub/${hubSlug}/report/${report.reportId}`
    };

    if (this.isPinned(report.reportId)) {
      this.quickAccessService.unpinReport(reportIdStr);
      this.notificationService.info('Removed from Quick Access', `${report.reportName} has been removed from quick access`);
    } else {
      this.quickAccessService.pinReport(subReport, report.hubName, report.hubName);
      this.notificationService.success('Added to Quick Access', `${report.reportName} has been added to quick access`);
    }
  }

  setRowSize(size: 'xs' | 'sm' | 'md' | 'lg'): void {
    this.tableRowSize = size;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('tableRowSize', size);
    }
  }

  viewReport(report: FavoriteReport): void {
    // Navigate to the report viewer
    // We need to find the hub ID - for now use the hub name as identifier
    this.router.navigate(['/hub', report.hubName.toLowerCase().replace(/\s+/g, '-'), 'report', report.reportId]);
  }
}
