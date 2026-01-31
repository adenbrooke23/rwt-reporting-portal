import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, combineLatest } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  Announcement,
  AnnouncementSummary,
  CreateAnnouncementDto,
  UpdateAnnouncementDto
} from '../models/announcement.model';

// API Response interfaces (matching backend DTOs)
interface AnnouncementDto {
  announcementId: number;
  title: string;
  subtitle?: string;
  content: string;
  imagePath?: string;
  readTimeMinutes: number;
  isFeatured: boolean;
  authorName?: string;
  publishedAt?: string;
}

interface AdminAnnouncementDto extends AnnouncementDto {
  isPublished: boolean;
  authorId?: number;
  authorEmail?: string;
  createdAt: string;
  updatedAt?: string;
  isDeleted: boolean;
}

interface AnnouncementListResponse {
  announcements: AnnouncementDto[];
}

interface AdminAnnouncementListResponse {
  announcements: AdminAnnouncementDto[];
}

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = 'https://erpqaapi.redwoodtrust.com/api';

  // Local cache for announcements
  private announcementsSubject = new BehaviorSubject<Announcement[]>([]);
  public announcements$ = this.announcementsSubject.asObservable();

  // Read status tracking (still client-side for now)
  private readAnnouncementsSubject = new BehaviorSubject<Map<string, Set<number>>>(new Map());
  public readAnnouncements$ = this.readAnnouncementsSubject.asObservable();

  /**
   * Get published announcements for public view
   */
  getPublishedAnnouncements(): Observable<AnnouncementSummary[]> {
    return this.http.get<AnnouncementListResponse>(`${this.API_BASE_URL}/announcements`).pipe(
      map(response => response.announcements.map(a => this.toSummary(a))),
      catchError(error => {
        console.error('Error fetching published announcements:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all announcements for admin view
   */
  getAllAnnouncements(includeDeleted = false): Observable<Announcement[]> {
    const params = `?includeUnpublished=true&includeDeleted=${includeDeleted}`;
    return this.http.get<AdminAnnouncementListResponse>(`${this.API_BASE_URL}/admin/announcements${params}`).pipe(
      map(response => response.announcements.map(a => this.mapAdminDtoToAnnouncement(a))),
      tap(announcements => this.announcementsSubject.next(announcements)),
      catchError(error => {
        console.error('Error fetching all announcements:', error);
        return of([]);
      })
    );
  }

  /**
   * Get a single announcement by ID
   */
  getAnnouncementById(id: number): Observable<Announcement | undefined> {
    return this.http.get<AdminAnnouncementDto>(`${this.API_BASE_URL}/admin/announcements/${id}`).pipe(
      map(dto => this.mapAdminDtoToAnnouncement(dto)),
      catchError(error => {
        console.error('Error fetching announcement:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Create a new announcement
   */
  createAnnouncement(dto: CreateAnnouncementDto, authorId?: number): Observable<Announcement> {
    const request = {
      title: dto.title,
      subtitle: dto.subtitle,
      content: dto.content,
      imagePath: dto.imagePath || '/images/grad-card-1.jpeg',
      readTimeMinutes: dto.readTimeMinutes || this.estimateReadTime(dto.content),
      isFeatured: dto.isFeatured || false,
      isPublished: dto.isPublished || false,
      authorName: dto.authorName
    };

    return this.http.post<AdminAnnouncementDto>(`${this.API_BASE_URL}/admin/announcements`, request).pipe(
      map(response => this.mapAdminDtoToAnnouncement(response)),
      tap(announcement => {
        const current = this.announcementsSubject.value;
        this.announcementsSubject.next([announcement, ...current]);
      }),
      catchError(error => {
        console.error('Error creating announcement:', error);
        throw error;
      })
    );
  }

  /**
   * Update an existing announcement
   */
  updateAnnouncement(id: number, dto: UpdateAnnouncementDto, updatedBy?: number): Observable<Announcement | null> {
    const request = {
      title: dto.title,
      subtitle: dto.subtitle,
      content: dto.content,
      imagePath: dto.imagePath,
      readTimeMinutes: dto.readTimeMinutes || (dto.content ? this.estimateReadTime(dto.content) : undefined),
      isFeatured: dto.isFeatured
    };

    return this.http.put<AdminAnnouncementDto>(`${this.API_BASE_URL}/admin/announcements/${id}`, request).pipe(
      map(response => this.mapAdminDtoToAnnouncement(response)),
      tap(announcement => {
        const current = this.announcementsSubject.value;
        const index = current.findIndex(a => a.id === id);
        if (index !== -1) {
          const newList = [...current];
          newList[index] = announcement;
          this.announcementsSubject.next(newList);
        }
      }),
      catchError(error => {
        console.error('Error updating announcement:', error);
        return of(null);
      })
    );
  }

  /**
   * Publish an announcement
   */
  publishAnnouncement(id: number): Observable<boolean> {
    return this.http.put<{ success: boolean }>(`${this.API_BASE_URL}/admin/announcements/${id}/publish`, {}).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const current = this.announcementsSubject.value;
          const index = current.findIndex(a => a.id === id);
          if (index !== -1) {
            const newList = [...current];
            newList[index] = {
              ...newList[index],
              isPublished: true,
              publishedAt: new Date(),
              updatedAt: new Date()
            };
            this.announcementsSubject.next(newList);
          }
        }
      }),
      catchError(error => {
        console.error('Error publishing announcement:', error);
        return of(false);
      })
    );
  }

  /**
   * Unpublish an announcement
   */
  unpublishAnnouncement(id: number): Observable<boolean> {
    return this.http.put<{ success: boolean }>(`${this.API_BASE_URL}/admin/announcements/${id}/unpublish`, {}).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const current = this.announcementsSubject.value;
          const index = current.findIndex(a => a.id === id);
          if (index !== -1) {
            const newList = [...current];
            newList[index] = {
              ...newList[index],
              isPublished: false,
              updatedAt: new Date()
            };
            this.announcementsSubject.next(newList);
          }
        }
      }),
      catchError(error => {
        console.error('Error unpublishing announcement:', error);
        return of(false);
      })
    );
  }

  /**
   * Delete (soft delete) an announcement
   */
  deleteAnnouncement(id: number, deletedBy?: number): Observable<boolean> {
    return this.http.delete<{ success: boolean }>(`${this.API_BASE_URL}/admin/announcements/${id}`).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const current = this.announcementsSubject.value;
          const index = current.findIndex(a => a.id === id);
          if (index !== -1) {
            const newList = [...current];
            newList[index] = {
              ...newList[index],
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: deletedBy || null
            };
            this.announcementsSubject.next(newList);
          }
        }
      }),
      catchError(error => {
        console.error('Error deleting announcement:', error);
        return of(false);
      })
    );
  }

  /**
   * Restore a deleted announcement
   */
  restoreAnnouncement(id: number): Observable<boolean> {
    return this.http.put<{ success: boolean }>(`${this.API_BASE_URL}/admin/announcements/${id}/restore`, {}).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const current = this.announcementsSubject.value;
          const index = current.findIndex(a => a.id === id);
          if (index !== -1) {
            const newList = [...current];
            newList[index] = {
              ...newList[index],
              isDeleted: false,
              deletedAt: null,
              deletedBy: null
            };
            this.announcementsSubject.next(newList);
          }
        }
      }),
      catchError(error => {
        console.error('Error restoring announcement:', error);
        return of(false);
      })
    );
  }

  /**
   * Set featured status for an announcement
   */
  setFeatured(id: number, isFeatured: boolean): Observable<boolean> {
    return this.http.put<AdminAnnouncementDto>(`${this.API_BASE_URL}/admin/announcements/${id}`, { isFeatured }).pipe(
      map(() => true),
      tap(() => {
        const current = this.announcementsSubject.value;
        const newList = current.map(a => {
          if (a.id === id) {
            return { ...a, isFeatured, updatedAt: new Date() };
          }
          // If setting featured to true, unfeatured others
          if (isFeatured && a.isFeatured) {
            return { ...a, isFeatured: false, updatedAt: new Date() };
          }
          return a;
        });
        this.announcementsSubject.next(newList);
      }),
      catchError(error => {
        console.error('Error setting featured status:', error);
        return of(false);
      })
    );
  }

  /**
   * Get unread count for a user (still client-side)
   */
  getUnreadCount(userId: string): Observable<number> {
    return combineLatest([
      this.getPublishedAnnouncements(),
      this.readAnnouncements$
    ]).pipe(
      map(([announcements, readMap]) => {
        const userReadSet = readMap.get(userId) || new Set();
        return announcements.filter(a => !userReadSet.has(a.id)).length;
      })
    );
  }

  /**
   * Check if an announcement is read
   */
  isAnnouncementRead(userId: string, announcementId: number): boolean {
    const readMap = this.readAnnouncementsSubject.value;
    const userReadSet = readMap.get(userId);
    return userReadSet?.has(announcementId) || false;
  }

  /**
   * Mark an announcement as read
   */
  markAsRead(userId: string, announcementId: number): void {
    const readMap = this.readAnnouncementsSubject.value;
    const userReadSet = readMap.get(userId) || new Set<number>();
    userReadSet.add(announcementId);
    readMap.set(userId, userReadSet);
    this.readAnnouncementsSubject.next(new Map(readMap));
  }

  /**
   * Mark all announcements as read
   */
  markAllAsRead(userId: string): void {
    this.getPublishedAnnouncements().subscribe(announcements => {
      const readMap = this.readAnnouncementsSubject.value;
      const userReadSet = readMap.get(userId) || new Set<number>();
      announcements.forEach(a => userReadSet.add(a.id));
      readMap.set(userId, userReadSet);
      this.readAnnouncementsSubject.next(new Map(readMap));
    });
  }

  /**
   * Get filtered announcements (client-side filtering after fetch)
   */
  getFilteredAnnouncements(
    searchTerm?: string,
    startDate?: Date,
    endDate?: Date
  ): Observable<AnnouncementSummary[]> {
    return this.getPublishedAnnouncements().pipe(
      map(announcements => {
        let filtered = [...announcements];

        if (searchTerm && searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          filtered = filtered.filter(a =>
            a.title.toLowerCase().includes(term) ||
            a.subtitle.toLowerCase().includes(term) ||
            a.author.toLowerCase().includes(term)
          );
        }

        if (startDate) {
          filtered = filtered.filter(a => {
            const dateStr = a.date;
            const date = new Date(dateStr);
            return date >= startDate;
          });
        }

        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          filtered = filtered.filter(a => {
            const dateStr = a.date;
            const date = new Date(dateStr);
            return date <= endOfDay;
          });
        }

        return filtered;
      })
    );
  }

  /**
   * Map API DTO to frontend AnnouncementSummary
   */
  private toSummary(dto: AnnouncementDto): AnnouncementSummary {
    return {
      id: dto.announcementId,
      title: dto.title,
      subtitle: dto.subtitle || 'Announcement',
      imagePath: dto.imagePath || '/images/grad-card-1.jpeg',
      author: dto.authorName || 'Admin',
      date: this.formatDate(dto.publishedAt ? new Date(dto.publishedAt) : new Date()),
      readTime: dto.readTimeMinutes || 2,
      isFeatured: dto.isFeatured
    };
  }

  /**
   * Map Admin DTO to frontend Announcement
   */
  private mapAdminDtoToAnnouncement(dto: AdminAnnouncementDto): Announcement {
    return {
      id: dto.announcementId,
      title: dto.title,
      subtitle: dto.subtitle || null,
      content: dto.content || null,
      imagePath: dto.imagePath || null,
      readTimeMinutes: dto.readTimeMinutes || null,
      isFeatured: dto.isFeatured,
      isPublished: dto.isPublished,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      authorId: dto.authorId || null,
      authorName: dto.authorName || null,
      createdAt: new Date(dto.createdAt),
      updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
      updatedBy: null, // Not returned by API
      isDeleted: dto.isDeleted,
      deletedAt: null, // Not returned by API
      deletedBy: null  // Not returned by API
    };
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Estimate read time from content
   */
  private estimateReadTime(content?: string): number {
    if (!content) return 1;
    const wordCount = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  }
}
