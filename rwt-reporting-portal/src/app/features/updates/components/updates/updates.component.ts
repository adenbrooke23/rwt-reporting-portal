import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { AnnouncementService } from '../../../../core/services/announcement.service';
import { Announcement, AnnouncementSummary } from '../../../../core/models/announcement.model';
import { ButtonModule, IconModule, IconService, ModalModule, SearchModule, DatePickerModule, DropdownModule, BreadcrumbModule } from 'carbon-components-angular';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import Search from '@carbon/icons/es/search/16';
import Close from '@carbon/icons/es/close/16';

@Component({
  selector: 'app-updates',
  imports: [CommonModule, FormsModule, ButtonModule, IconModule, ModalModule, SearchModule, DatePickerModule, DropdownModule, BreadcrumbModule, MarkdownPipe],
  templateUrl: './updates.component.html',
  styleUrl: './updates.component.scss'
})
export class UpdatesComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private announcementService = inject(AnnouncementService);
  private router = inject(Router);
  private iconService = inject(IconService);

  private subscriptions: Subscription[] = [];

  currentUser = this.authService.getCurrentUser();
  announcements: AnnouncementSummary[] = [];
  filteredAnnouncements: AnnouncementSummary[] = [];
  isLoading = true;

  showAnnouncementModal = false;
  selectedAnnouncement: Announcement | null = null;

  searchTerm = '';
  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedDateRange = 'all';

  dateRangeOptions = [
    { content: 'All time', value: 'all', selected: true },
    { content: 'Last 7 days', value: '7', selected: false },
    { content: 'Last 30 days', value: '30', selected: false },
    { content: 'Last 90 days', value: '90', selected: false },
    { content: 'Custom range', value: 'custom', selected: false }
  ];

  ngOnInit(): void {
    this.iconService.registerAll([ArrowLeft, Search, Close]);

    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadAnnouncements();

    // Mark all announcements as read when viewing the updates page
    this.announcementService.markAllAsRead().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadAnnouncements(): void {
    const sub = this.announcementService.getPublishedAnnouncements().subscribe({
      next: (announcements) => {
        this.announcements = announcements;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
    this.subscriptions.push(sub);
  }

  applyFilters(): void {
    let filtered = [...this.announcements];

    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(term) ||
        a.subtitle.toLowerCase().includes(term) ||
        a.author.toLowerCase().includes(term)
      );
    }

    const { start, end } = this.getDateRange();

    if (start) {
      filtered = filtered.filter(a => {
        const announcementDate = this.parseAnnouncementDate(a.date);
        return announcementDate && announcementDate >= start;
      });
    }

    if (end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(a => {
        const announcementDate = this.parseAnnouncementDate(a.date);
        return announcementDate && announcementDate <= endOfDay;
      });
    }

    this.filteredAnnouncements = filtered;
  }

  getDateRange(): { start: Date | null; end: Date | null } {
    if (this.selectedDateRange === 'custom') {
      return { start: this.startDate, end: this.endDate };
    }

    if (this.selectedDateRange === 'all') {
      return { start: null, end: null };
    }

    const days = parseInt(this.selectedDateRange, 10);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    return { start, end: new Date() };
  }

  parseAnnouncementDate(dateStr: string): Date | null {
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onDateRangeChange(event: any): void {
    this.selectedDateRange = event?.item?.value || 'all';
    if (this.selectedDateRange !== 'custom') {
      this.startDate = null;
      this.endDate = null;
    }
    this.applyFilters();
  }

  onStartDateChange(dates: Date[]): void {
    this.startDate = dates && dates.length > 0 ? dates[0] : null;
    this.applyFilters();
  }

  onEndDateChange(dates: Date[]): void {
    this.endDate = dates && dates.length > 0 ? dates[0] : null;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedDateRange = 'all';
    this.startDate = null;
    this.endDate = null;
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    return !!this.searchTerm || this.selectedDateRange !== 'all';
  }

  openAnnouncement(announcementId: number): void {
    const sub = this.announcementService.getAnnouncementById(announcementId).subscribe({
      next: (announcement) => {
        if (announcement) {
          this.selectedAnnouncement = announcement;
          this.showAnnouncementModal = true;
        }
      }
    });
    this.subscriptions.push(sub);
  }

  closeAnnouncementModal(): void {
    this.showAnnouncementModal = false;
    this.selectedAnnouncement = null;
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
