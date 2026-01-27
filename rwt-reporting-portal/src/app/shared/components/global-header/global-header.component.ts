import { Component, inject, OnInit, OnDestroy, Output, EventEmitter, ViewEncapsulation, Input, HostListener, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../features/auth/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { ThemeModalComponent } from '../theme-modal/theme-modal.component';
import { IconModule, IconService, UIShellModule } from 'carbon-components-angular';
import UserAvatar from '@carbon/icons/es/user--avatar/20';
import Logout from '@carbon/icons/es/logout/20';
import Menu from '@carbon/icons/es/menu/20';
import Notification from '@carbon/icons/es/notification/20';
import { getAvatarById } from '../../../core/config/avatars.config';
import { UserProfile } from '../../../features/auth/models/user-management.models';
import { User } from '../../../features/auth/models/auth.models';

@Component({
  selector: 'app-global-header',
  imports: [CommonModule, UIShellModule, IconModule, ThemeToggleComponent, ProfileModalComponent, ThemeModalComponent],
  templateUrl: './global-header.component.html',
  styleUrl: './global-header.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class GlobalHeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private iconService = inject(IconService);
  private notificationService = inject(NotificationService);
  private announcementService = inject(AnnouncementService);
  private platformId = inject(PLATFORM_ID);

  private subscriptions: Subscription[] = [];

  @Input() sidebarOpen = false;
  @Output() menuToggled = new EventEmitter<void>();

  currentUser: User | null = null;
  showUserMenu = false;
  profileModalOpen = false;
  themeModalOpen = false;
  unreadCount = 0;

  ngOnInit(): void {
    this.iconService.registerAll([
      UserAvatar,
      Logout,
      Menu,
      Notification
    ]);

    const authSub = this.authService.authState$.subscribe(state => {
      this.currentUser = state.user;
      if (state.user?.id) {
        this.loadUnreadCount(state.user.id);
      }
    });
    this.subscriptions.push(authSub);

    if (this.currentUser?.id) {
      this.loadUnreadCount(this.currentUser.id);
    }
  }

  private loadUnreadCount(userId: string): void {
    const sub = this.announcementService.getUnreadCount(userId).subscribe(count => {
      this.unreadCount = count;
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  toggleMenu(): void {
    this.menuToggled.emit();
  }

  goToUpdates(): void {
    this.router.navigate(['/updates']);
  }

  onProfileMenuToggle(active: boolean): void {
    this.showUserMenu = active;
  }

  closeProfileMenu(): void {
    this.showUserMenu = false;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showUserMenu) {
      this.closeProfileMenu();
    }
  }

  openProfileModal(): void {
    this.closeProfileMenu();
    this.profileModalOpen = true;
  }

  closeProfileModal(): void {
    this.profileModalOpen = false;

  }

  openThemeModal(): void {
    this.closeProfileMenu();
    this.themeModalOpen = true;
  }

  closeThemeModal(): void {
    this.themeModalOpen = false;
  }

  openHelp(): void {
    this.closeProfileMenu();
    this.notificationService.info(
      'Help',
      'Help documentation will be available soon. For urgent issues, please contact IT support.'
    );
  }

  getCompany(): string {
    if (!this.currentUser) return 'Redwood Trust';

    const userProfile = this.currentUser as UserProfile;
    const groups = userProfile.groups || [];

    if (groups.some(g => g.toLowerCase().includes('corevest'))) {
      return 'CoreVest';
    }
    if (groups.some(g => g.toLowerCase().includes('aspire'))) {
      return 'Aspire';
    }
    return 'Redwood Trust';
  }

  getInitials(): string {
    if (!this.currentUser) return 'U';

    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';

    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    } else if (this.currentUser.username) {
      return this.currentUser.username.substring(0, 2).toUpperCase();
    }

    return 'U';
  }

  getFullName(): string {
    if (!this.currentUser) return 'Guest';

    if (this.currentUser.displayName) {
      return this.currentUser.displayName;
    }

    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (this.currentUser.email) {

      return this.currentUser.email.split('@')[0];
    } else {
      return this.currentUser.username || 'User';
    }
  }

  getCurrentAvatar() {
    if (!this.currentUser) return null;

    const userProfile = this.currentUser as UserProfile;
    if (userProfile.avatarId) {
      return getAvatarById(userProfile.avatarId);
    }

    return null;
  }

  getAvatarColor(): string {
    const avatar = this.getCurrentAvatar();
    return avatar?.color || '#4589ff';
  }

  isAdmin(): boolean {
    if (!this.currentUser) return false;

    return this.currentUser.roles?.some(
      role => role.toLowerCase() === 'admin'
    ) || false;
  }

  getUserRole(): string {
    if (!this.currentUser || !this.currentUser.roles || this.currentUser.roles.length === 0) {
      return '';
    }

    const primaryRole = this.currentUser.roles[0];
    return primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1);
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
