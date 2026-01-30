import { Component, OnInit, OnDestroy, inject, ElementRef, ViewChild, PLATFORM_ID, afterNextRender } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule, IconModule, IconService, TagModule } from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import Undo from '@carbon/icons/es/undo/16';
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

interface NavigationHistoryItem {
  reportId: string;
  reportName: string;
  workspaceId: string;
  isLinkedReport: boolean;
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

  // Navigation history for linked reports
  navigationHistory: NavigationHistoryItem[] = [];
  isViewingLinkedReport = false;
  linkedReportName = '';
  private originalReportId: string = '';
  private currentWorkspaceId: string = '';

  constructor() {

    afterNextRender(() => {
      this.loadPowerBILibrary();
    });
  }

  ngOnInit(): void {
    this.iconService.registerAll([ArrowLeft, Undo]);

    this.route.params.subscribe(params => {
      this.hubId = params['hubId'];
      this.reportId = params['reportId'];
      this.originalReportId = this.reportId;
      this.loadReport();
    });
  }

  ngOnDestroy(): void {
    if (this.embeddedReport) {
      try {
        this.embeddedReport.off('loaded');
        this.embeddedReport.off('error');
        this.embeddedReport.off('dataHyperlinkClicked');
        this.embeddedReport.off('buttonClicked');
        this.embeddedReport.off('rendered');
      } catch (e) {
        // Ignore cleanup errors
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
    this.navigationHistory = [];
    this.isViewingLinkedReport = false;
    this.linkedReportName = '';

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
          this.currentWorkspaceId = config.workspaceId;
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
        // Intercept hyperlink clicks to handle in-app navigation
        hyperlinkClickBehavior: 2  // RaiseEvent - intercept instead of navigate
      },
      // Disable Power BI telemetry to prevent CORS errors
      telemetry: {
        disabled: true
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

      // Handle hyperlink clicks to navigate within the same iframe
      this.embeddedReport.on('dataHyperlinkClicked', (event: any) => {
        console.log('dataHyperlinkClicked event fired:', event);
        this.handlePowerBIHyperlinkClick(event.detail);
      });

      // Also handle button clicks (Power BI button visuals with URL actions)
      // Note: Button Web URL actions will still open new tabs - this is a Power BI limitation.
      // To avoid new tabs, report authors should use data hyperlinks instead of buttons.
      this.embeddedReport.on('buttonClicked', (event: any) => {
        console.log('buttonClicked event fired:', event);
        const detail = event.detail;
        if (detail) {
          const url = detail.url || detail.destination;
          if (url) {
            console.log('Button URL detected:', url);
            this.handlePowerBIHyperlinkClick({ url, title: detail.title });
          }
        }
      });

      // Log when report is fully rendered to confirm events are registered
      this.embeddedReport.on('rendered', () => {
        console.log('Power BI report rendered - event handlers registered');
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

  /**
   * Handle hyperlink/button clicks within Power BI reports.
   * Parses the URL to check if it's a Power BI report link and loads it in the same container.
   */
  private handlePowerBIHyperlinkClick(detail: any): void {
    const url = detail?.url;
    const title = detail?.title;
    if (!url) {
      console.log('No URL in click event detail:', detail);
      return;
    }

    console.log('Power BI link clicked:', url, 'Title:', title);

    // Parse the URL to extract workspace and report IDs
    const parsed = this.parsePowerBIUrl(url);
    if (!parsed) {
      // Not a Power BI report URL - open in new tab
      window.open(url, '_blank');
      return;
    }

    console.log('Parsed Power BI URL:', parsed);

    // Save current report to navigation history
    const currentName = this.isViewingLinkedReport ? this.linkedReportName : this.reportName;
    const currentPbiReportId = this.currentReport?.embedConfig?.reportId || '';

    this.navigationHistory.push({
      reportId: this.isViewingLinkedReport ? currentPbiReportId : this.reportId,
      reportName: currentName,
      workspaceId: this.currentWorkspaceId,
      isLinkedReport: this.isViewingLinkedReport
    });

    // Load the linked report - use button title if available, otherwise use parsed name
    const linkedName = title || parsed.reportName || 'Linked Report';
    this.loadLinkedReport(parsed.workspaceId, parsed.reportId, linkedName);
  }

  /**
   * Parse a Power BI URL to extract workspace ID and report ID.
   * Handles various Power BI URL formats.
   */
  private parsePowerBIUrl(url: string): { workspaceId: string; reportId: string; reportName?: string } | null {
    try {
      const urlObj = new URL(url);

      // Format: https://app.powerbi.com/groups/{workspaceId}/reports/{reportId}
      // or: https://app.powerbi.com/groups/{workspaceId}/reports/{reportId}/ReportSection...
      const pathMatch = urlObj.pathname.match(/\/groups\/([^\/]+)\/reports\/([^\/\?]+)/);
      if (pathMatch) {
        return {
          workspaceId: pathMatch[1],
          reportId: pathMatch[2]
        };
      }

      // Format: https://app.powerbi.com/reportEmbed?reportId=...&groupId=...
      const reportIdParam = urlObj.searchParams.get('reportId');
      const groupIdParam = urlObj.searchParams.get('groupId');
      if (reportIdParam && groupIdParam) {
        return {
          workspaceId: groupIdParam,
          reportId: reportIdParam
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Load a linked Power BI report in the same container.
   */
  private loadLinkedReport(workspaceId: string, pbiReportId: string, reportName?: string): void {
    this.isLoading = true;
    this.error = null;
    this.isViewingLinkedReport = true;
    this.linkedReportName = reportName || 'Linked Report';
    this.currentWorkspaceId = workspaceId;

    // Get embed token for the linked report
    const params = new URLSearchParams({
      workspaceId,
      reportId: pbiReportId,
      sourceReportId: this.originalReportId
    });

    this.http.get<PowerBIEmbedInfo>(
      `${this.API_BASE_URL}/reports/powerbi-embed-direct?${params.toString()}`
    ).subscribe({
      next: (embedInfo) => {
        this.linkedReportName = reportName || 'Linked Report';
        this.initPowerBIEmbed(embedInfo);
      },
      error: (err) => {
        console.error('Failed to get embed token for linked report:', err);
        this.error = 'Failed to load linked report. You may not have access to this report.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Navigate back to the previous report in the navigation history.
   */
  goBackToPreviousReport(): void {
    if (this.navigationHistory.length === 0) return;

    const previous = this.navigationHistory.pop()!;

    if (!previous.isLinkedReport) {
      // Going back to the original database report
      this.isViewingLinkedReport = false;
      this.linkedReportName = '';
      this.loadReport();
    } else {
      // Going back to a previous linked report
      this.loadLinkedReport(previous.workspaceId, previous.reportId, previous.reportName);
    }
  }

  /**
   * Navigate back to the original report (skip all linked reports).
   */
  goBackToOriginalReport(): void {
    this.navigationHistory = [];
    this.isViewingLinkedReport = false;
    this.linkedReportName = '';
    this.loadReport();
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
