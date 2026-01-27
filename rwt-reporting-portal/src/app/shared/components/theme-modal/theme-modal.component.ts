import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalModule, ButtonModule, IconModule, IconService } from 'carbon-components-angular';
import { ThemeService, Theme, ThemeInfo, AVAILABLE_THEMES } from '../../../core/services/theme.service';
import Checkmark from '@carbon/icons/es/checkmark/16';
import Close from '@carbon/icons/es/close/20';

@Component({
  selector: 'app-theme-modal',
  imports: [CommonModule, ModalModule, ButtonModule, IconModule],
  templateUrl: './theme-modal.component.html',
  styleUrl: './theme-modal.component.scss'
})
export class ThemeModalComponent implements OnInit {
  private themeService = inject(ThemeService);
  private iconService = inject(IconService);

  @Input() open = false;
  @Output() closeModal = new EventEmitter<void>();

  selectedTheme: Theme = 'white';
  originalTheme: Theme = 'white';

  carbonThemes: ThemeInfo[] = [];
  businessThemes: ThemeInfo[] = [];

  ngOnInit(): void {
    this.iconService.registerAll([Checkmark, Close]);
    this.loadThemeData();
  }

  loadThemeData(): void {
    this.selectedTheme = this.themeService.getCurrentTheme();
    this.originalTheme = this.selectedTheme;

    this.carbonThemes = AVAILABLE_THEMES.filter(t => !t.isBusiness);
    this.businessThemes = AVAILABLE_THEMES.filter(t => t.isBusiness);
  }

  selectTheme(themeId: Theme): void {
    this.selectedTheme = themeId;

    this.themeService.setTheme(themeId);
  }

  isSelectedTheme(themeId: Theme): boolean {
    return this.selectedTheme === themeId;
  }

  hasChanges(): boolean {
    return this.selectedTheme !== this.originalTheme;
  }

  onCancel(): void {

    if (this.hasChanges()) {
      this.themeService.setTheme(this.originalTheme);
      this.selectedTheme = this.originalTheme;
    }
    this.closeModal.emit();
  }

  onSave(): void {

    this.originalTheme = this.selectedTheme;
    this.closeModal.emit();
  }

  onOverlayClick(): void {
    this.onCancel();
  }
}
