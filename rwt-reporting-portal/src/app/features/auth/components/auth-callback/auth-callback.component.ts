import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <h1>SSO CALLBACK PAGE</h1>
      <p>Status: {{ status }}</p>
      <p>Token: {{ hasToken ? 'YES' : 'NO' }}</p>
      <button *ngIf="hasToken" (click)="proceed()">Continue to Dashboard</button>
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
    h1 {
      color: #0f62fe;
      font-size: 24px;
    }
    p {
      color: #525252;
      font-size: 16px;
    }
    button {
      padding: 12px 24px;
      background: #0f62fe;
      color: white;
      border: none;
      cursor: pointer;
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  status = 'Loading...';
  hasToken = false;
  private token = '';
  private refreshToken = '';

  ngOnInit(): void {
    console.log('AuthCallbackComponent loaded');
    this.status = 'Reading URL params...';

    this.route.queryParams.subscribe(params => {
      console.log('Query params:', params);
      this.token = params['token'] || '';
      this.refreshToken = params['refresh'] || '';
      this.hasToken = !!this.token;

      if (this.hasToken) {
        this.status = 'Token received! Click button to continue.';
        this.authService.handleSSOTokens(this.token, this.refreshToken);
      } else {
        this.status = 'No token in URL';
      }
    });
  }

  proceed(): void {
    this.router.navigate(['/dashboard']);
  }
}
