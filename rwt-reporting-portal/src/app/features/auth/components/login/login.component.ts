import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MockUserService } from '../../services/mock-user.service';
import { IconModule, IconService, NotificationModule } from 'carbon-components-angular';
import ArrowRight from '@carbon/icons/es/arrow--right/16';
import View from '@carbon/icons/es/view/16';
import ViewOff from '@carbon/icons/es/view--off/16';
import Login from '@carbon/icons/es/login/16';
import UserAdmin from '@carbon/icons/es/user--admin/16';
import ErrorFilled from '@carbon/icons/es/error--filled/20';
import WarningFilled from '@carbon/icons/es/warning--filled/20';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, IconModule, NotificationModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private mockUserService = inject(MockUserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private iconService = inject(IconService);

  loginForm: FormGroup;
  passwordVisible = false;
  isLoading = false;
  errorMessage = '';
  isAdminLogin = false;
  sessionExpired = false;

  private readonly ADMIN_EMAIL = 'zachary.schmidt@redwoodtrust.com';

  constructor() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {

    this.iconService.registerAll([
      ArrowRight,
      View,
      ViewOff,
      Login,
      UserAdmin,
      ErrorFilled,
      WarningFilled
    ]);

    this.route.queryParams.subscribe(params => {
      this.isAdminLogin = params['admin'] === 'true';
      this.sessionExpired = params['sessionExpired'] === 'true';
    });
  }

  get sessionExpiredNotification() {
    return {
      type: 'warning' as const,
      title: 'Session Expired',
      message: 'Your session has expired. Please log in again.',
      lowContrast: true,
      showClose: true
    };
  }

  onCloseSessionExpired(): void {
    this.sessionExpired = false;

    this.router.navigate(['/login'], { queryParams: {} });
  }

  get errorNotification() {
    return {
      type: 'error' as const,
      title: 'Login failed',
      message: this.errorMessage,
      lowContrast: true,
      showClose: true
    };
  }

  onCloseNotification(): void {
    this.errorMessage = '';
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      const { username, password } = this.loginForm.value;

      this.mockUserService.login(username, password).subscribe({
        next: (response) => {
          if (response.success && response.token && response.user) {

            if (this.isAdminLogin && response.user.email.toLowerCase() !== this.ADMIN_EMAIL.toLowerCase()) {
              this.isLoading = false;
              this.errorMessage = 'Unauthorized: Admin access is restricted to authorized personnel only.';
              return;
            }

            if (this.isAdminLogin && response.user.email.toLowerCase() === this.ADMIN_EMAIL.toLowerCase()) {

              const hasAdminRole = response.user.roles.some(
                role => role.toLowerCase() === 'admin'
              );
              if (!hasAdminRole) {
                response.user.roles = [...response.user.roles, 'admin'];
              }
            } else {

              response.user.roles = response.user.roles.filter(
                role => role.toLowerCase() !== 'admin'
              );
            }

            this.authService.handleSSOCallback(response.token, response.user);
            this.router.navigate(['/dashboard']);
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Invalid username or password';
        }
      });
    } else {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  navigateToAdminLogin(): void {
    this.router.navigate(['/login'], { queryParams: { admin: 'true' } });
  }

  navigateToRegularLogin(): void {
    this.router.navigate(['/login']);
  }

  get username() {
    return this.loginForm.get('username');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
