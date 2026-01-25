import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule, IconModule, IconService, TagModule } from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import { ReportType, SubReport } from '../../../auth/models/user-management.models';
import { ContentManagementService } from '../../../admin/services/content-management.service';
import { Report } from '../../../admin/models/content-management.models';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, ButtonModule, IconModule, TagModule],
  templateUrl: './report-viewer.component.html',
  styleUrl: './report-viewer.component.scss'
})
export class ReportViewerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private iconService = inject(IconService);
  private contentService = inject(ContentManagementService);
  private platformId = inject(PLATFORM_ID);

  // API base URL for proxy endpoints
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';

  reportId: string = '';
  reportName: string = '';
  reportDescription: string = '';
  reportType: ReportType = 'PowerBI';
  reportUrl: SafeResourceUrl | null = null;
  hubId: string = '';
  isLoading = true;
  error: string | null = null;

  // For SSRS reports that need configuration
  needsConfiguration = false;
  configMessage: string = '';

  ngOnInit(): void {
    this.iconService.registerAll([ArrowLeft]);

    this.route.params.subscribe(params => {
      this.hubId = params['hubId'];
      this.reportId = params['reportId'];
      this.loadReport();
    });
  }

  loadReport(): void {
    this.isLoading = true;
    this.error = null;
    this.needsConfiguration = false;

    // Fetch the report from the API
    this.contentService.getReportById(this.reportId).subscribe({
      next: (report) => {
        if (!report) {
          this.error = 'Report not found';
          this.isLoading = false;
          return;
        }

        this.reportName = report.name;
        this.reportDescription = report.description;
        this.reportType = report.type;

        // Convert Report to SubReport format for buildEmbedUrl
        const subReport: SubReport = {
          id: report.id,
          name: report.name,
          description: report.description,
          type: report.type,
          route: `/hub/${this.hubId}/report/${report.id}`,
          embedConfig: report.embedConfig
        };

        // Build the embed URL based on report type
        const embedUrl = this.buildEmbedUrl(subReport);

        if (embedUrl) {
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
        }

        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load report';
        this.isLoading = false;
      }
    });
  }

  private buildEmbedUrl(report: SubReport): string | null {
    const config = report.embedConfig;

    switch (report.type) {
      case 'PowerBI':
        // Power BI interactive report
        if (config?.embedUrl) {
          return config.embedUrl;
        }
        // Demo fallback for development
        return 'https://playground.powerbi.com/sampleReportEmbed';

      case 'SSRS':
        // On-premises SSRS/PBIRS report - use API proxy to avoid Windows auth popup
        if (config?.serverUrl && config?.reportPath) {
          // Use the API proxy endpoint which handles authentication server-side
          // Pass JWT token as query param since iframe requests can't set Authorization header
          const token = this.getAccessToken();
          const baseUrl = `${this.API_BASE_URL}/reports/${report.id}/render`;
          return token ? `${baseUrl}?access_token=${encodeURIComponent(token)}` : baseUrl;
        }
        // No configuration - show setup message
        this.needsConfiguration = true;
        this.configMessage = 'This SSRS report requires server configuration. Please configure the SSRS server URL and report path in the admin settings.';
        return null;

      case 'Paginated':
        // Paginated report (RDL on Power BI service or SSRS)
        if (config?.embedUrl) {
          // Direct embed URL provided
          return config.embedUrl;
        }
        if (config?.paginatedReportId) {
          // Power BI paginated report - would need Power BI embedding API in production
          // For now, show configuration message
          this.needsConfiguration = true;
          this.configMessage = 'Paginated reports on Power BI require the Power BI Embedded API. Configure your workspace and report IDs.';
          return null;
        }
        if (config?.serverUrl && config?.reportPath) {
          // Paginated report on SSRS - same URL format as SSRS
          const baseUrl = config.serverUrl.replace(/\/$/, '');
          const reportPath = config.reportPath.startsWith('/') ? config.reportPath : '/' + config.reportPath;
          return `${baseUrl}/Pages/ReportViewer.aspx?${reportPath}&rs:Command=Render&rs:Embed=true`;
        }
        this.needsConfiguration = true;
        this.configMessage = 'This paginated report requires configuration. Provide either a Power BI embed URL or SSRS server details.';
        return null;

      default:
        this.error = 'Unknown report type';
        return null;
    }
  }

  getReportTypeLabel(): string {
    switch (this.reportType) {
      case 'PowerBI':
        return 'Power BI';
      case 'SSRS':
        return 'SSRS';
      case 'Paginated':
        return 'Paginated';
      default:
        return 'Report';
    }
  }

  getReportTypeTagType(): 'blue' | 'purple' | 'teal' | 'gray' {
    switch (this.reportType) {
      case 'PowerBI':
        return 'blue';
      case 'SSRS':
        return 'purple';
      case 'Paginated':
        return 'teal';
      default:
        return 'gray';
    }
  }

  backToHub(): void {
    this.router.navigate(['/hub', this.hubId]);
  }

  /**
   * Get JWT access token from storage for iframe requests
   * (iframes can't use HttpInterceptor to add Authorization header)
   */
  private getAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    try {
      const tokenStr = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (tokenStr) {
        const token = JSON.parse(tokenStr);
        return token?.accessToken || null;
      }
    } catch {
      return null;
    }
    return null;
  }
}
