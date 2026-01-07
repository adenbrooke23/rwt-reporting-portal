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

  // Authorized admin email
  private readonly ADMIN_EMAIL = 'zachary.schmidt@redwoodtrust.com';

  constructor() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    // Register Carbon icons
    this.iconService.registerAll([
      ArrowRight,
      View,
      ViewOff,
      Login,
      UserAdmin,
      ErrorFilled,
      WarningFilled
    ]);

    // Check if this is admin login mode
    this.route.queryParams.subscribe(params => {
      this.isAdminLogin = params['admin'] === 'true';
    });
  }

  // Notification object for Carbon inline notification
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
      const { username, password, rememberMe } = this.loginForm.value;

      this.mockUserService.login(username, password).subscribe({
        next: (response) => {
          if (response.success && response.token && response.user) {
            // Check admin authorization AFTER successful login
            if (this.isAdminLogin && response.user.email.toLowerCase() !== this.ADMIN_EMAIL.toLowerCase()) {
              this.isLoading = false;
              this.errorMessage = 'Unauthorized: Admin access is restricted to authorized personnel only.';
              return;
            }

            // Add admin role if logging in via admin mode
            if (this.isAdminLogin && response.user.email.toLowerCase() === this.ADMIN_EMAIL.toLowerCase()) {
              // Ensure user has admin role
              if (!response.user.roles.includes('admin')) {
                response.user.roles = [...response.user.roles, 'admin'];
              }
            } else {
              // Remove admin role if not logging in via admin mode
              response.user.roles = response.user.roles.filter(role => role !== 'admin');
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

  loginWithSSO(): void {
    console.log('SSO button clicked');
    alert('Redirecting to SSO...');
    window.location.href = 'https://erpqaapi.redwoodtrust.com/api/auth/login';
  }

  get username() {
    return this.loginForm.get('username');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
