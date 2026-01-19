import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, delay, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  Hub,
  CreateHubDto,
  UpdateHubDto,
  ReportGroup,
  CreateReportGroupDto,
  UpdateReportGroupDto,
  Report,
  CreateReportDto,
  UpdateReportDto,
  Department,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  PowerBIWorkspace,
  PowerBIReport,
  BulkImportResult
} from '../models/content-management.models';

// API DTOs - match backend response format
export interface HubApiDto {
  hubId: number;
  hubCode: string;
  hubName: string;
  description?: string;
  iconName?: string;
  sortOrder: number;
  isActive: boolean;
  reportGroupCount: number;
  reportCount: number;
  createdAt: string;
  createdByEmail?: string;
}

// Request DTO for creating/updating hubs
export interface HubRequestDto {
  hubCode: string;
  hubName: string;
  description?: string;
  iconName?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface DepartmentApiDto {
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  userCount: number;
  reportCount: number;
  createdAt: string;
  createdByEmail?: string;
}

// Request DTO for creating departments
export interface CreateDepartmentRequestDto {
  departmentCode: string;
  departmentName: string;
  description?: string;
}

// Request DTO for updating departments
export interface UpdateDepartmentRequestDto {
  departmentName?: string;
  description?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ContentManagementService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';

  private hubs = new BehaviorSubject<Hub[]>([]);
  private reportGroups = new BehaviorSubject<ReportGroup[]>([]);
  private reports = new BehaviorSubject<Report[]>([]);
  private departments = new BehaviorSubject<Department[]>([]);

  hubs$ = this.hubs.asObservable();
  reportGroups$ = this.reportGroups.asObservable();
  reports$ = this.reports.asObservable();
  departments$ = this.departments.asObservable();

  private mockDelay = 300;
  private hubsLoaded = false;
  private departmentsLoaded = false;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const now = new Date();
    const adminUser = 'admin@redwoodtrust.com';

    // NOTE: Hubs and Departments are now loaded from the API
    // Report groups and reports will also come from API once we have them in database
    // Keeping one sample report group and report for demo purposes

    const groupsData: ReportGroup[] = [
      {
        id: 'demo-samples',
        hubId: '1', // Will need to match actual hub ID from database
        name: 'Sample Reports',
        description: 'Demo and sample reports for testing',
        sortOrder: 1,
        isActive: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: now,
        createdBy: adminUser,
        reportCount: 1
      }
    ];

    // Initialize reports - keeping only Sample Power BI Report for demo
    const reportsData: Report[] = [
      {
        id: 'sample-powerbi-embed',
        reportGroupId: 'demo-samples',
        hubId: '1', // Will need to match actual hub ID from database
        name: 'Sample Power BI Report',
        description: 'Interactive Power BI embedded report demo',
        type: 'PowerBI',
        embedConfig: {
          embedUrl: 'https://playground.powerbi.com/sampleReportEmbed'
        },
        sortOrder: 1,
        isActive: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: now,
        createdBy: adminUser
      }
    ];

    // NOTE: Departments are now loaded from the API
    // Mock data removed - departments come from database

    // Initialize only report groups and reports (mock data until database has them)
    this.reportGroups.next(groupsData);
    this.reports.next(reportsData);
  }

  // ============== HUB OPERATIONS ==============

