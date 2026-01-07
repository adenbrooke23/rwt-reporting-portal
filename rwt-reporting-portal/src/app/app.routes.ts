import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './features/auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/components/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'home',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'my-dashboard',
    loadComponent: () => import('./features/dashboard/components/personal-dashboard/personal-dashboard.component').then(m => m.PersonalDashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'updates',
    loadComponent: () => import('./features/updates/components/updates/updates.component').then(m => m.UpdatesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/components/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/theme-settings',
    loadComponent: () => import('./features/admin/components/theme-settings/theme-settings.component').then(m => m.ThemeSettingsComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/announcements',
    loadComponent: () => import('./features/admin/components/announcements/announcements.component').then(m => m.AnnouncementsComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/content',
    loadComponent: () => import('./features/admin/components/content-management/content-management.component').then(m => m.ContentManagementComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/content/hubs',
    loadComponent: () => import('./features/admin/components/hub-management/hub-management.component').then(m => m.HubManagementComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/content/groups',
    loadComponent: () => import('./features/admin/components/group-management/group-management.component').then(m => m.GroupManagementComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/content/departments',
    loadComponent: () => import('./features/admin/components/department-management/department-management.component').then(m => m.DepartmentManagementComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/content/reports',
    loadComponent: () => import('./features/admin/components/report-management/report-management.component').then(m => m.ReportManagementComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'hub/:hubId',
    loadComponent: () => import('./features/hub/components/hub-detail/hub-detail.component').then(m => m.HubDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'hub/:hubId/report/:reportId',
    loadComponent: () => import('./features/hub/components/report-viewer/report-viewer.component').then(m => m.ReportViewerComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
