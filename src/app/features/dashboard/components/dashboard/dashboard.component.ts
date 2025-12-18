import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { AnnouncementService } from '../../../../core/services/announcement.service';
import { UserStatsService } from '../../../../core/services/user-stats.service';
import { ContentManagementService } from '../../../admin/services/content-management.service';
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
  private contentService = inject(ContentManagementService);

  private subscriptions: Subscription[] = [];

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

    this.loadHubs();
    this.loadAnnouncements();
    this.loadQuickStats();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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
    // Load available reporting hubs from ContentManagementService
    const sub = this.contentService.getHubs().subscribe({
      next: (hubs) => {
        this.hubs = hubs.map(hub => ({
          id: hub.id,
          name: hub.name,
          description: hub.description,
          reportCount: hub.reportCount || 0,
          icon: hub.iconName || 'folder',
          colorClass: hub.colorClass || 'default'
        }));
      },
      error: () => {
        // Fallback to empty array on error
        this.hubs = [];
      }
    });
    this.subscriptions.push(sub);
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
