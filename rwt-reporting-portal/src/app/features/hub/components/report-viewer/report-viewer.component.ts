import { Component, OnInit, OnDestroy, inject, ElementRef, ViewChild, PLATFORM_ID, afterNextRender } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule, IconModule, IconService, TagModule } from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import { ReportType, SubReport } from '../../../auth/models/user-management.models';
import { ContentManagementService } from '../../../admin/services/content-management.service';
import { Report } from '../../../admin/models/content-management.models';

// Power BI types - declared here to avoid SSR issues
declare const powerbi: any;

interface PowerBIEmbedInfo {
  embedUrl: string;
  embedToken: string;
  reportId: string;
  tokenExpiry: string;
}

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, ButtonModule, IconModule, TagModule],
  templateUrl: './report-viewer.component.html',
  styleUrl: './report-viewer.component.scss'
})
export class ReportViewerComponent implements OnInit, OnDestroy {
  @ViewChild('powerbiContainer') powerbiContainer!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private iconService = inject(IconService);
  private contentService = inject(ContentManagementService);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

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

  // For Power BI embedding
  usePowerBIEmbed = false;
  private powerbiService: any = null;
  private embeddedReport: any = null;
  private currentReport: Report | null = null;

  constructor() {
    // Load Power BI client library after render (browser only)
    afterNextRender(() => {
      this.loadPowerBILibrary();
    });
  }

  ngOnInit(): void {
    this.iconService.registerAll([ArrowLeft]);

    this.route.params.subscribe(params => {
      this.hubId = params['hubId'];
      this.reportId = params['reportId'];
      this.loadReport();
    });
  }

  ngOnDestroy(): void {
    // Clean up Power BI embed
    if (this.embeddedReport) {
      try {
        this.embeddedReport.off('loaded');
        this.embeddedReport.off('error');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private loadPowerBILibrary(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Check if already loaded
    if (typeof powerbi !== 'undefined') {
      this.powerbiService = powerbi;
      return;
    }

    // Dynamically load the Power BI JavaScript library
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/powerbi-client@2.22.3/dist/powerbi.min.js';
    script.onload = () => {
      this.powerbiService = (window as any).powerbi;
    };
    document.head.appendChild(script);
  }

  loadReport(): void {
    this.isLoading = true;
    this.error = null;
    this.needsConfiguration = false;
    this.usePowerBIEmbed = false;
    this.reportUrl = null;

    // Fetch the report from the API
    this.contentService.getReportById(this.reportId).subscribe({
      next: (report) => {
        if (!report) {
          this.error = 'Report not found';
          this.isLoading = false;
          return;
        }

        this.currentReport = report;
        this.reportName = report.name;
        this.reportDescription = report.description;
        this.reportType = report.type;

        // Determine embed method based on report type and configuration
        this.handleReportEmbed(report);
      },
      error: () => {
        this.error = 'Failed to load report';
        this.isLoading = false;
      }
    });
  }

  private handleReportEmbed(report: Report): void {
    const config = report.embedConfig;

    switch (report.type) {
      case 'PowerBI':
      case 'Paginated':
        // Check if we have workspace and report IDs for SDK embedding
        if (config?.workspaceId && config?.reportId) {
          this.usePowerBIEmbed = true;
          this.embedPowerBIReport(config.workspaceId, config.reportId);
          return;
        }
        // Fallback to iframe if we have a direct embed URL
        if (config?.embedUrl) {
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(config.embedUrl);
          this.isLoading = false;
          return;
        }
        // For Paginated on SSRS
        if (config?.serverUrl && config?.reportPath) {
          const url = this.buildSSRSUrl(config.serverUrl, config.reportPath);
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoading = false;
          return;
        }
        // No valid configuration
        this.needsConfiguration = true;
        this.configMessage = 'This Power BI report requires configuration. Please configure the workspace ID and report ID in admin settings.';
        this.isLoading = false;
        break;

      case 'SSRS':
        if (config?.serverUrl && config?.reportPath) {
          const url = this.buildSSRSUrl(config.serverUrl, config.reportPath);
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoading = false;
          return;
        }
        this.needsConfiguration = true;
        this.configMessage = 'This SSRS report requires server configuration. Please configure the SSRS server URL and report path in admin settings.';
        this.isLoading = false;
        break;

      default:
        this.error = 'Unknown report type';
        this.isLoading = false;
    }
  }

  private buildSSRSUrl(serverUrl: string, reportPath: string): string {
    const baseUrl = serverUrl.replace(/\/$/, '');
    const path = reportPath.startsWith('/') ? reportPath : '/' + reportPath;
    return `${baseUrl}/Pages/ReportViewer.aspx?${path}&rs:Command=Render&rs:Embed=true`;
  }

  private embedPowerBIReport(workspaceId: string, pbiReportId: string): void {
    // Get embed token from our API
    this.http.get<PowerBIEmbedInfo>(
      `${this.API_BASE_URL}/reports/${this.reportId}/powerbi-embed`
    ).subscribe({
      next: (embedInfo) => {
        this.initPowerBIEmbed(embedInfo);
      },
      error: (err) => {
        console.error('Failed to get Power BI embed token:', err);
        // Fallback: try to use direct embed URL if available
        if (this.currentReport?.embedConfig?.embedUrl) {
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            this.currentReport.embedConfig.embedUrl
          );
          this.usePowerBIEmbed = false;
        } else {
          this.error = 'Failed to get Power BI embed token. Please contact administrator.';
        }
        this.isLoading = false;
      }
    });
  }

  private initPowerBIEmbed(embedInfo: PowerBIEmbedInfo): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.isLoading = false;
      return;
    }

    // Wait for container and Power BI library to be ready
    const checkReady = setInterval(() => {
      if (this.powerbiContainer?.nativeElement && this.powerbiService) {
        clearInterval(checkReady);
        this.doEmbed(embedInfo);
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkReady);
      if (this.isLoading) {
        this.error = 'Power BI library failed to load. Please refresh the page.';
        this.isLoading = false;
      }
    }, 10000);
  }

  private doEmbed(embedInfo: PowerBIEmbedInfo): void {
    const config = {
      type: 'report',
      tokenType: 1, // Embed token
      accessToken: embedInfo.embedToken,
      embedUrl: embedInfo.embedUrl,
      id: embedInfo.reportId,
      settings: {
        panes: {
          filters: {
            visible: true
          },
          pageNavigation: {
            visible: true
          }
        },
        background: 1, // Transparent
        layoutType: 0, // Custom
      }
    };

    try {
      // Embed the report
      this.embeddedReport = this.powerbiService.embed(
        this.powerbiContainer.nativeElement,
        config
      );

      // Handle events
      this.embeddedReport.on('loaded', () => {
        this.isLoading = false;
      });

      this.embeddedReport.on('error', (event: any) => {
        console.error('Power BI embed error:', event.detail);
        this.error = 'Failed to load Power BI report';
        this.isLoading = false;
      });

      // Set loading to false after a short delay in case 'loaded' doesn't fire
      setTimeout(() => {
        if (this.isLoading) {
          this.isLoading = false;
        }
      }, 5000);
    } catch (e) {
      console.error('Power BI embed exception:', e);
      this.error = 'Failed to embed Power BI report';
      this.isLoading = false;
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
