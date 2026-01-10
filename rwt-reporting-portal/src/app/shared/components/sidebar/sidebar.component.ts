import { Component, inject, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../features/auth/services/auth.service';
import { QuickAccessService } from '../../../core/services/quick-access.service';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { SideNavModule, IconModule, IconService } from 'carbon-components-angular';
import Home from '@carbon/icons/es/home/16';
import Star from '@carbon/icons/es/star/16';
import Dashboard from '@carbon/icons/es/dashboard/16';
import UserMultiple from '@carbon/icons/es/user--multiple/16';
import UserAvatar from '@carbon/icons/es/user--avatar/16';
import Logout from '@carbon/icons/es/logout/16';
import ColorPalette from '@carbon/icons/es/color-palette/16';
import Notification from '@carbon/icons/es/notification/16';
import Folder from '@carbon/icons/es/folder/16';
import Document from '@carbon/icons/es/document/16';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, SideNavModule, IconModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private quickAccessService = inject(QuickAccessService);
  private announcementService = inject(AnnouncementService);
  private router = inject(Router);
  private iconService = inject(IconService);

  private subscriptions: Subscription[] = [];

  @Output() sidebarToggled = new EventEmitter<boolean>();

  isExpanded = true; // Start expanded (Carbon pattern)
  isAdmin = false;
  currentUser = this.authService.getCurrentUser();
  unreadCount = 0;

  quickAccessItems: { label: string; route: string }[] = [];

  quickAccessExpanded = false;
  adminExpanded = false;

  // Store previous expansion states to restore when sidenav re-expands
  private savedQuickAccessExpanded = false;
  private savedAdminExpanded = false;

  ngOnInit(): void {
    // Emit initial sidebar state
    this.sidebarToggled.emit(this.isExpanded);

    // Register Carbon icons (16px for sidenav)
    this.iconService.registerAll([
      Home,
      Star,
      Dashboard,
      UserMultiple,
      UserAvatar,
      Logout,
      ColorPalette,
      Notification,
      Folder,
      Document
    ]);

    // Subscribe to pinned reports and build Quick Access menu
    this.quickAccessService.pinnedReports$.subscribe(() => {
      this.buildQuickAccessMenu();
    });

    // Check if user is admin (case-insensitive)
    const authSub = this.authService.authState$.subscribe(state => {
      console.log('SIDEBAR RECEIVED:', state.user?.roles);
      this.isAdmin = state.user?.roles?.some(
        role => role.toLowerCase() === 'admin'
      ) || false;
      console.log('SIDEBAR isAdmin:', this.isAdmin);
    });
    this.subscriptions.push(authSub);

    // Subscribe to unread announcement count
    if (this.currentUser?.id) {
      const unreadSub = this.announcementService.getUnreadCount(this.currentUser.id).subscribe(count => {
        this.unreadCount = count;
      });
      this.subscriptions.push(unreadSub);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  buildQuickAccessMenu(): void {
    const pinnedReports = this.quickAccessService.getPinnedReports();
    this.quickAccessItems = pinnedReports.map(pr => ({
      label: pr.report.name,
      route: pr.report.route
    }));
  }

  toggleSidebar(): void {
    if (this.isExpanded) {
      // Collapsing: save current menu states and collapse all menus
      this.savedQuickAccessExpanded = this.quickAccessExpanded;
      this.savedAdminExpanded = this.adminExpanded;
      this.quickAccessExpanded = false;
      this.adminExpanded = false;
    } else {
      // Expanding: restore previous menu states
      this.quickAccessExpanded = this.savedQuickAccessExpanded;
      this.adminExpanded = this.savedAdminExpanded;
    }

    this.isExpanded = !this.isExpanded;
    this.sidebarToggled.emit(this.isExpanded);
  }

  // Check if route is active (exact match)
  isActive(route: string): boolean {
    return this.router.url === route;
  }

  // Check if route starts with prefix (for nested routes)
  isActiveStartsWith(prefix: string): boolean {
    return this.router.url.startsWith(prefix);
  }

  // Check if any child route in a menu is active
  hasActiveChild(routes: string[]): boolean {
    return routes.some(route => this.router.url === route || this.router.url.startsWith(route + '/'));
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

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
