import { Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { IconModule, IconService } from 'carbon-components-angular';
import Asleep from '@carbon/icons/es/asleep/20';
import Light from '@carbon/icons/es/light/20';

@Component({
  selector: 'app-theme-toggle',
  imports: [CommonModule, IconModule],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class ThemeToggleComponent implements OnInit {
  private themeService = inject(ThemeService);
  private iconService = inject(IconService);

  isDarkMode = false;

  ngOnInit() {

    this.iconService.registerAll([Asleep, Light]);

    this.themeService.theme$.subscribe(() => {
      this.isDarkMode = this.themeService.isDarkTheme();
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
