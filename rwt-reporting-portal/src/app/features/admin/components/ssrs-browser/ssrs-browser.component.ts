import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  ModalModule,
  ButtonModule,
  IconModule,
  IconService,
  LoadingModule,
  BreadcrumbModule
} from 'carbon-components-angular';
import {
  SSRSBrowserService,
  SSRSCatalogItem,
  SSRSReportSelection
} from '../../services/ssrs-browser.service';

import Folder from '@carbon/icons/es/folder/16';
import Document from '@carbon/icons/es/document/16';
import ChevronRight from '@carbon/icons/es/chevron--right/16';
import Renew from '@carbon/icons/es/renew/16';
import Close from '@carbon/icons/es/close/20';
import FolderOpen from '@carbon/icons/es/folder--open/16';

@Component({
  selector: 'app-ssrs-browser',
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    ButtonModule,
    IconModule,
    LoadingModule,
    BreadcrumbModule
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
  breadcrumbs: { name: string; path: string }[] = [];
  isLoading = false;
  errorMessage = '';
  selectedReport: SSRSCatalogItem | null = null;

  ngOnInit(): void {
    this.iconService.registerAll([Folder, Document, ChevronRight, Renew, Close, FolderOpen]);

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
        this.breadcrumbs = this.ssrsService.getBreadcrumbs(path);
        this.errorMessage = '';
      } else {
        this.errorMessage = response.errorMessage || 'Unable to load folder';
      }
    });
  }

  navigateToFolder(folder: SSRSCatalogItem): void {
    this.loadFolder(folder.path);
  }

  navigateToBreadcrumb(crumb: { path: string }): void {
    this.loadFolder(crumb.path);
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
    this.open = false;
    this.openChange.emit(false);
  }
}
