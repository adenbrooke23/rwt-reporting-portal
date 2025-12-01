import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { ContentManagementService } from '../../services/content-management.service';
import { Hub, ReportGroup, Report } from '../../models/content-management.models';
import {
  ButtonModule,
  IconModule,
  IconService,
  TilesModule,
  TagModule
} from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import ArrowRight from '@carbon/icons/es/arrow--right/16';
import Folder from '@carbon/icons/es/folder/32';
import Category from '@carbon/icons/es/category/32';
import Document from '@carbon/icons/es/document/32';
import Group from '@carbon/icons/es/group/32';
import Add from '@carbon/icons/es/add/16';

@Component({
  selector: 'app-content-management',
  imports: [
    CommonModule,
    ButtonModule,
    IconModule,
    TilesModule,
    TagModule
  ],
  templateUrl: './content-management.component.html',
  styleUrl: './content-management.component.scss'
})
export class ContentManagementComponent implements OnInit {
  private authService = inject(AuthService);
  private contentService = inject(ContentManagementService);
  private router = inject(Router);
  private iconService = inject(IconService);

  currentUser = this.authService.getCurrentUser();
  isLoading = true;

  hubCount = 0;
  groupCount = 0;
  reportCount = 0;
  departmentCount = 0;
  activeHubCount = 0;

  recentHubs: Hub[] = [];
  recentReports: Report[] = [];

  ngOnInit(): void {
    if (!this.currentUser || !this.currentUser.roles.includes('admin')) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.iconService.registerAll([ArrowLeft, ArrowRight, Folder, Category, Document, Group, Add]);
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;

    // Load hubs
    this.contentService.getHubs(true).subscribe(hubs => {
      this.hubCount = hubs.length;
      this.activeHubCount = hubs.filter(h => h.isActive).length;
      this.recentHubs = hubs
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4);
    });

    // Load groups
    this.contentService.getReportGroups(undefined, true).subscribe(groups => {
      this.groupCount = groups.filter(g => g.isActive).length;
    });

    // Load reports
    this.contentService.getReports(undefined, undefined, true).subscribe(reports => {
      this.reportCount = reports.filter(r => r.isActive).length;
      this.recentReports = reports
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);
      this.isLoading = false;
    });

    // Load departments
    this.contentService.getDepartments().subscribe(departments => {
      this.departmentCount = departments.filter(d => d.isActive).length;
    });
  }

  navigateToHubs(): void {
    this.router.navigate(['/admin/content/hubs']);
  }

  navigateToGroups(): void {
    this.router.navigate(['/admin/content/groups']);
  }

  navigateToReports(): void {
    this.router.navigate(['/admin/content/reports']);
  }

  navigateToDepartments(): void {
    this.router.navigate(['/admin/content/departments']);
  }

  backToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getReportTypeTag(type: string): 'blue' | 'green' | 'purple' {
    switch (type) {
      case 'PowerBI': return 'blue';
      case 'SSRS': return 'green';
      case 'Paginated': return 'purple';
      default: return 'blue';
    }
  }
}
