import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconModule, IconService } from 'carbon-components-angular';
import Login from '@carbon/icons/es/login/16';

@Component({
  selector: 'app-login',
  imports: [CommonModule, IconModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private iconService = inject(IconService);

  ngOnInit(): void {
    this.iconService.registerAll([Login]);
  }
}
