import { ReportType, ReportEmbedConfig } from '../../auth/models/user-management.models';

export interface Hub {
  id: string;
  name: string;
  description: string;
  iconName?: string;
  colorClass?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  reportGroupCount?: number;
  reportCount?: number;
}

export interface CreateHubDto {
  name: string;
  description: string;
  iconName?: string;
  colorClass?: string;
}

export interface UpdateHubDto {
  name?: string;
  description?: string;
  iconName?: string;
  colorClass?: string;
  isActive?: boolean;
}

export interface ReportGroup {
  id: string;
  hubId: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  reportCount?: number;
}

export interface CreateReportGroupDto {
  hubId: string;
  name: string;
  description: string;
}

export interface UpdateReportGroupDto {
  name?: string;
  description?: string;
  hubId?: string;
  isActive?: boolean;
}

export interface Report {
  id: string;
  reportGroupId: string;
  hubId: string;
  name: string;
  description: string;
  type: ReportType;
  embedConfig?: ReportEmbedConfig;
  departmentIds?: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreateReportDto {
  reportGroupId: string;
  name: string;
  description: string;
  type: ReportType;
  embedConfig?: ReportEmbedConfig;
  departmentIds?: string[];
}

export interface UpdateReportDto {
  name?: string;
  description?: string;
  type?: ReportType;
  embedConfig?: ReportEmbedConfig;
  reportGroupId?: string;
  departmentIds?: string[];
  isActive?: boolean;
}

export interface PowerBIWorkspace {
  id: string;
  name: string;
  type: string;
  isReadOnly: boolean;
}

export interface PowerBIReport {
  id: string;
  name: string;
  webUrl: string;
  embedUrl: string;
  datasetId?: string;
  reportType: 'PowerBIReport' | 'PaginatedReport';
}

export interface BulkImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: string[];
}

export const HUB_ICONS = [
  { id: 'folder', name: 'Folder', icon: 'folder' },
  { id: 'analytics', name: 'Analytics', icon: 'analytics' },
  { id: 'chart', name: 'Chart', icon: 'chart--line' },
  { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
  { id: 'report', name: 'Report', icon: 'report' },
  { id: 'document', name: 'Document', icon: 'document' },
  { id: 'finance', name: 'Finance', icon: 'finance' },
  { id: 'building', name: 'Building', icon: 'building' }
];

export const HUB_COLORS = [
  { id: 'sequoia', name: 'Sequoia Green', class: 'sequoia' },
  { id: 'corevest', name: 'CoreVest Blue', class: 'corevest' },
  { id: 'enterprise', name: 'Enterprise Purple', class: 'enterprise' },
  { id: 'aspire', name: 'Aspire Orange', class: 'aspire' },
  { id: 'default', name: 'Default', class: 'default' }
];

export interface Department {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreateDepartmentDto {
  name: string;
  description: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
