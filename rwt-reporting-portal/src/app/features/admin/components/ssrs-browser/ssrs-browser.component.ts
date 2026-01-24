import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  ModalModule,
  ButtonModule,
  IconModule,
  IconService,
  LoadingModule,
  TreeviewModule
} from 'carbon-components-angular';

// TreeView Node interface (matching Carbon's internal type)
interface TreeNode {
  label: string;
  value?: any;
  id?: string;
  active?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
  icon?: string;
  children?: TreeNode[];
}
import {
  SSRSBrowserService,
  SSRSCatalogItem,
  SSRSReportSelection
} from '../../services/ssrs-browser.service';

import Folder from '@carbon/icons/es/folder/16';
import Document from '@carbon/icons/es/document/16';
import Renew from '@carbon/icons/es/renew/16';
import FolderOpen from '@carbon/icons/es/folder--open/16';
import ChevronUp from '@carbon/icons/es/chevron--up/16';
import Report from '@carbon/icons/es/report/16';
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
    LoadingModule,
    TreeviewModule
  ],
  templateUrl: './ssrs-browser.component.html',
  styleUrl: './ssrs-browser.component.scss'
})
export class SSRSBrowserComponent implements OnInit, OnDestroy {
  @ViewChild('folderIcon') folderIconTemplate!: TemplateRef<any>;

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

  // TreeView data
  folderTree: TreeNode[] = [];

  ngOnInit(): void {
    this.iconService.registerAll([Folder, Document, Renew, FolderOpen, ChevronUp, Report, Checkmark, WarningFilled]);

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
        this.buildFolderTree();
      } else {
        this.errorMessage = response.errorMessage || 'Unable to load folder';
      }
    });
  }

  /**
   * Build the TreeView node structure from folders
   */
  private buildFolderTree(): void {
    // Add parent navigation if not at root
    const nodes: TreeNode[] = [];

    if (this.currentPath !== '/') {
      nodes.push({
        id: 'parent',
        label: '.. (Go up)',
        value: { type: 'parent', path: this.ssrsService.getParentPath(this.currentPath) },
        icon: 'folder--open',
        expanded: false,
        selected: false
      });
    }

    // Add folder nodes
    this.folders.forEach(folder => {
      nodes.push({
        id: folder.path,
        label: folder.name,
        value: { type: 'folder', item: folder },
        icon: 'folder',
        expanded: false,
        selected: false
      });
    });

    this.folderTree = nodes;
  }

  /**
   * Handle TreeView node selection
   * Using 'any' type since Carbon's Node type isn't properly exported
   */
  onTreeNodeSelect(node: any): void {
    const selectedNode = Array.isArray(node) ? node[0] : node;
    if (!selectedNode?.value) return;

    if (selectedNode.value.type === 'parent') {
      this.loadFolder(selectedNode.value.path);
    } else if (selectedNode.value.type === 'folder') {
      this.navigateToFolder(selectedNode.value.item);
    }
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

  /**
   * Get the current folder name for display
   */
  getCurrentFolderName(): string {
    if (this.currentPath === '/') return 'Root';
    const parts = this.currentPath.split('/').filter(p => p);
    return parts[parts.length - 1] || 'Root';
  }
}
