import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { IconModule, IconService } from 'carbon-components-angular';
import Login from '@carbon/icons/es/login/16';
import UserAdmin from '@carbon/icons/es/user--admin/16';

@Component({
  selector: 'app-login',
  imports: [CommonModule, IconModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private iconService = inject(IconService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isAdminLogin = false;

  ngOnInit(): void {
    this.iconService.registerAll([Login, UserAdmin]);

    this.route.queryParams.subscribe(params => {
      this.isAdminLogin = params['admin'] === 'true';
    });
  }

  navigateToAdminLogin(): void {
    this.router.navigate(['/login'], { queryParams: { admin: 'true' } });
  }

  navigateToRegularLogin(): void {
    this.router.navigate(['/login']);
  }
}
