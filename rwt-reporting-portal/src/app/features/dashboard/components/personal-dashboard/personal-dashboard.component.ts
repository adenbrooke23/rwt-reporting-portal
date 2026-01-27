import { Component, OnInit, AfterViewInit, inject, TemplateRef, ViewChild, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
  private platformId = inject(PLATFORM_ID);

  @ViewChild('reportNameTemplate', { static: false }) reportNameTemplate!: TemplateRef<any>;
  @ViewChild('hubTemplate', { static: false }) hubTemplate!: TemplateRef<any>;
  @ViewChild('descriptionTemplate', { static: false }) descriptionTemplate!: TemplateRef<any>;
  @ViewChild('typeTemplate', { static: false }) typeTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate', { static: false }) actionsTemplate!: TemplateRef<any>;

  currentUser = this.authService.getCurrentUser();
  favoritesByCategory: FavoriteReportsByCategory[] = [];
  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5);
  isLoading = true;
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

    this.favoritesByCategory = this.personalDashboardService.getFavoriteReportsByCategory();
    this.totalFavoritesCount = this.favoritesByCategory.reduce((sum, category) => sum + category.reports.length, 0);

    this.personalDashboardService.favorites$.subscribe(() => {
      this.loadFavorites();
    });

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

    this.buildTables();

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

    const allReports = this.favoritesByCategory.flatMap(category =>
      category.reports.map(report => ({
        ...report,
        categoryId: category.categoryId,
        categoryName: category.categoryName
      }))
    );

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

    setTimeout(() => {
      this.isLoading = false;
    }, 200);
  }

  removeFavorite(reportId: string): void {

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
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('tableRowSize', size);
    }
  }
}
