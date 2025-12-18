import { User } from './auth.models';

/**
 * Report Types:
 * - 'PowerBI' - Power BI interactive reports (embedded via Power BI service)
 * - 'SSRS' - On-premises SSRS/PBIRS reports (requires SSRS server)
 * - 'Paginated' - Paginated/RDL reports (can be on Power BI service or SSRS)
 */
export type ReportType = 'SSRS' | 'PowerBI' | 'Paginated';

/**
 * Report embedding configuration
 */
export interface ReportEmbedConfig {
  // For Power BI reports
  embedUrl?: string;           // Full embed URL for Power BI
  workspaceId?: string;        // Power BI workspace ID
  reportId?: string;           // Power BI report ID

  // For SSRS/PBIRS reports
  serverUrl?: string;          // SSRS server base URL (e.g., http://server/ReportServer)
  reportPath?: string;         // Report path on server (e.g., /Folder/ReportName)

  // For Paginated reports on Power BI
  paginatedReportId?: string;  // Power BI paginated report ID
}

export interface SubReport {
  id: string;
  name: string;
  description: string;
  route: string;
  type: ReportType;
  embedConfig?: ReportEmbedConfig;  // Optional embed configuration
}

export interface ReportCategory {
  id: string;
  name: string;
  description: string;
  reports: SubReport[];
}

export interface UserPermissions {
  userId: string;
  reportIds: string[];
}

export interface UserProfile extends User {
  createdAt: Date;
  groups: string[];
  businessBranch?: 'corevest' | 'sequoia' | 'enterprise'; // Business branch for theme customization
  avatarId?: string; // Selected avatar ID
  displayName?: string; // Formatted display name (e.g., "Zachary Schmidt")
}

export interface Group {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_GROUPS: Group[] = [
  { id: 'admin', name: 'Admin', description: 'Full system access' },
  { id: 'it', name: 'IT', description: 'IT department' },
  { id: 'treasury', name: 'Treasury', description: 'Treasury department' },
  { id: 'finance', name: 'Finance', description: 'Finance department' },
  { id: 'accounting', name: 'Accounting', description: 'Accounting department' },
  { id: 'enterprise', name: 'Enterprise', description: 'Enterprise group' }
];

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'sequoia',
    name: 'Sequoia',
    description: 'Sequoia reporting and analytics',
    reports: [
      {
        id: 'sequoia-monthly-summary',
        name: 'Monthly Summary',
        description: 'Outstanding Conditions for all sellers',
        route: '/reports/sequoia/monthly-summary',
        type: 'SSRS'
      },
      {
        id: 'sequoia-transaction-details',
        name: 'Transaction Details',
        description: 'Detailed transaction reports',
        route: '/reports/sequoia/transaction-details',
        type: 'PowerBI'
      },
      {
        id: 'sequoia-performance-metrics',
        name: 'Performance Metrics',
        description: 'Key performance indicators',
        route: '/reports/sequoia/performance-metrics',
        type: 'SSRS'
      },
      {
        id: 'sample-powerbi-embed',
        name: 'Sample Power BI Report',
        description: 'Interactive Power BI embedded report demo',
        route: '/hub/sequoia/report/sample-powerbi-embed',
        type: 'PowerBI',
        embedConfig: {
          embedUrl: 'https://playground.powerbi.com/sampleReportEmbed'
        }
      },
      {
        id: 'sample-ssrs-report',
        name: 'Sample SSRS Report',
        description: 'On-premises SSRS paginated report demo',
        route: '/hub/sequoia/report/sample-ssrs-report',
        type: 'SSRS'
        // No embedConfig - will show configuration required message
      },
      {
        id: 'sample-paginated-report',
        name: 'Sample Paginated Report',
        description: 'Paginated/RDL report on Power BI service',
        route: '/hub/sequoia/report/sample-paginated-report',
        type: 'Paginated'
        // No embedConfig - will show configuration required message
      }
    ]
  },
  {
    id: 'corevest',
    name: 'Corevest',
    description: 'Corevest reporting and analytics',
    reports: [
      {
        id: 'corevest-portfolio-overview',
        name: 'Portfolio Overview',
        description: 'Portfolio summary and overview',
        route: '/reports/corevest/portfolio-overview',
        type: 'PowerBI'
      },
      {
        id: 'corevest-asset-analysis',
        name: 'Asset Analysis',
        description: 'Detailed asset analysis',
        route: '/reports/corevest/asset-analysis',
        type: 'SSRS'
      },
      {
        id: 'corevest-risk-assessment',
        name: 'Risk Assessment',
        description: 'Risk metrics and assessment',
        route: '/reports/corevest/risk-assessment',
        type: 'PowerBI'
      }
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Enterprise reporting and analytics',
    reports: [
      {
        id: 'enterprise-financial-dashboard',
        name: 'Financial Dashboard',
        description: 'Enterprise-wide financial dashboard',
        route: '/reports/enterprise/financial-dashboard',
        type: 'PowerBI'
      },
      {
        id: 'enterprise-compliance-report',
        name: 'Compliance Report',
        description: 'Compliance and regulatory reports',
        route: '/reports/enterprise/compliance-report',
        type: 'SSRS'
      },
      {
        id: 'enterprise-executive-summary',
        name: 'Executive Summary',
        description: 'High-level executive summary',
        route: '/reports/enterprise/executive-summary',
        type: 'PowerBI'
      }
    ]
  },
  {
    id: 'aspire',
    name: 'Aspire',
    description: 'Aspire reporting and analytics',
    reports: [
      {
        id: 'aspire-loan-pipeline',
        name: 'Loan Pipeline',
        description: 'Loan pipeline and origination reports',
        route: '/reports/aspire/loan-pipeline',
        type: 'PowerBI'
      },
      {
        id: 'aspire-servicing-summary',
        name: 'Servicing Summary',
        description: 'Loan servicing and portfolio summary',
        route: '/reports/aspire/servicing-summary',
        type: 'SSRS'
      },
      {
        id: 'aspire-performance-analytics',
        name: 'Performance Analytics',
        description: 'Performance metrics and analytics',
        route: '/reports/aspire/performance-analytics',
        type: 'PowerBI'
      }
    ]
  }
];

export function getAllReports(): SubReport[] {
  return REPORT_CATEGORIES.flatMap(category => category.reports);
}

export function getReportById(reportId: string): SubReport | undefined {
  return getAllReports().find(report => report.id === reportId);
}

export function getCategoryByReportId(reportId: string): ReportCategory | undefined {
  return REPORT_CATEGORIES.find(category =>
    category.reports.some(report => report.id === reportId)
  );
}
