import { Theme } from '../services/theme.service';

export interface BusinessTheme {
  id: string;
  name: string;
  description: string;
  defaultTheme: Theme;
  customColors?: {
    primary?: string;
    primaryHover?: string;
    accent?: string;
  };
}

export const BUSINESS_THEMES: Record<string, BusinessTheme> = {
  'corevest': {
    id: 'corevest',
    name: 'CoreVest Finance',
    description: 'Professional blue theme with orange accents',
    defaultTheme: 'white',
    customColors: {
      primary: '#0077C5',        // CoreVest primary blue
      primaryHover: '#005994',   // CoreVest dark blue (hover)
      accent: '#FF671B'          // CoreVest orange accent
    }
  },
  'sequoia': {
    id: 'sequoia',
    name: 'Sequoia',
    description: 'Nature-inspired forest green theme',
    defaultTheme: 'white',
    customColors: {
      primary: '#2F5233',        // Forest green (sequoia trees)
      primaryHover: '#1F3723',   // Darker forest green
      accent: '#6B8E23'          // Olive green accent
    }
  },
  'enterprise': {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Default Carbon Design System theme',
    defaultTheme: 'white'
    // No custom colors - uses Carbon defaults
  }
};

export type BusinessBranch = 'corevest' | 'sequoia' | 'enterprise';

export function getBusinessTheme(businessBranch: string | undefined): BusinessTheme | undefined {
  if (!businessBranch) return undefined;
  return BUSINESS_THEMES[businessBranch.toLowerCase()];
}