  getHubs(includeInactive = false): Observable<Hub[]> {
    const params = new HttpParams().set('includeInactive', includeInactive.toString());

    return this.http.get<{ hubs: HubApiDto[] }>(`${this.API_BASE_URL}/admin/hubs`, { params }).pipe(
      map(response => response.hubs.map(dto => this.mapHubDtoToHub(dto))),
      tap(hubs => {
        this.hubs.next(hubs);
        this.hubsLoaded = true;
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Map API DTO to frontend Hub model
   */
  private mapHubDtoToHub(dto: HubApiDto): Hub {
    return {
      id: dto.hubId.toString(),
      name: dto.hubName,
      description: dto.description || '',
      iconName: dto.iconName || 'folder',
      colorClass: this.getColorClassFromCode(dto.hubCode),
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.createdAt), // API doesn't return updatedAt yet
      createdBy: dto.createdByEmail || 'admin@redwoodtrust.com',
      reportGroupCount: dto.reportGroupCount || 0,
      reportCount: dto.reportCount || 0
    };
  }

  /**
   * Get color class from hub code
   */
  private getColorClassFromCode(hubCode: string): string {
    const colorMap: Record<string, string> = {
      'SEQUOIA': 'sequoia',
      'COREVEST': 'corevest',
      'ENTERPRISE': 'enterprise',
      'ASPIRE': 'aspire'
    };
    return colorMap[hubCode?.toUpperCase()] || 'default';
  }

  getHubById(id: string): Observable<Hub | undefined> {
    return of(this.hubs.value.find(h => h.id === id)).pipe(delay(this.mockDelay));
  }

  createHub(dto: CreateHubDto): Observable<Hub> {
    // Generate hub code from name (uppercase, no spaces)
    const hubCode = dto.name.toUpperCase().replace(/\s+/g, '_');

    const requestDto: HubRequestDto = {
      hubCode: hubCode,
      hubName: dto.name,
      description: dto.description,
      iconName: dto.iconName,
      isActive: true
    };

    return this.http.post<HubApiDto>(`${this.API_BASE_URL}/admin/hubs`, requestDto).pipe(
      map(response => this.mapHubDtoToHub(response)),
      tap(hub => {
        const currentHubs = this.hubs.value;
        this.hubs.next([...currentHubs, hub]);
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to create hub'));
      })
    );
  }

  updateHub(id: string, dto: UpdateHubDto): Observable<Hub> {
    const hubId = parseInt(id, 10);
    const existingHub = this.hubs.value.find(h => h.id === id);

    if (!existingHub) {
      return throwError(() => new Error('Hub not found'));
    }

    // Generate hub code from name if name changed
    const hubCode = dto.name
      ? dto.name.toUpperCase().replace(/\s+/g, '_')
      : existingHub.name.toUpperCase().replace(/\s+/g, '_');

    const requestDto: HubRequestDto = {
      hubCode: hubCode,
      hubName: dto.name || existingHub.name,
      description: dto.description ?? existingHub.description,
      iconName: dto.iconName ?? existingHub.iconName,
      sortOrder: existingHub.sortOrder,
      isActive: dto.isActive ?? existingHub.isActive
    };

    return this.http.put<HubApiDto>(`${this.API_BASE_URL}/admin/hubs/${hubId}`, requestDto).pipe(
      map(response => this.mapHubDtoToHub(response)),
      tap(updatedHub => {
        const currentHubs = this.hubs.value;
        const index = currentHubs.findIndex(h => h.id === id);
        if (index !== -1) {
          currentHubs[index] = updatedHub;
          this.hubs.next([...currentHubs]);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to update hub'));
      })
    );
  }

  deleteHub(id: string): Observable<void> {
    const hubId = parseInt(id, 10);

    // Soft delete by default (hardDelete=false)
    return this.http.delete<void>(`${this.API_BASE_URL}/admin/hubs/${hubId}`).pipe(
      tap(() => {
        const currentHubs = this.hubs.value;
        const index = currentHubs.findIndex(h => h.id === id);
        if (index !== -1) {
          // Mark as inactive in local state (soft delete)
          currentHubs[index] = {
            ...currentHubs[index],
            isActive: false,
            updatedAt: new Date()
          };
          this.hubs.next([...currentHubs]);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to delete hub'));
      })
    );
  }

  reorderHubs(hubIds: string[]): Observable<void> {
    const currentHubs = this.hubs.value;

    hubIds.forEach((id, index) => {
      const hub = currentHubs.find(h => h.id === id);
      if (hub) {
        hub.sortOrder = index + 1;
        hub.updatedAt = new Date();
      }
    });

    this.hubs.next([...currentHubs]);
    return of(void 0).pipe(delay(this.mockDelay));
  }

  // ============== REPORT GROUP OPERATIONS ==============

  getReportGroups(hubId?: string, includeInactive = false): Observable<ReportGroup[]> {
    return of(
      this.reportGroups.value
        .filter(g => (!hubId || g.hubId === hubId) && (includeInactive || g.isActive))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    ).pipe(delay(this.mockDelay));
  }

  getReportGroupById(id: string): Observable<ReportGroup | undefined> {
    return of(this.reportGroups.value.find(g => g.id === id)).pipe(delay(this.mockDelay));
  }

  createReportGroup(dto: CreateReportGroupDto): Observable<ReportGroup> {
    const currentGroups = this.reportGroups.value;
    const hubGroups = currentGroups.filter(g => g.hubId === dto.hubId);
    const maxSortOrder = Math.max(...hubGroups.map(g => g.sortOrder), 0);

    const newGroup: ReportGroup = {
      id: this.generateId('group'),
      hubId: dto.hubId,
      name: dto.name,
      description: dto.description,
      sortOrder: maxSortOrder + 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin@redwoodtrust.com',
      reportCount: 0
    };

    this.reportGroups.next([...currentGroups, newGroup]);
    this.updateHubCounts(dto.hubId);
    return of(newGroup).pipe(delay(this.mockDelay));
  }

  updateReportGroup(id: string, dto: UpdateReportGroupDto): Observable<ReportGroup> {
    const currentGroups = this.reportGroups.value;
    const index = currentGroups.findIndex(g => g.id === id);

    if (index === -1) {
      return throwError(() => new Error('Report group not found'));
    }

    const oldHubId = currentGroups[index].hubId;
    const updatedGroup: ReportGroup = {
      ...currentGroups[index],
      ...dto,
      updatedAt: new Date()
    };

    currentGroups[index] = updatedGroup;
    this.reportGroups.next([...currentGroups]);

    // Update hub counts if hub changed
    if (dto.hubId && dto.hubId !== oldHubId) {
      this.updateHubCounts(oldHubId);
      this.updateHubCounts(dto.hubId);
    }

    return of(updatedGroup).pipe(delay(this.mockDelay));
  }

  deleteReportGroup(id: string): Observable<void> {
    const currentGroups = this.reportGroups.value;
    const index = currentGroups.findIndex(g => g.id === id);

    if (index === -1) {
      return throwError(() => new Error('Report group not found'));
    }

    const hubId = currentGroups[index].hubId;

    // Soft delete
    currentGroups[index] = {
      ...currentGroups[index],
      isActive: false,
      updatedAt: new Date()
    };

    this.reportGroups.next([...currentGroups]);
    this.updateHubCounts(hubId);
    return of(void 0).pipe(delay(this.mockDelay));
  }

  reorderReportGroups(hubId: string, groupIds: string[]): Observable<void> {
    const currentGroups = this.reportGroups.value;

    groupIds.forEach((id, index) => {
      const group = currentGroups.find(g => g.id === id && g.hubId === hubId);
      if (group) {
        group.sortOrder = index + 1;
        group.updatedAt = new Date();
      }
    });

    this.reportGroups.next([...currentGroups]);
    return of(void 0).pipe(delay(this.mockDelay));
  }

  // ============== REPORT OPERATIONS ==============

  getReports(groupId?: string, hubId?: string, includeInactive = false): Observable<Report[]> {
    return of(
      this.reports.value
        .filter(r =>
          (!groupId || r.reportGroupId === groupId) &&
          (!hubId || r.hubId === hubId) &&
          (includeInactive || r.isActive)
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
    ).pipe(delay(this.mockDelay));
  }

  getReportById(id: string): Observable<Report | undefined> {
    return of(this.reports.value.find(r => r.id === id)).pipe(delay(this.mockDelay));
  }

  createReport(dto: CreateReportDto): Observable<Report> {
    const currentReports = this.reports.value;
    const groupReports = currentReports.filter(r => r.reportGroupId === dto.reportGroupId);
    const maxSortOrder = Math.max(...groupReports.map(r => r.sortOrder), 0);

    const group = this.reportGroups.value.find(g => g.id === dto.reportGroupId);
    const hubId = group?.hubId || '';

    const newReport: Report = {
      id: this.generateId('report'),
      reportGroupId: dto.reportGroupId,
      hubId: hubId,
      name: dto.name,
      description: dto.description,
      type: dto.type,
      embedConfig: dto.embedConfig,
      sortOrder: maxSortOrder + 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin@redwoodtrust.com'
    };

    this.reports.next([...currentReports, newReport]);
    this.updateGroupCounts(dto.reportGroupId);
    this.updateHubCounts(hubId);
    return of(newReport).pipe(delay(this.mockDelay));
  }

  updateReport(id: string, dto: UpdateReportDto): Observable<Report> {
    const currentReports = this.reports.value;
    const index = currentReports.findIndex(r => r.id === id);

    if (index === -1) {
      return throwError(() => new Error('Report not found'));
    }

    const oldGroupId = currentReports[index].reportGroupId;
    let newHubId = currentReports[index].hubId;

    if (dto.reportGroupId && dto.reportGroupId !== oldGroupId) {
      const newGroup = this.reportGroups.value.find(g => g.id === dto.reportGroupId);
      newHubId = newGroup?.hubId || newHubId;
    }

    const updatedReport: Report = {
      ...currentReports[index],
      ...dto,
      hubId: newHubId,
      updatedAt: new Date()
    };

    currentReports[index] = updatedReport;
    this.reports.next([...currentReports]);

    // Update counts if group changed
    if (dto.reportGroupId && dto.reportGroupId !== oldGroupId) {
      this.updateGroupCounts(oldGroupId);
      this.updateGroupCounts(dto.reportGroupId);
      this.updateHubCounts(currentReports[index].hubId);
      this.updateHubCounts(newHubId);
    }

    return of(updatedReport).pipe(delay(this.mockDelay));
  }

  deleteReport(id: string): Observable<void> {
    const currentReports = this.reports.value;
    const index = currentReports.findIndex(r => r.id === id);

    if (index === -1) {
      return throwError(() => new Error('Report not found'));
    }

    const groupId = currentReports[index].reportGroupId;
    const hubId = currentReports[index].hubId;

    // Soft delete
    currentReports[index] = {
      ...currentReports[index],
      isActive: false,
      updatedAt: new Date()
    };

    this.reports.next([...currentReports]);
    this.updateGroupCounts(groupId);
    this.updateHubCounts(hubId);
    return of(void 0).pipe(delay(this.mockDelay));
  }

  reorderReports(groupId: string, reportIds: string[]): Observable<void> {
    const currentReports = this.reports.value;

    reportIds.forEach((id, index) => {
      const report = currentReports.find(r => r.id === id && r.reportGroupId === groupId);
      if (report) {
        report.sortOrder = index + 1;
        report.updatedAt = new Date();
      }
    });

    this.reports.next([...currentReports]);
    return of(void 0).pipe(delay(this.mockDelay));
  }

  // ============== POWER BI DISCOVERY ==============

  getWorkspaces(): Observable<PowerBIWorkspace[]> {
    // Mock workspaces
    const mockWorkspaces: PowerBIWorkspace[] = [
      { id: 'ws-001', name: 'Finance Reports', type: 'Workspace', isReadOnly: false },
      { id: 'ws-002', name: 'Operations Analytics', type: 'Workspace', isReadOnly: false },
      { id: 'ws-003', name: 'Executive Dashboards', type: 'Workspace', isReadOnly: true }
    ];
    return of(mockWorkspaces).pipe(delay(this.mockDelay));
  }

  getWorkspaceReports(workspaceId: string): Observable<PowerBIReport[]> {
    // Mock reports for workspaces
    const mockReports: Record<string, PowerBIReport[]> = {
      'ws-001': [
        { id: 'pbi-001', name: 'Financial Overview', webUrl: '', embedUrl: 'https://app.powerbi.com/embed', reportType: 'PowerBIReport' },
        { id: 'pbi-002', name: 'Budget Analysis', webUrl: '', embedUrl: 'https://app.powerbi.com/embed', reportType: 'PowerBIReport' },
        { id: 'pbi-003', name: 'Monthly Statement', webUrl: '', embedUrl: 'https://app.powerbi.com/embed', reportType: 'PaginatedReport' }
      ],
      'ws-002': [
        { id: 'pbi-004', name: 'Operations Dashboard', webUrl: '', embedUrl: 'https://app.powerbi.com/embed', reportType: 'PowerBIReport' },
        { id: 'pbi-005', name: 'Performance Metrics', webUrl: '', embedUrl: 'https://app.powerbi.com/embed', reportType: 'PowerBIReport' }
      ],
      'ws-003': [
        { id: 'pbi-006', name: 'Executive Summary', webUrl: '', embedUrl: 'https://app.powerbi.com/embed', reportType: 'PowerBIReport' }
      ]
    };
    return of(mockReports[workspaceId] || []).pipe(delay(this.mockDelay));
  }

  bulkImportReports(reportGroupId: string, reports: PowerBIReport[]): Observable<BulkImportResult> {
    const group = this.reportGroups.value.find(g => g.id === reportGroupId);
    if (!group) {
      return throwError(() => new Error('Report group not found'));
    }

    const currentReports = this.reports.value;
    let successCount = 0;
    const errors: string[] = [];

    reports.forEach(pbiReport => {
      const maxSortOrder = Math.max(
        ...currentReports.filter(r => r.reportGroupId === reportGroupId).map(r => r.sortOrder),
        0
      );

      const newReport: Report = {
        id: this.generateId('report'),
        reportGroupId: reportGroupId,
        hubId: group.hubId,
        name: pbiReport.name,
        description: `Imported from Power BI: ${pbiReport.name}`,
        type: pbiReport.reportType === 'PaginatedReport' ? 'Paginated' : 'PowerBI',
        embedConfig: {
          embedUrl: pbiReport.embedUrl,
          reportId: pbiReport.id
        },
        sortOrder: maxSortOrder + 1 + successCount,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin@redwoodtrust.com'
      };

      currentReports.push(newReport);
      successCount++;
    });

    this.reports.next([...currentReports]);
    this.updateGroupCounts(reportGroupId);
    this.updateHubCounts(group.hubId);

    const result: BulkImportResult = {
      totalProcessed: reports.length,
      successCount,
      failureCount: errors.length,
      errors
    };

    return of(result).pipe(delay(this.mockDelay * 2));
  }

  // ============== DEPARTMENT OPERATIONS ==============

  getDepartments(includeInactive = false): Observable<Department[]> {
    const params = new HttpParams().set('includeInactive', includeInactive.toString());

    return this.http.get<{ departments: DepartmentApiDto[] }>(`${this.API_BASE_URL}/admin/departments`, { params }).pipe(
      map(response => response.departments.map(dto => this.mapDepartmentDtoToDepartment(dto))),
      tap(departments => {
        this.departments.next(departments);
        this.departmentsLoaded = true;
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Map API DTO to frontend Department model
   */
  private mapDepartmentDtoToDepartment(dto: DepartmentApiDto): Department {
    return {
      id: dto.departmentId.toString(),
      name: dto.departmentName,
      description: dto.description || '',
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.createdAt), // API doesn't return updatedAt yet
      createdBy: dto.createdByEmail || 'admin@redwoodtrust.com'
    };
  }

  getDepartmentById(id: string): Observable<Department | undefined> {
    return of(this.departments.value.find(d => d.id === id)).pipe(delay(this.mockDelay));
  }

  createDepartment(dto: CreateDepartmentDto): Observable<Department> {
    // Generate department code from name (uppercase, no spaces)
    const deptCode = dto.name.toUpperCase().replace(/\s+/g, '_');

    const requestDto: CreateDepartmentRequestDto = {
      departmentCode: deptCode,
      departmentName: dto.name,
      description: dto.description
    };

    return this.http.post<DepartmentApiDto>(`${this.API_BASE_URL}/admin/departments`, requestDto).pipe(
      map(response => this.mapDepartmentDtoToDepartment(response)),
      tap(department => {
        const currentDepartments = this.departments.value;
        this.departments.next([...currentDepartments, department]);
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to create department'));
      })
    );
  }

  updateDepartment(id: string, dto: UpdateDepartmentDto): Observable<Department> {
    const deptId = parseInt(id, 10);
    const existingDept = this.departments.value.find(d => d.id === id);

    if (!existingDept) {
      return throwError(() => new Error('Department not found'));
    }

    const requestDto: UpdateDepartmentRequestDto = {
      departmentName: dto.name,
      description: dto.description,
      isActive: dto.isActive
    };

    return this.http.put<DepartmentApiDto>(`${this.API_BASE_URL}/admin/departments/${deptId}`, requestDto).pipe(
      map(response => this.mapDepartmentDtoToDepartment(response)),
      tap(updatedDepartment => {
        const currentDepartments = this.departments.value;
        const index = currentDepartments.findIndex(d => d.id === id);
        if (index !== -1) {
          currentDepartments[index] = updatedDepartment;
          this.departments.next([...currentDepartments]);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to update department'));
      })
    );
  }

  deleteDepartment(id: string): Observable<void> {
    const deptId = parseInt(id, 10);

    // Soft delete by default (hardDelete=false)
    return this.http.delete<void>(`${this.API_BASE_URL}/admin/departments/${deptId}`).pipe(
      tap(() => {
        const currentDepartments = this.departments.value;
        const index = currentDepartments.findIndex(d => d.id === id);
        if (index !== -1) {
          // Mark as inactive in local state (soft delete)
          currentDepartments[index] = {
            ...currentDepartments[index],
            isActive: false,
            updatedAt: new Date()
          };
          this.departments.next([...currentDepartments]);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to delete department'));
      })
    );
  }

  // ============== HELPER METHODS ==============

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateHubCounts(hubId: string): void {
    const currentHubs = this.hubs.value;
    const hub = currentHubs.find(h => h.id === hubId);

    if (hub) {
      hub.reportGroupCount = this.reportGroups.value.filter(
        g => g.hubId === hubId && g.isActive
      ).length;
      hub.reportCount = this.reports.value.filter(
        r => r.hubId === hubId && r.isActive
      ).length;
      this.hubs.next([...currentHubs]);
    }
  }

  private updateGroupCounts(groupId: string): void {
    const currentGroups = this.reportGroups.value;
    const group = currentGroups.find(g => g.id === groupId);

    if (group) {
      group.reportCount = this.reports.value.filter(
        r => r.reportGroupId === groupId && r.isActive
      ).length;
      this.reportGroups.next([...currentGroups]);
    }
  }
}
