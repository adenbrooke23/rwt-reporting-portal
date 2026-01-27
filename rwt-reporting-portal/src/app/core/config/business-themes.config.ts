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
      primary: '#0077C5',
      primaryHover: '#005994',
      accent: '#FF671B'
    }
  },
  'sequoia': {
    id: 'sequoia',
    name: 'Sequoia',
    description: 'Nature-inspired forest green theme',
    defaultTheme: 'white',
    customColors: {
      primary: '#2F5233',
      primaryHover: '#1F3723',
      accent: '#6B8E23'
    }
  },
  'enterprise': {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Default Carbon Design System theme',
    defaultTheme: 'white'

  }
};

export type BusinessBranch = 'corevest' | 'sequoia' | 'enterprise';

export function getBusinessTheme(businessBranch: string | undefined): BusinessTheme | undefined {
  if (!businessBranch) return undefined;
  return BUSINESS_THEMES[businessBranch.toLowerCase()];
}
