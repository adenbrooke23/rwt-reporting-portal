import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  ModalModule,
  ButtonModule,
  IconModule,
  IconService,
  TagModule
} from 'carbon-components-angular';

import {
  PowerBIBrowserService,
  PowerBIWorkspace,
  PowerBIReport,
  PowerBIReportSelection
} from '../../services/powerbi-browser.service';

import Folder from '@carbon/icons/es/folder/16';
import Document from '@carbon/icons/es/document/16';
import Renew from '@carbon/icons/es/renew/16';
import ChevronLeft from '@carbon/icons/es/chevron--left/16';
import Report from '@carbon/icons/es/report/16';
import Checkmark from '@carbon/icons/es/checkmark/16';
import WarningFilled from '@carbon/icons/es/warning--filled/20';
import Dashboard from '@carbon/icons/es/dashboard/16';
import Analytics from '@carbon/icons/es/analytics/16';

@Component({
  selector: 'app-powerbi-browser',
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    ButtonModule,
    IconModule,
    TagModule
  ],
  templateUrl: './powerbi-browser.component.html',
  styleUrl: './powerbi-browser.component.scss'
})
export class PowerBIBrowserComponent implements OnInit, OnDestroy, OnChanges {
  private powerBIService = inject(PowerBIBrowserService);
  private iconService = inject(IconService);
  private destroy$ = new Subject<void>();

  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() select = new EventEmitter<PowerBIReportSelection>();

  currentView: 'workspaces' | 'reports' = 'workspaces';

  workspaces: PowerBIWorkspace[] = [];
  reports: PowerBIReport[] = [];
  selectedWorkspace: PowerBIWorkspace | null = null;
  selectedReport: PowerBIReport | null = null;
  isLoading = false;
  errorMessage = '';
  isConfigured = false;

  ngOnInit(): void {
    this.iconService.registerAll([
      Folder, Document, Renew, ChevronLeft, Report, Checkmark, WarningFilled, Dashboard, Analytics
    ]);

    this.powerBIService.isLoading$.pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.isLoading = loading);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && changes['open'].currentValue === true && !changes['open'].previousValue) {
      this.onModalOpen();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onModalOpen(): void {
    this.checkConfigAndLoadWorkspaces();
  }

  checkConfigAndLoadWorkspaces(): void {
    this.powerBIService.getConfig().subscribe(config => {
      this.isConfigured = config.isConfigured && config.isConnected;
      if (!this.isConfigured) {
        this.errorMessage = config.errorMessage || 'Power BI is not configured';
        return;
      }

      this.loadWorkspaces();
    });
  }

  loadWorkspaces(): void {
    this.currentView = 'workspaces';
    this.selectedWorkspace = null;
    this.selectedReport = null;
    this.errorMessage = '';

    this.powerBIService.getWorkspaces().subscribe({
      next: (workspaces) => {
        this.workspaces = workspaces;
        if (workspaces.length === 0) {
          this.errorMessage = 'No workspaces found. Ensure the service principal has access to at least one workspace.';
        }
      },
      error: () => {
        this.errorMessage = 'Failed to load workspaces';
      }
    });
  }

  selectWorkspace(workspace: PowerBIWorkspace): void {
    this.selectedWorkspace = workspace;
    this.selectedReport = null;
    this.currentView = 'reports';
    this.loadReports(workspace.workspaceId);
  }

  loadReports(workspaceId: string): void {
    this.errorMessage = '';

    this.powerBIService.getWorkspaceReports(workspaceId).subscribe({
      next: (reports) => {
        this.reports = reports;
      },
      error: () => {
        this.errorMessage = 'Failed to load reports';
      }
    });
  }

  backToWorkspaces(): void {
    this.currentView = 'workspaces';
    this.selectedReport = null;
  }

  selectReport(report: PowerBIReport): void {
    this.selectedReport = report;
  }

  confirmSelection(): void {
    if (this.selectedReport && this.selectedWorkspace) {
      this.select.emit({
        workspaceId: this.selectedWorkspace.workspaceId,
        workspaceName: this.selectedWorkspace.workspaceName,
        reportId: this.selectedReport.reportId,
        reportName: this.selectedReport.reportName,
        description: this.selectedReport.description,
        embedUrl: this.selectedReport.embedUrl,
        reportType: this.selectedReport.reportType as 'PowerBIReport' | 'PaginatedReport'
      });
      this.closeModal();
    }
  }

  refresh(): void {
    if (this.currentView === 'workspaces') {
      this.loadWorkspaces();
    } else if (this.selectedWorkspace) {
      this.loadReports(this.selectedWorkspace.workspaceId);
    }
  }

  closeModal(): void {
    this.selectedReport = null;
    this.selectedWorkspace = null;
    this.currentView = 'workspaces';
    this.open = false;
    this.openChange.emit(false);
  }

  getReportTypeLabel(reportType: string): string {
    return this.powerBIService.getReportTypeLabel(reportType);
  }

  getReportTypeTagColor(reportType: string): 'blue' | 'teal' {
    return reportType === 'PaginatedReport' ? 'teal' : 'blue';
  }

  getTotalReportCount(workspace: PowerBIWorkspace): number {
    return workspace.reportCount + workspace.paginatedReportCount;
  }
}
