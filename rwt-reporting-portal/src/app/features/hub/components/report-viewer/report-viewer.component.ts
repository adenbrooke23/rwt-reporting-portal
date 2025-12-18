import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule, IconModule, IconService, TagModule } from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import { ReportType, SubReport, REPORT_CATEGORIES, getAllReports } from '../../../auth/models/user-management.models';

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

    // Find the report from our data
    const allReports = getAllReports();
    const report = allReports.find(r => r.id === this.reportId);

    if (!report) {
      this.error = 'Report not found';
      this.isLoading = false;
      return;
    }

    this.reportName = report.name;
    this.reportDescription = report.description;
    this.reportType = report.type;

    // Build the embed URL based on report type
    const embedUrl = this.buildEmbedUrl(report);

    if (embedUrl) {
      this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }

    this.isLoading = false;
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
        // On-premises SSRS/PBIRS report
        if (config?.serverUrl && config?.reportPath) {
          // Build SSRS embed URL with rs:Embed=true for iframe compatibility
          const baseUrl = config.serverUrl.replace(/\/$/, '');
          const reportPath = config.reportPath.startsWith('/') ? config.reportPath : '/' + config.reportPath;
          return `${baseUrl}/Pages/ReportViewer.aspx?${reportPath}&rs:Command=Render&rs:Embed=true`;
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
}
