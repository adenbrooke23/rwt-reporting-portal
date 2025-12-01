import { Component, OnInit, AfterViewInit, inject, TemplateRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { PersonalDashboardService, FavoriteReportsByCategory } from '../../services/personal-dashboard.service';
import { QuickAccessService } from '../../../../core/services/quick-access.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonModule, IconModule, IconService, TableModule, TagModule, SearchModule, DialogModule, PaginationModule, Table, TableModel, TableHeaderItem, TableItem, PaginationModel } from 'carbon-components-angular';
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
  imports: [CommonModule, RouterLink, ButtonModule, IconModule, TableModule, TagModule, SearchModule, DialogModule, PaginationModule],
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

  @ViewChild('reportNameTemplate', { static: false }) reportNameTemplate!: TemplateRef<any>;
  @ViewChild('hubTemplate', { static: false }) hubTemplate!: TemplateRef<any>;
  @ViewChild('descriptionTemplate', { static: false }) descriptionTemplate!: TemplateRef<any>;
  @ViewChild('typeTemplate', { static: false }) typeTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate', { static: false }) actionsTemplate!: TemplateRef<any>;

  currentUser = this.authService.getCurrentUser();
  favoritesByCategory: FavoriteReportsByCategory[] = [];
  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5);  // 6 rows, 5 columns
  isLoading = true;  // Loading state for skeleton
  totalFavoritesCount = 0;
  searchQuery = '';
  tableRowSize: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  paginationModel: PaginationModel = new PaginationModel();
  allReports: any[] = [];

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Register Carbon icons
    this.iconService.registerAll([ArrowLeft, Document, Star, StarFilled, Pin, PinFilled, TrashCan, OverflowMenuVertical, View, Settings, Checkmark]);

    // Load row size preference from localStorage
    const savedRowSize = localStorage.getItem('tableRowSize') as 'xs' | 'sm' | 'md' | 'lg';
    if (savedRowSize && ['xs', 'sm', 'md', 'lg'].includes(savedRowSize)) {
      this.tableRowSize = savedRowSize;
    }

    // Initialize pagination model
    this.paginationModel.currentPage = 1;
    this.paginationModel.pageLength = 6;  // Fixed at 6 items per page
    this.paginationModel.totalDataLength = 0;

    // Load favorites data (but don't build tables yet - templates not ready)
    this.favoritesByCategory = this.personalDashboardService.getFavoriteReportsByCategory();
    this.totalFavoritesCount = this.favoritesByCategory.reduce((sum, category) => sum + category.reports.length, 0);

    // Subscribe to favorites changes
    this.personalDashboardService.favorites$.subscribe(() => {
      this.loadFavorites();
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
      this.buildTables();
      setTimeout(() => {
        this.isLoading = false;
      }, 200);
    });
  }

  ngAfterViewInit(): void {
    // Templates are now available, build the tables
    this.buildTables();
    // Simulate a brief loading period for smooth skeleton transition
    setTimeout(() => {
      this.isLoading = false;
    }, 300);
  }

  loadFavorites(): void {
    this.favoritesByCategory = this.personalDashboardService.getFavoriteReportsByCategory();
    this.totalFavoritesCount = this.favoritesByCategory.reduce((sum, category) => sum + category.reports.length, 0);
    this.buildTables();
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildTables(): void {
    // Flatten all reports from all categories into a single list
    const allReports = this.favoritesByCategory.flatMap(category =>
      category.reports.map(report => ({
        ...report,
        categoryId: category.categoryId,
        categoryName: category.categoryName
      }))
    );

    // Filter reports based on search query
    let filteredReports = allReports;

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredReports = allReports.filter(report =>
        report.name.toLowerCase().includes(query) ||
        report.categoryName.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.type.toLowerCase().includes(query)
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

    // Set table headers with sorting enabled (except Actions column)
    this.tableModel.header = [
      new TableHeaderItem({
        data: 'Report',
        sortable: true,
        compare: (a: any, b: any) => a.data.name.localeCompare(b.data.name)
      }),
      new TableHeaderItem({
        data: 'Hub',
        sortable: true,
        compare: (a: any, b: any) => a.data.localeCompare(b.data)
      }),
      new TableHeaderItem({
        data: 'Description',
        sortable: true,
        compare: (a: any, b: any) => a.data.localeCompare(b.data)
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

    // Set table data with ONLY the current page's reports (6 max)
    this.tableModel.data = paginatedReports.map(report => [
      new TableItem({ data: report, template: this.reportNameTemplate }),
      new TableItem({ data: report.categoryName, template: this.hubTemplate }),
      new TableItem({ data: report.description, template: this.descriptionTemplate }),
      new TableItem({ data: report, template: this.typeTemplate }),
      new TableItem({ data: report, template: this.actionsTemplate })
    ]);
  }

  onPageChange(page: number): void {
    this.paginationModel.currentPage = page;
    this.isLoading = true;
    this.buildTables();
    // Brief loading state for smooth transition
    setTimeout(() => {
      this.isLoading = false;
    }, 200);
  }

  removeFavorite(reportId: string): void {
    // Find the report name before removing
    let reportName = 'Report';
    for (const category of this.favoritesByCategory) {
      const report = category.reports.find(r => r.id === reportId);
      if (report) {
        reportName = report.name;
        break;
      }
    }

    this.personalDashboardService.removeFavorite(reportId);
    this.notificationService.info('Removed from Favorites', `${reportName} has been removed from your favorites`);
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  getCategoryColorClass(categoryId: string): string {
    const colorMap: Record<string, string> = {
      sequoia: 'sequoia',
      corevest: 'corevest',
      enterprise: 'enterprise',
      aspire: 'aspire'
    };
    return colorMap[categoryId] || 'default';
  }

  isPinned(reportId: string): boolean {
    return this.quickAccessService.isPinned(reportId);
  }

  togglePin(reportId: string, categoryId: string, categoryName: string): void {
    // Find the report
    let report = null;
    for (const category of this.favoritesByCategory) {
      const foundReport = category.reports.find(r => r.id === reportId);
      if (foundReport) {
        report = foundReport;
        break;
      }
    }

    if (!report) return;

    const reportName = report.name;

    if (this.isPinned(reportId)) {
      this.quickAccessService.unpinReport(reportId);
      this.notificationService.info('Removed from Quick Access', `${reportName} has been removed from quick access`);
    } else {
      this.quickAccessService.pinReport(report, categoryId, categoryName);
      this.notificationService.success('Added to Quick Access', `${reportName} has been added to quick access`);
    }
  }

  setRowSize(size: 'xs' | 'sm' | 'md' | 'lg'): void {
    this.tableRowSize = size;
    localStorage.setItem('tableRowSize', size);
  }
}
