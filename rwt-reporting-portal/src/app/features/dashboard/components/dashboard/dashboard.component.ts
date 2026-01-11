import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { AnnouncementService } from '../../../../core/services/announcement.service';
import { UserStatsService } from '../../../../core/services/user-stats.service';
import { HubService } from '../../services/hub.service';
import { Announcement, AnnouncementSummary } from '../../../../core/models/announcement.model';
import { QuickStat } from '../../../../core/models/user-stats.model';
import { ModalModule, ButtonModule } from 'carbon-components-angular';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';

interface HubDisplay {
  id: string;
  name: string;
  description: string;
  reportCount: number;
  icon: string;
  colorClass: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, ModalModule, ButtonModule, MarkdownPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private announcementService = inject(AnnouncementService);
  private userStatsService = inject(UserStatsService);
  private hubService = inject(HubService);
  private platformId = inject(PLATFORM_ID);

  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  currentUser = this.authService.getCurrentUser();
  hubs: HubDisplay[] = [];
  announcements: AnnouncementSummary[] = [];
  quickStats: QuickStat[] = [];
  isLoading = true;

  showAnnouncementModal = false;
  selectedAnnouncement: Announcement | null = null;

  skeletonHubs = Array(4).fill(null);
  skeletonAnnouncements = Array(4).fill(null);

  ngOnInit(): void {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

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
      this.loadHubs();
      this.loadAnnouncements();
      this.loadQuickStats();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuickStats(): void {
    // Subscribe to live updates for quick stats (updates when favorites change)
    const sub = this.userStatsService.getQuickStatsLive().subscribe({
      next: (stats) => {
        this.quickStats = stats;
      }
    });
    this.subscriptions.push(sub);
  }

  loadHubs(): void {
    // Load accessible hubs from real API based on user permissions
    console.log('[DEBUG] Loading accessible hubs from API...');
    const sub = this.hubService.getAccessibleHubs().subscribe({
      next: (hubs) => {
        console.log('[DEBUG] Accessible hubs loaded:', hubs);
        this.hubs = hubs.map(hub => ({
          id: hub.hubId.toString(),
          name: hub.hubName,
          description: hub.description || '',
          reportCount: hub.reportCount || 0,
          icon: hub.iconName || 'folder',
          colorClass: this.getHubColorClass(hub.hubCode)
        }));
      },
      error: (err) => {
        console.error('[DEBUG] Error loading hubs:', err);
        this.hubs = [];
      }
    });
    this.subscriptions.push(sub);
  }

  /**
   * Get color class based on hub code for visual distinction
   */
  private getHubColorClass(hubCode: string): string {
    const colorMap: Record<string, string> = {
      'SEQUOIA': 'sequoia',
      'COREVEST': 'corevest',
      'ENTERPRISE': 'enterprise',
      'ASPIRE': 'aspire'
    };
    return colorMap[hubCode?.toUpperCase()] || 'default';
  }

  getUserName(): string {
    if (!this.currentUser) return 'User';
    if (this.currentUser.firstName) {
      return this.currentUser.firstName;
    }
    return this.currentUser.username;
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  loadAnnouncements(): void {
    const sub = this.announcementService.getPublishedAnnouncements().subscribe({
      next: (announcements) => {
        this.announcements = announcements;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
    this.subscriptions.push(sub);
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
}
