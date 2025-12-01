import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

// Carbon Design System themes + Business themes
export type Theme = 'white' | 'g10' | 'g90' | 'g100' | 'sequoia' | 'corevest' | 'enterprise';

export interface ThemeInfo {
  id: Theme;
  name: string;
  description: string;
  isDark: boolean;
  isBusiness?: boolean; // Flag for business-specific themes
}

export const AVAILABLE_THEMES: ThemeInfo[] = [
  // Carbon Design System Themes
  { id: 'white', name: 'White', description: 'Light theme with white background', isDark: false },
  { id: 'g10', name: 'Gray 10', description: 'Light theme with gray background', isDark: false },
  { id: 'g90', name: 'Gray 90', description: 'Dark theme', isDark: true },
  { id: 'g100', name: 'Gray 100', description: 'Darkest theme', isDark: true },

  // Business Themes
  { id: 'sequoia', name: 'Sequoia', description: 'Forest green nature-inspired theme', isDark: false, isBusiness: true },
  { id: 'corevest', name: 'CoreVest', description: 'Professional blue with orange accents', isDark: false, isBusiness: true },
  { id: 'enterprise', name: 'Enterprise', description: 'Default enterprise theme', isDark: false, isBusiness: true }
];

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'theme-preference';
  private readonly BUSINESS_THEME_STORAGE_KEY = 'business-theme';

  private themeSubject: BehaviorSubject<Theme>;
  public theme$: Observable<Theme>;

  constructor() {
    // Initialize with stored preference or system preference
    const initialTheme = this.getInitialTheme();
    this.themeSubject = new BehaviorSubject<Theme>(initialTheme);
    this.theme$ = this.themeSubject.asObservable();

    // Apply initial theme
    this.applyTheme(initialTheme);
  }

  /**
   * Get initial theme from localStorage or system preference
   */
  private getInitialTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'white';
    }

    // Check localStorage first
    const stored = localStorage.getItem(this.STORAGE_KEY);

    // Migrate old theme values to new Carbon theme names
    if (stored === 'light') {
      localStorage.setItem(this.STORAGE_KEY, 'white');
      return 'white';
    }
    if (stored === 'dark') {
      localStorage.setItem(this.STORAGE_KEY, 'g100');
      return 'g100';
    }

    // Use stored value if it's a valid Carbon theme
    if (stored && AVAILABLE_THEMES.some(t => t.id === stored)) {
      return stored as Theme;
    }

    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'g100'; // Default dark theme
    }

    return 'white'; // Default light theme
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  /**
   * Set theme and persist to localStorage
   */
  setTheme(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.themeSubject.next(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme(theme);
  }

  /**
   * Toggle between light and dark themes (for simple toggle button)
   */
  toggleTheme(): void {
    const current = this.getCurrentTheme();
    const currentTheme = AVAILABLE_THEMES.find(t => t.id === current);

    // Toggle between light and dark categories
    if (currentTheme?.isDark) {
      this.setTheme('white'); // Switch to light
    } else {
      this.setTheme('g100'); // Switch to dark
    }
  }

  /**
   * Get all available themes
   */
  getAvailableThemes(): ThemeInfo[] {
    return AVAILABLE_THEMES;
  }

  /**
   * Check if current theme is dark
   */
  isDarkTheme(): boolean {
    const current = this.getCurrentTheme();
    const theme = AVAILABLE_THEMES.find(t => t.id === current);
    return theme?.isDark || false;
  }

  /**
   * Set business theme based on user's business branch
   * This auto-applies the business's theme (now a complete theme, not just colors)
   */
  setBusinessTheme(businessBranch: string | undefined): void {
    if (!businessBranch) {
      return;
    }

    // Map business branch to theme name
    const businessThemeMap: Record<string, Theme> = {
      'sequoia': 'sequoia',
      'corevest': 'corevest',
      'enterprise': 'enterprise'
    };

    const themeName = businessThemeMap[businessBranch.toLowerCase()];
    if (!themeName) return;

    // Check if user has a manual theme override
    const manualOverride = this.getUserThemeOverride();

    if (manualOverride) {
      // User has manually selected a theme, respect their choice
      this.applyTheme(manualOverride);
    } else {
      // No manual override, apply business theme
      this.setTheme(themeName);
    }

    // Store business branch for reference
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.BUSINESS_THEME_STORAGE_KEY, businessBranch);
    }
  }

  /**
   * Get user's manual theme override (if they changed from business default)
   */
  private getUserThemeOverride(): Theme | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored && AVAILABLE_THEMES.some(t => t.id === stored)) {
      return stored as Theme;
    }
    return null;
  }

  /**
   * Clear business theme (reset to default)
   */
  clearBusinessTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.BUSINESS_THEME_STORAGE_KEY);
    }
    // Reset to default white theme
    this.setTheme('white');
  }

  /**
   * Apply theme by adding/removing class on document element
   */
  private applyTheme(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = document.documentElement;

    // Remove ALL possible theme classes (new and old)
    root.classList.remove('light-theme', 'dark-theme');
    AVAILABLE_THEMES.forEach(t => {
      root.classList.remove(`theme-${t.id}`);
    });

    // Add the new theme class
    root.classList.add(`theme-${theme}`);
  }

  /**
   * Listen to system theme changes
   */
  initSystemThemeListener(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      mediaQuery.addEventListener('change', (e) => {
        // Only update if user hasn't set a preference
        if (!localStorage.getItem(this.STORAGE_KEY)) {
          const newTheme = e.matches ? 'g100' : 'white';
          this.setTheme(newTheme);
        }
      });
    }
  }
}
