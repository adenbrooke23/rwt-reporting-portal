import { Component, OnInit, OnDestroy, inject, ElementRef, ViewChild, PLATFORM_ID, afterNextRender } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule, IconModule, IconService, TagModule } from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import { ReportType, SubReport } from '../../../auth/models/user-management.models';
import { ReportService } from '../../services/report.service';
import { Report } from '../../../admin/models/content-management.models';

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
  private reportService = inject(ReportService);
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

  needsConfiguration = false;
  configMessage: string = '';

  usePowerBIEmbed = false;
  private powerbiService: any = null;
  private embeddedReport: any = null;
  private currentReport: Report | null = null;

  constructor() {

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

    if (this.embeddedReport) {
      try {
        this.embeddedReport.off('loaded');
        this.embeddedReport.off('error');
      } catch (e) {

      }
    }
  }

  private loadPowerBILibrary(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (typeof powerbi !== 'undefined') {
      this.powerbiService = powerbi;
      return;
    }

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

    this.reportService.getReport(this.reportId).subscribe({
      next: (report) => {
        if (!report) {
          this.error = 'Report not found or access denied';
          this.isLoading = false;
          return;
        }

        this.currentReport = report;
        this.reportName = report.name;
        this.reportDescription = report.description;
        this.reportType = report.type;

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

        if (config?.workspaceId && config?.reportId) {
          this.usePowerBIEmbed = true;
          this.embedPowerBIReport(config.workspaceId, config.reportId);
          return;
        }

        if (config?.embedUrl) {
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(config.embedUrl);
          this.isLoading = false;
          return;
        }

        if (config?.serverUrl && config?.reportPath) {
          const url = this.buildSSRSUrl(config.serverUrl, config.reportPath);
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoading = false;
          return;
        }

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

    this.http.get<PowerBIEmbedInfo>(
      `${this.API_BASE_URL}/reports/${this.reportId}/powerbi-embed`
    ).subscribe({
      next: (embedInfo) => {
        this.initPowerBIEmbed(embedInfo);
      },
      error: (err) => {
        console.error('Failed to get Power BI embed token:', err);

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

    const checkReady = setInterval(() => {
      if (this.powerbiContainer?.nativeElement && this.powerbiService) {
        clearInterval(checkReady);
        this.doEmbed(embedInfo);
      }
    }, 100);

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
      tokenType: 1,
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
        background: 1,
        layoutType: 0,
      }
    };

    try {

      this.embeddedReport = this.powerbiService.embed(
        this.powerbiContainer.nativeElement,
        config
      );

      this.embeddedReport.on('loaded', () => {
        this.isLoading = false;
      });

      this.embeddedReport.on('error', (event: any) => {
        console.error('Power BI embed error:', event.detail);
        this.error = 'Failed to load Power BI report';
        this.isLoading = false;
      });

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
