import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService, Theme, ThemeInfo, AVAILABLE_THEMES } from '../../../../core/services/theme.service';
import { IconModule, IconService, ButtonModule, BreadcrumbModule } from 'carbon-components-angular';
import Checkmark from '@carbon/icons/es/checkmark/20';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-theme-settings',
  imports: [CommonModule, IconModule, ButtonModule, BreadcrumbModule],
  templateUrl: './theme-settings.component.html',
  styleUrl: './theme-settings.component.scss'
})
export class ThemeSettingsComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private iconService = inject(IconService);
  private router = inject(Router);
  private themeSubscription?: Subscription;

  carbonThemes: ThemeInfo[] = AVAILABLE_THEMES.filter(t => !t.isBusiness);
  businessThemes: ThemeInfo[] = AVAILABLE_THEMES.filter(t => t.isBusiness);
  currentTheme: Theme = 'white';

  ngOnInit(): void {

    this.iconService.registerAll([Checkmark, ArrowLeft]);

    this.currentTheme = this.themeService.getCurrentTheme();

    this.themeSubscription = this.themeService.theme$.subscribe(theme => {
      this.currentTheme = theme;
    });
  }

  ngOnDestroy(): void {

    this.themeSubscription?.unsubscribe();
  }

  selectTheme(themeId: Theme): void {
    this.themeService.setTheme(themeId);
  }

  isCurrentTheme(themeId: Theme): boolean {
    return this.currentTheme === themeId;
  }

  getThemePreviewClass(themeId: Theme): string {
    return `theme-preview-${themeId}`;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
