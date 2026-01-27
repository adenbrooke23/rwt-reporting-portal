import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export type Theme = 'white' | 'g10' | 'g90' | 'g100' | 'sequoia' | 'corevest' | 'enterprise';

export interface ThemeInfo {
  id: Theme;
  name: string;
  description: string;
  isDark: boolean;
  isBusiness?: boolean;
}

export const AVAILABLE_THEMES: ThemeInfo[] = [

  { id: 'white', name: 'White', description: 'Light theme with white background', isDark: false },
  { id: 'g10', name: 'Gray 10', description: 'Light theme with gray background', isDark: false },
  { id: 'g90', name: 'Gray 90', description: 'Dark theme', isDark: true },
  { id: 'g100', name: 'Gray 100', description: 'Darkest theme', isDark: true },

  { id: 'sequoia', name: 'Sequoia', description: 'Forest green nature-inspired theme', isDark: false, isBusiness: true },
  { id: 'corevest', name: 'CoreVest', description: 'Professional blue with orange accents', isDark: false, isBusiness: true },
  { id: 'enterprise', name: 'Enterprise', description: 'Default enterprise theme', isDark: false, isBusiness: true }
];

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);

  private readonly STORAGE_KEY = 'theme-preference';
  private readonly BUSINESS_THEME_STORAGE_KEY = 'business-theme';
  private readonly API_URL = 'https://erpqaapi.redwoodtrust.com/api/users';

  private themeSubject: BehaviorSubject<Theme>;
  public theme$: Observable<Theme>;

  constructor() {

    const initialTheme = this.getInitialTheme();
    this.themeSubject = new BehaviorSubject<Theme>(initialTheme);
    this.theme$ = this.themeSubject.asObservable();

    this.applyTheme(initialTheme);
  }

  
  private getInitialTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'white';
    }

    const stored = localStorage.getItem(this.STORAGE_KEY);

    if (stored === 'light') {
      localStorage.setItem(this.STORAGE_KEY, 'white');
      return 'white';
    }
    if (stored === 'dark') {
      localStorage.setItem(this.STORAGE_KEY, 'g100');
      return 'g100';
    }

    if (stored && AVAILABLE_THEMES.some(t => t.id === stored)) {
      return stored as Theme;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'g100';
    }

    return 'white';
  }

  
  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  
  setTheme(theme: Theme, saveToApi = true): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.themeSubject.next(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme(theme);

    if (saveToApi) {
      this.saveThemeToApi(theme);
    }
  }

  
  private saveThemeToApi(theme: Theme): void {
    this.http.put(`${this.API_URL}/preferences`, { themeId: theme }).pipe(
      catchError(err => {
        console.error('Failed to save theme to API:', err);
        return of(null);
      })
    ).subscribe();
  }

  
  loadThemeFromApi(): void {
    this.http.get<{ themeId: string; tableRowSize: string }>(`${this.API_URL}/preferences`).pipe(
      catchError(() => of({ themeId: 'white', tableRowSize: 'md' }))
    ).subscribe(prefs => {
      if (prefs.themeId && AVAILABLE_THEMES.some(t => t.id === prefs.themeId)) {
        this.setTheme(prefs.themeId as Theme, false);
      }
    });
  }

  
  toggleTheme(): void {
    const current = this.getCurrentTheme();
    const currentTheme = AVAILABLE_THEMES.find(t => t.id === current);

    if (currentTheme?.isDark) {
      this.setTheme('white');
    } else {
      this.setTheme('g100');
    }
  }

  
  getAvailableThemes(): ThemeInfo[] {
    return AVAILABLE_THEMES;
  }

  
  isDarkTheme(): boolean {
    const current = this.getCurrentTheme();
    const theme = AVAILABLE_THEMES.find(t => t.id === current);
    return theme?.isDark || false;
  }

  
  setBusinessTheme(businessBranch: string | undefined): void {
    if (!businessBranch) {
      return;
    }

    const businessThemeMap: Record<string, Theme> = {
      'sequoia': 'sequoia',
      'corevest': 'corevest',
      'enterprise': 'enterprise'
    };

    const themeName = businessThemeMap[businessBranch.toLowerCase()];
    if (!themeName) return;

    const manualOverride = this.getUserThemeOverride();

    if (manualOverride) {

      this.applyTheme(manualOverride);
    } else {

      this.setTheme(themeName);
    }

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.BUSINESS_THEME_STORAGE_KEY, businessBranch);
    }
  }

  
  private getUserThemeOverride(): Theme | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored && AVAILABLE_THEMES.some(t => t.id === stored)) {
      return stored as Theme;
    }
    return null;
  }

  
  clearBusinessTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.BUSINESS_THEME_STORAGE_KEY);
    }

    this.setTheme('white');
  }

  
  private applyTheme(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = document.documentElement;

    root.classList.remove('light-theme', 'dark-theme');
    AVAILABLE_THEMES.forEach(t => {
      root.classList.remove(`theme-${t.id}`);
    });

    root.classList.add(`theme-${theme}`);
  }

  
  initSystemThemeListener(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      mediaQuery.addEventListener('change', (e) => {

        if (!localStorage.getItem(this.STORAGE_KEY)) {
          const newTheme = e.matches ? 'g100' : 'white';
          this.setTheme(newTheme);
        }
      });
    }
  }
}
