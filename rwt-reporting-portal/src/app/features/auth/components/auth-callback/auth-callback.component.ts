import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="loading-spinner"></div>
      <p>Completing sign in...</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 1rem;
    }
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e2e8f0;
      border-top-color: #0f62fe;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    p {
      color: #525252;
      font-size: 14px;
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  ngOnInit(): void {
    console.log('AuthCallbackComponent loaded');
    console.log('Current URL:', window.location.href);

    this.route.queryParams.subscribe(params => {
      console.log('Query params:', params);
      const token = params['token'];
      const refreshToken = params['refresh'];

      console.log('Token received:', token ? 'yes' : 'no');

      if (token) {
        // Store the tokens and authenticate
        console.log('Storing tokens...');
        this.authService.handleSSOTokens(token, refreshToken);
        console.log('Tokens stored, navigating to dashboard...');
        this.router.navigate(['/dashboard']);
      } else {
        // No token, redirect to login
        console.error('No token received from SSO callback');
        this.router.navigate(['/login']);
      }
    });
  }
}
