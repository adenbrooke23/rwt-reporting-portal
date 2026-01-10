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
      <p>Signing you in...</p>
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
      background: white;
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
    console.log('AUTH-CALLBACK: ngOnInit started');
    this.route.queryParams.subscribe(params => {
      console.log('AUTH-CALLBACK: queryParams received', params);
      const token = params['token'];
      const refreshToken = params['refresh'];

      if (token) {
        console.log('AUTH-CALLBACK: Token found, calling handleSSOTokens');
        this.authService.handleSSOTokens(token, refreshToken);
        console.log('AUTH-CALLBACK: handleSSOTokens completed, navigating to dashboard');
        this.router.navigate(['/dashboard']);
      } else {
        console.log('AUTH-CALLBACK: No token, redirecting to login');
        this.router.navigate(['/login']);
      }
    });
  }
}
