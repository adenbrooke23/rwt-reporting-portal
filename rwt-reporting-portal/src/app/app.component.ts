import { Component, OnInit, inject, ViewChild } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IdleTimeoutService } from './core/services/idle-timeout.service';
import { AuthService } from './features/auth/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { IdleWarningModalComponent } from './shared/components/idle-warning-modal/idle-warning-modal.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { GlobalHeaderComponent } from './shared/components/global-header/global-header.component';
import { ToastNotificationComponent } from './shared/components/toast-notification/toast-notification.component';
import { ConfirmationNotificationComponent } from './shared/components/confirmation-notification/confirmation-notification.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, IdleWarningModalComponent, SidebarComponent, GlobalHeaderComponent, ToastNotificationComponent, ConfirmationNotificationComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private idleTimeoutService = inject(IdleTimeoutService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  @ViewChild(SidebarComponent) sidebarComponent!: SidebarComponent;

  title = 'rwt-reporting-portal';
  showIdleWarning = false;
  remainingSeconds = 0;
  isAuthenticated = false;
  isLoading = true;
  sidebarOpen = true; // Start with sidebar expanded (Carbon pattern)

  constructor() {
    // Initialize auth state synchronously to prevent flash
    const authState = this.authService.getCurrentAuthState();
    this.isAuthenticated = authState.isAuthenticated;
  }

  get showHeader(): boolean {
    // Check if we're on any login route (including with query params like /login?admin=true)
    const isLoginPage = this.router.url.startsWith('/login');
    return !this.isLoading && this.isAuthenticated && !isLoginPage;
  }

  onMenuToggle(): void {
    if (this.sidebarComponent) {
      this.sidebarComponent.toggleSidebar();
    }
  }

  ngOnInit(): void {
    // Initialize theme service and listen to system theme changes
    this.themeService.initSystemThemeListener();

    // Mark as loaded after a brief delay to prevent flash
    setTimeout(() => {
      this.isLoading = false;
    }, 0);

    // Auth and idle timeout setup
    this.authService.authState$.subscribe(state => {
      this.isAuthenticated = state.isAuthenticated;

      if (state.isAuthenticated) {
        this.idleTimeoutService.startWatching();
      } else {
        this.idleTimeoutService.stopWatching();
        this.showIdleWarning = false;
      }
    });

    this.idleTimeoutService.warning$.subscribe(remainingSeconds => {
      this.showIdleWarning = true;
      this.remainingSeconds = remainingSeconds;
    });

    this.idleTimeoutService.logout$.subscribe(() => {
      this.showIdleWarning = false;
      this.authService.logout();
      this.router.navigate(['/login']);
    });
  }

  onStayActive(): void {
    this.showIdleWarning = false;
    this.idleTimeoutService.resetActivity();
  }

  onSidebarToggle(isOpen: boolean): void {
    this.sidebarOpen = isOpen;
  }
}
