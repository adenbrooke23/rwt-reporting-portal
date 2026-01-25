import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject } from '@angular/core';
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
  SSRSBrowserService,
  SSRSCatalogItem,
  SSRSReportSelection
} from '../../services/ssrs-browser.service';

import Folder from '@carbon/icons/es/folder/16';
import Document from '@carbon/icons/es/document/16';
import Renew from '@carbon/icons/es/renew/16';
import ChevronLeft from '@carbon/icons/es/chevron--left/16';
import ChevronRight from '@carbon/icons/es/chevron--right/16';
import Checkmark from '@carbon/icons/es/checkmark/16';
import WarningFilled from '@carbon/icons/es/warning--filled/20';

@Component({
  selector: 'app-ssrs-browser',
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    ButtonModule,
    IconModule,
    TagModule
  ],
  templateUrl: './ssrs-browser.component.html',
  styleUrl: './ssrs-browser.component.scss'
})
export class SSRSBrowserComponent implements OnInit, OnDestroy {
  private ssrsService = inject(SSRSBrowserService);
  private iconService = inject(IconService);
  private destroy$ = new Subject<void>();

  @Input() open = false;
  @Input() serverUrl = '';
  @Output() openChange = new EventEmitter<boolean>();
  @Output() select = new EventEmitter<SSRSReportSelection>();

  currentPath = '/';
  folders: SSRSCatalogItem[] = [];
  reports: SSRSCatalogItem[] = [];
  isLoading = false;
  errorMessage = '';
  selectedReport: SSRSCatalogItem | null = null;

  ngOnInit(): void {
    this.iconService.registerAll([
      Folder, Document, Renew, ChevronLeft, ChevronRight, Checkmark, WarningFilled
    ]);

    this.ssrsService.isLoading$.pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.isLoading = loading);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onModalOpen(): void {
    this.loadFolder('/');
  }

  loadFolder(path: string): void {
    this.selectedReport = null;
    this.ssrsService.browse(path).subscribe(response => {
      if (response.success) {
        this.currentPath = response.currentPath;
        this.folders = response.folders;
        this.reports = response.reports;
        this.errorMessage = '';
      } else {
        this.errorMessage = response.errorMessage || 'Unable to load folder';
      }
    });
  }

  navigateToFolder(folder: SSRSCatalogItem): void {
    this.loadFolder(folder.path);
  }

  navigateUp(): void {
    const parentPath = this.ssrsService.getParentPath(this.currentPath);
    this.loadFolder(parentPath);
  }

  selectReport(report: SSRSCatalogItem): void {
    this.selectedReport = report;
  }

  confirmSelection(): void {
    if (this.selectedReport) {
      this.select.emit({
        reportPath: this.selectedReport.path,
        reportName: this.selectedReport.name,
        description: this.selectedReport.description,
        serverUrl: this.serverUrl
      });
      this.closeModal();
    }
  }

  refresh(): void {
    this.loadFolder(this.currentPath);
  }

  closeModal(): void {
    this.selectedReport = null;
    this.currentPath = '/';
    this.open = false;
    this.openChange.emit(false);
  }

  /**
   * Get the current folder name for display
   */
  getCurrentFolderName(): string {
    if (this.currentPath === '/') return 'Root';
    const parts = this.currentPath.split('/').filter(p => p);
    return parts[parts.length - 1] || 'Root';
  }
}
