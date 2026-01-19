import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../features/auth/services/auth.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { getAvatarById } from '../../../core/config/avatars.config';
import { UserProfile } from '../../../features/auth/models/user-management.models';
import { NotificationService } from '../../../core/services/notification.service';
import { IconModule, IconService } from 'carbon-components-angular';
import Search from '@carbon/icons/es/search/20';
import Notification from '@carbon/icons/es/notification/20';
import Settings from '@carbon/icons/es/settings/20';
import Logout from '@carbon/icons/es/logout/20';
import ChevronDown from '@carbon/icons/es/chevron--down/20';

@Component({
  selector: 'app-header',
  imports: [CommonModule, ThemeToggleComponent, IconModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private iconService = inject(IconService);
  private notificationService = inject(NotificationService);

  currentUser = this.authService.getCurrentUser();
  isProfileDropdownOpen = false;

  constructor() {
    // Register Carbon icons
    this.iconService.registerAll([Search, Notification, Settings, Logout, ChevronDown]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getInitials(): string {
    if (!this.currentUser) return '';

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
    if (!this.currentUser) return '';

    const userProfile = this.currentUser as UserProfile;

    // Use displayName if available
    if (userProfile.displayName) {
      return userProfile.displayName;
    }

    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else {
      return this.currentUser.username;
    }
  }

  getAvatarEmoji(): string {
    if (!this.currentUser) return '👤';

    const userProfile = this.currentUser as UserProfile;
    if (userProfile.avatarId) {
      const avatar = getAvatarById(userProfile.avatarId);
      return avatar?.emoji || '👤';
    }

    return '👤';
  }

  navigateToSettings(): void {
    this.isProfileDropdownOpen = false;
    this.router.navigate(['/settings']);
  }

  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }

  closeProfileDropdown(): void {
    this.isProfileDropdownOpen = false;
  }

  handleSearch(): void {
    // TODO: Implement global search functionality
  }

  handleNotifications(): void {
    // Show example notifications
    const examples = [
      { type: 'info', title: 'New Report Available', message: 'The Q4 Financial Report is now ready to view' },
      { type: 'success', title: 'Export Complete', message: 'Your data export has been successfully generated' },
      { type: 'warning', title: 'Scheduled Maintenance', message: 'System will be down for maintenance on Sunday at 2 AM' }
    ];

    const random = examples[Math.floor(Math.random() * examples.length)];

    switch (random.type) {
      case 'info':
        this.notificationService.info(random.title, random.message);
        break;
      case 'success':
        this.notificationService.success(random.title, random.message);
        break;
      case 'warning':
        this.notificationService.warning(random.title, random.message);
        break;
    }
  }

  getEmail(): string {
    return this.currentUser?.email || '';
  }
}
