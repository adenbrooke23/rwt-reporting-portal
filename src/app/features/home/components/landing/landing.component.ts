import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { AnnouncementService } from '../../../../core/services/announcement.service';
import { AnnouncementSummary } from '../../../../core/models/announcement.model';

@Component({
  selector: 'app-landing',
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private announcementService = inject(AnnouncementService);
  private router = inject(Router);

  private subscriptions: Subscription[] = [];

  currentUser = this.authService.getCurrentUser();
  announcements: AnnouncementSummary[] = [];
  isLoading = true;

  ngOnInit(): void {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadAnnouncements();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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

  getUserName(): string {
    if (!this.currentUser) return 'User';
    if (this.currentUser.firstName) {
      return this.currentUser.firstName;
    }
    return this.currentUser.username;
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToUpdates(): void {
    this.router.navigate(['/updates']);
  }
}
