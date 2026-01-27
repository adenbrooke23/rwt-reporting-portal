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

export interface HubApiDto {
  hubId: number;
  hubCode: string;
  hubName: string;
  description?: string;
  iconName?: string;
  colorClass?: string;
  sortOrder: number;
  isActive: boolean;
  reportGroupCount: number;
  reportCount: number;
  createdAt: string;
  createdByEmail?: string;
}

export interface HubRequestDto {
  hubCode: string;
  hubName: string;
  description?: string;
  iconName?: string;
  colorClass?: string;
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

export interface CreateDepartmentRequestDto {
  departmentCode: string;
  departmentName: string;
  description?: string;
}

export interface UpdateDepartmentRequestDto {
  departmentName?: string;
  description?: string;
  isActive?: boolean;
}

export interface ReportApiDto {
  reportId: number;
  reportGroupId: number;
  reportGroupName: string;
  hubId: number;
  hubName: string;
  reportCode: string;
  reportName: string;
  description?: string;
  reportType: string;
  powerBIWorkspaceId?: string;
  powerBIReportId?: string;
  powerBIEmbedUrl?: string;
  ssrsReportPath?: string;
  ssrsReportServer?: string;
  parameters?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  createdByEmail?: string;
  departmentIds: number[];
}

export interface CreateReportRequestDto {
  reportGroupId: number;
  reportName: string;
  description?: string;
  reportType: string;
  powerBIWorkspaceId?: string;
  powerBIReportId?: string;
  powerBIEmbedUrl?: string;
  ssrsReportPath?: string;
  ssrsReportServer?: string;
  parameters?: string;
  departmentIds?: number[];
}

export interface UpdateReportRequestDto {
  reportGroupId?: number;
  reportName?: string;
  description?: string;
  reportType?: string;
  powerBIWorkspaceId?: string;
  powerBIReportId?: string;
  powerBIEmbedUrl?: string;
  ssrsReportPath?: string;
  ssrsReportServer?: string;
  parameters?: string;
  isActive?: boolean;
  departmentIds?: number[];
}

export interface ReportGroupApiDto {
  reportGroupId: number;
  hubId: number;
  hubName: string;
  groupCode: string;
  groupName: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  reportCount: number;
  createdAt: string;
  createdByEmail?: string;
}

export interface CreateReportGroupRequestDto {
  hubId: number;
  groupName: string;
  description?: string;
}

export interface UpdateReportGroupRequestDto {
  hubId?: number;
  groupName?: string;
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

  }

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

  
  private mapHubDtoToHub(dto: HubApiDto): Hub {
    return {
      id: dto.hubId.toString(),
      name: dto.hubName,
      description: dto.description || '',
      iconName: dto.iconName || 'folder',

      colorClass: dto.colorClass || this.getColorClassFromCode(dto.hubCode),
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.createdAt),
      createdBy: dto.createdByEmail || 'admin@redwoodtrust.com',
      reportGroupCount: dto.reportGroupCount || 0,
      reportCount: dto.reportCount || 0
    };
  }

  
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

    const cached = this.hubs.value.find(h => h.id === id);
    if (cached) {
      return of(cached);
    }

    const hubId = parseInt(id, 10);
    return this.http.get<HubApiDto>(`${this.API_BASE_URL}/admin/hubs/${hubId}`).pipe(
      map(dto => this.mapHubDtoToHub(dto)),
      catchError(() => of(undefined))
    );
  }

  createHub(dto: CreateHubDto): Observable<Hub> {

    const hubCode = dto.name.toUpperCase().replace(/\s+/g, '_');

    const requestDto: HubRequestDto = {
      hubCode: hubCode,
      hubName: dto.name,
      description: dto.description,
      iconName: dto.iconName,
      colorClass: dto.colorClass,
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

    const hubCode = dto.name
      ? dto.name.toUpperCase().replace(/\s+/g, '_')
      : existingHub.name.toUpperCase().replace(/\s+/g, '_');

    const requestDto: HubRequestDto = {
      hubCode: hubCode,
      hubName: dto.name || existingHub.name,
      description: dto.description ?? existingHub.description,
      iconName: dto.iconName ?? existingHub.iconName,
      colorClass: dto.colorClass ?? existingHub.colorClass,
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

    return this.http.delete<void>(`${this.API_BASE_URL}/admin/hubs/${hubId}`).pipe(
      tap(() => {
        const currentHubs = this.hubs.value;
        const index = currentHubs.findIndex(h => h.id === id);
        if (index !== -1) {

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

  private reportGroupsLoaded = false;

  getReportGroups(hubId?: string, includeInactive = false): Observable<ReportGroup[]> {
    let params = new HttpParams().set('includeInactive', includeInactive.toString());

    const url = hubId
      ? `${this.API_BASE_URL}/admin/report-groups/by-hub/${hubId}`
      : `${this.API_BASE_URL}/admin/report-groups`;

    return this.http.get<{ reportGroups: ReportGroupApiDto[] }>(url, { params }).pipe(
      map(response => response.reportGroups.map(dto => this.mapReportGroupDtoToReportGroup(dto))),
      tap(groups => {

        if (!hubId) {
          this.reportGroups.next(groups);
        }
        this.reportGroupsLoaded = true;
      }),
      catchError(() => of([]))
    );
  }

  getReportGroupById(id: string): Observable<ReportGroup | undefined> {

    const cached = this.reportGroups.value.find(g => g.id === id);
    if (cached) {
      return of(cached);
    }

    const groupId = parseInt(id, 10);
    return this.http.get<ReportGroupApiDto>(`${this.API_BASE_URL}/admin/report-groups/${groupId}`).pipe(
      map(dto => this.mapReportGroupDtoToReportGroup(dto)),
      catchError(() => of(undefined))
    );
  }

  createReportGroup(dto: CreateReportGroupDto): Observable<ReportGroup> {
    const requestDto: CreateReportGroupRequestDto = {
      hubId: parseInt(dto.hubId, 10),
      groupName: dto.name,
      description: dto.description
    };

    return this.http.post<ReportGroupApiDto>(`${this.API_BASE_URL}/admin/report-groups`, requestDto).pipe(
      map(response => this.mapReportGroupDtoToReportGroup(response)),
      tap(group => {
        const currentGroups = this.reportGroups.value;
        this.reportGroups.next([...currentGroups, group]);
        this.updateHubCounts(dto.hubId);
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to create report group'));
      })
    );
  }

  updateReportGroup(id: string, dto: UpdateReportGroupDto): Observable<ReportGroup> {
    const groupId = parseInt(id, 10);
    const existingGroup = this.reportGroups.value.find(g => g.id === id);

    if (!existingGroup) {
      return throwError(() => new Error('Report group not found'));
    }

    const oldHubId = existingGroup.hubId;

    const requestDto: UpdateReportGroupRequestDto = {
      hubId: dto.hubId ? parseInt(dto.hubId, 10) : undefined,
      groupName: dto.name,
      description: dto.description,
      isActive: dto.isActive
    };

    return this.http.put<ReportGroupApiDto>(`${this.API_BASE_URL}/admin/report-groups/${groupId}`, requestDto).pipe(
      map(response => this.mapReportGroupDtoToReportGroup(response)),
      tap(updatedGroup => {
        const currentGroups = this.reportGroups.value;
        const index = currentGroups.findIndex(g => g.id === id);
        if (index !== -1) {
          currentGroups[index] = updatedGroup;
          this.reportGroups.next([...currentGroups]);
        }

        if (dto.hubId && dto.hubId !== oldHubId) {
          this.updateHubCounts(oldHubId);
          this.updateHubCounts(dto.hubId);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to update report group'));
      })
    );
  }

  deleteReportGroup(id: string): Observable<void> {
    const groupId = parseInt(id, 10);
    const existingGroup = this.reportGroups.value.find(g => g.id === id);
    const hubId = existingGroup?.hubId;

    return this.http.delete<void>(`${this.API_BASE_URL}/admin/report-groups/${groupId}`).pipe(
      tap(() => {
        const currentGroups = this.reportGroups.value;
        const index = currentGroups.findIndex(g => g.id === id);
        if (index !== -1) {

          currentGroups[index] = {
            ...currentGroups[index],
            isActive: false,
            updatedAt: new Date()
          };
          this.reportGroups.next([...currentGroups]);
        }

        if (hubId) {
          this.updateHubCounts(hubId);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to delete report group'));
      })
    );
  }

  
  private mapReportGroupDtoToReportGroup(dto: ReportGroupApiDto): ReportGroup {
    return {
      id: dto.reportGroupId.toString(),
      hubId: dto.hubId.toString(),
      name: dto.groupName,
      description: dto.description || '',
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.createdAt),
      createdBy: dto.createdByEmail || 'admin@redwoodtrust.com',
      reportCount: dto.reportCount || 0
    };
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

  private reportsLoaded = false;

  getReports(groupId?: string, hubId?: string, includeInactive = false): Observable<Report[]> {
    const params = new HttpParams().set('includeInactive', includeInactive.toString());

    return this.http.get<{ reports: ReportApiDto[] }>(`${this.API_BASE_URL}/admin/reports`, { params }).pipe(
      map(response => response.reports.map(dto => this.mapReportDtoToReport(dto))),
      map(reports => reports.filter(r =>
        (!groupId || r.reportGroupId === groupId) &&
        (!hubId || r.hubId === hubId)
      )),
      tap(reports => {
        this.reports.next(reports);
        this.reportsLoaded = true;
      }),
      catchError(() => of([]))
    );
  }

  getReportById(id: string): Observable<Report | undefined> {

    const cached = this.reports.value.find(r => r.id === id);
    if (cached) {
      return of(cached);
    }

    const reportId = parseInt(id, 10);
    return this.http.get<ReportApiDto>(`${this.API_BASE_URL}/admin/reports/${reportId}`).pipe(
      map(dto => this.mapReportDtoToReport(dto)),
      catchError(() => of(undefined))
    );
  }

  createReport(dto: CreateReportDto): Observable<Report> {
    const requestDto: CreateReportRequestDto = {
      reportGroupId: parseInt(dto.reportGroupId, 10),
      reportName: dto.name,
      description: dto.description,
      reportType: dto.type,
      powerBIWorkspaceId: dto.embedConfig?.workspaceId,
      powerBIReportId: dto.embedConfig?.reportId,
      powerBIEmbedUrl: dto.embedConfig?.embedUrl,
      ssrsReportPath: dto.embedConfig?.reportPath,
      ssrsReportServer: dto.embedConfig?.serverUrl,
      departmentIds: dto.departmentIds?.map(id => parseInt(id, 10))
    };

    return this.http.post<ReportApiDto>(`${this.API_BASE_URL}/admin/reports`, requestDto).pipe(
      map(response => this.mapReportDtoToReport(response)),
      tap(report => {
        const currentReports = this.reports.value;
        this.reports.next([...currentReports, report]);
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to create report'));
      })
    );
  }

  updateReport(id: string, dto: UpdateReportDto): Observable<Report> {
    const reportId = parseInt(id, 10);

    const requestDto: UpdateReportRequestDto = {
      reportGroupId: dto.reportGroupId ? parseInt(dto.reportGroupId, 10) : undefined,
      reportName: dto.name,
      description: dto.description,
      reportType: dto.type,
      powerBIWorkspaceId: dto.embedConfig?.workspaceId,
      powerBIReportId: dto.embedConfig?.reportId,
      powerBIEmbedUrl: dto.embedConfig?.embedUrl,
      ssrsReportPath: dto.embedConfig?.reportPath,
      ssrsReportServer: dto.embedConfig?.serverUrl,
      isActive: dto.isActive,
      departmentIds: dto.departmentIds?.map(deptId => parseInt(deptId, 10))
    };

    return this.http.put<ReportApiDto>(`${this.API_BASE_URL}/admin/reports/${reportId}`, requestDto).pipe(
      map(response => this.mapReportDtoToReport(response)),
      tap(updatedReport => {
        const currentReports = this.reports.value;
        const index = currentReports.findIndex(r => r.id === id);
        if (index !== -1) {
          currentReports[index] = updatedReport;
          this.reports.next([...currentReports]);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to update report'));
      })
    );
  }

  deleteReport(id: string): Observable<void> {
    const reportId = parseInt(id, 10);

    return this.http.delete<void>(`${this.API_BASE_URL}/admin/reports/${reportId}`).pipe(
      tap(() => {
        const currentReports = this.reports.value;
        const index = currentReports.findIndex(r => r.id === id);
        if (index !== -1) {

          currentReports[index] = {
            ...currentReports[index],
            isActive: false,
            updatedAt: new Date()
          };
          this.reports.next([...currentReports]);
        }
      }),
      catchError(error => {
        return throwError(() => new Error(error.error?.message || 'Failed to delete report'));
      })
    );
  }

  
  private mapReportDtoToReport(dto: ReportApiDto): Report {
    return {
      id: dto.reportId.toString(),
      reportGroupId: dto.reportGroupId.toString(),
      hubId: dto.hubId.toString(),
      name: dto.reportName,
      description: dto.description || '',
      type: dto.reportType as 'PowerBI' | 'SSRS' | 'Paginated',
      embedConfig: {
        embedUrl: dto.powerBIEmbedUrl,
        workspaceId: dto.powerBIWorkspaceId,
        reportId: dto.powerBIReportId,
        serverUrl: dto.ssrsReportServer,
        reportPath: dto.ssrsReportPath
      },
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.createdAt),
      createdBy: dto.createdByEmail || 'admin@redwoodtrust.com',
      departmentIds: dto.departmentIds?.map(id => id.toString())
    };
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

  getWorkspaces(): Observable<PowerBIWorkspace[]> {

    const mockWorkspaces: PowerBIWorkspace[] = [
      { id: 'ws-001', name: 'Finance Reports', type: 'Workspace', isReadOnly: false },
      { id: 'ws-002', name: 'Operations Analytics', type: 'Workspace', isReadOnly: false },
      { id: 'ws-003', name: 'Executive Dashboards', type: 'Workspace', isReadOnly: true }
    ];
    return of(mockWorkspaces).pipe(delay(this.mockDelay));
  }

  getWorkspaceReports(workspaceId: string): Observable<PowerBIReport[]> {

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

  
  private mapDepartmentDtoToDepartment(dto: DepartmentApiDto): Department {
    return {
      id: dto.departmentId.toString(),
      name: dto.departmentName,
      description: dto.description || '',
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.createdAt),
      createdBy: dto.createdByEmail || 'admin@redwoodtrust.com'
    };
  }

  getDepartmentById(id: string): Observable<Department | undefined> {

    const cached = this.departments.value.find(d => d.id === id);
    if (cached) {
      return of(cached);
    }

    const deptId = parseInt(id, 10);
    return this.http.get<DepartmentApiDto>(`${this.API_BASE_URL}/admin/departments/${deptId}`).pipe(
      map(dto => this.mapDepartmentDtoToDepartment(dto)),
      catchError(() => of(undefined))
    );
  }

  createDepartment(dto: CreateDepartmentDto): Observable<Department> {

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

    return this.http.delete<void>(`${this.API_BASE_URL}/admin/departments/${deptId}`).pipe(
      tap(() => {
        const currentDepartments = this.departments.value;
        const index = currentDepartments.findIndex(d => d.id === id);
        if (index !== -1) {

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
