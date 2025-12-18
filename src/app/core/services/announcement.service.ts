import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, combineLatest } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  Announcement,
  AnnouncementSummary,
  CreateAnnouncementDto,
  UpdateAnnouncementDto
} from '../models/announcement.model';

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private nextId = 9;

  private readAnnouncementsSubject = new BehaviorSubject<Map<string, Set<number>>>(new Map());
  public readAnnouncements$ = this.readAnnouncementsSubject.asObservable();

  // Mock announcements data
  private announcementsSubject = new BehaviorSubject<Announcement[]>([
    {
      id: 1,
      title: 'New Executive Dashboard Now Available',
      subtitle: 'New Feature',
      content: `We are excited to announce the launch of our new Executive Dashboard, providing real-time KPIs and business metrics at a glance.

## Key Features

- **Real-time Data**: Metrics update every 15 minutes
- **Customizable Widgets**: Drag and drop to personalize your view
- **Export Options**: Download reports in PDF, Excel, or PowerPoint formats
- **Mobile Responsive**: Access your dashboard on any device

Visit the Executive Hub to explore the new dashboard.`,
      imagePath: '/images/grad-card-1.jpeg',
      readTimeMinutes: 3,
      isFeatured: true,
      isPublished: true,
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      authorId: 1,
      authorName: 'IT Operations',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    },
    {
      id: 2,
      title: 'Q4 Financial Reports Ready for Review',
      subtitle: 'Finance Update',
      content: 'All Q4 2024 financial reports are now available in the Finance Hub. Please review and submit any questions to the Finance team by end of week.',
      imagePath: '/images/grad-card-2.jpeg',
      readTimeMinutes: 2,
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      authorId: null,
      authorName: 'Finance Team',
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    },
    {
      id: 3,
      title: 'Scheduled Maintenance: December 15th',
      subtitle: 'System Update',
      content: `The reporting portal will undergo scheduled maintenance on December 15th from 2:00 AM to 6:00 AM PST.

## What to Expect

- Brief service interruptions
- No data loss expected
- New performance improvements after maintenance

Thank you for your patience.`,
      imagePath: '/images/grad-card-1.jpeg',
      readTimeMinutes: 2,
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      authorId: 1,
      authorName: 'IT Operations',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    },
    {
      id: 4,
      title: 'New Lending Analytics Suite Launched',
      subtitle: 'Product Update',
      content: `The Lending Hub now features a comprehensive analytics suite with enhanced visualization capabilities and drill-down functionality.

Key improvements include:
- Portfolio segmentation analysis
- Risk trend visualization
- Comparative period analysis
- Custom date range selectors`,
      imagePath: '/images/grad-card-2.jpeg',
      readTimeMinutes: 4,
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      authorId: null,
      authorName: 'Product Team',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    },
    {
      id: 5,
      title: 'Power BI Best Practices Workshop',
      subtitle: 'Training',
      content: 'Join us for a comprehensive workshop on Power BI best practices. Learn how to create effective visualizations and optimize report performance.',
      imagePath: '/images/grad-card-1.jpeg',
      readTimeMinutes: 5,
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      authorId: null,
      authorName: 'Analytics Team',
      createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    },
    {
      id: 6,
      title: 'Enhanced SSO Authentication',
      subtitle: 'Security',
      content: 'We have upgraded our SSO authentication system to provide improved security and faster login times.',
      imagePath: '/images/grad-card-2.jpeg',
      readTimeMinutes: 2,
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      authorId: null,
      authorName: 'Security Team',
      createdAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    },
    {
      id: 7,
      title: 'Upcoming: Enhanced Search Functionality',
      subtitle: 'Coming Soon',
      content: 'We are working on enhanced search capabilities that will allow you to search across all reports and hubs simultaneously. Stay tuned for more details.',
      imagePath: '/images/grad-card-1.jpeg',
      readTimeMinutes: 1,
      isFeatured: false,
      isPublished: false, // Draft
      publishedAt: null,
      authorId: null,
      authorName: 'Product Team',
      createdAt: new Date(),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    },
    {
      id: 8,
      title: 'Old Announcement (Deleted)',
      subtitle: 'System Update',
      content: 'This announcement has been deleted.',
      imagePath: '/images/grad-card-2.jpeg',
      readTimeMinutes: 1,
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      authorId: null,
      authorName: 'IT Operations',
      createdAt: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000),
      updatedAt: null,
      updatedBy: null,
      isDeleted: true,
      deletedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      deletedBy: 1
    }
  ]);

  public announcements$ = this.announcementsSubject.asObservable();

  /**
   * Get all published announcements (for public dashboard)
   * Excludes deleted and unpublished items
   */
  getPublishedAnnouncements(): Observable<AnnouncementSummary[]> {
    return this.announcements$.pipe(
      map(announcements =>
        announcements
          .filter(a => a.isPublished && !a.isDeleted)
          .sort((a, b) => {
            // Featured first, then by publish date
            if (a.isFeatured && !b.isFeatured) return -1;
            if (!a.isFeatured && b.isFeatured) return 1;
            return (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0);
          })
          .map(a => this.toSummary(a))
      ),
      delay(300) // Simulate network delay
    );
  }

  /**
   * Get all announcements (for admin)
   * Includes drafts but excludes deleted by default
   */
  getAllAnnouncements(includeDeleted = false): Observable<Announcement[]> {
    return this.announcements$.pipe(
      map(announcements =>
        announcements
          .filter(a => includeDeleted || !a.isDeleted)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      ),
      delay(300)
    );
  }

  /**
   * Get a single announcement by ID
   */
  getAnnouncementById(id: number): Observable<Announcement | undefined> {
    return this.announcements$.pipe(
      map(announcements => announcements.find(a => a.id === id)),
      delay(200)
    );
  }

  /**
   * Create a new announcement
   */
  createAnnouncement(dto: CreateAnnouncementDto, authorId?: number): Observable<Announcement> {
    const newAnnouncement: Announcement = {
      id: this.nextId++,
      title: dto.title,
      subtitle: dto.subtitle || null,
      content: dto.content || null,
      imagePath: dto.imagePath || '/images/grad-card-1.jpeg',
      readTimeMinutes: dto.readTimeMinutes || this.estimateReadTime(dto.content),
      isFeatured: dto.isFeatured || false,
      isPublished: dto.isPublished || false,
      publishedAt: dto.isPublished ? new Date() : null,
      authorId: authorId || null,
      authorName: dto.authorName || null,
      createdAt: new Date(),
      updatedAt: null,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    };

    const current = this.announcementsSubject.value;
    this.announcementsSubject.next([...current, newAnnouncement]);

    return of(newAnnouncement).pipe(delay(300));
  }

  /**
   * Update an existing announcement
   */
  updateAnnouncement(id: number, dto: UpdateAnnouncementDto, updatedBy?: number): Observable<Announcement | null> {
    const current = this.announcementsSubject.value;
    const index = current.findIndex(a => a.id === id);

    if (index === -1) {
      return of(null).pipe(delay(200));
    }

    const updated: Announcement = {
      ...current[index],
      ...dto,
      readTimeMinutes: dto.content ? this.estimateReadTime(dto.content) : current[index].readTimeMinutes,
      updatedAt: new Date(),
      updatedBy: updatedBy || null
    };

    const newList = [...current];
    newList[index] = updated;
    this.announcementsSubject.next(newList);

    return of(updated).pipe(delay(300));
  }

  /**
   * Publish an announcement
   */
  publishAnnouncement(id: number): Observable<boolean> {
    const current = this.announcementsSubject.value;
    const index = current.findIndex(a => a.id === id);

    if (index === -1) {
      return of(false).pipe(delay(200));
    }

    const updated: Announcement = {
      ...current[index],
      isPublished: true,
      publishedAt: new Date(),
      updatedAt: new Date()
    };

    const newList = [...current];
    newList[index] = updated;
    this.announcementsSubject.next(newList);

    return of(true).pipe(delay(300));
  }

  /**
   * Unpublish an announcement
   */
  unpublishAnnouncement(id: number): Observable<boolean> {
    const current = this.announcementsSubject.value;
    const index = current.findIndex(a => a.id === id);

    if (index === -1) {
      return of(false).pipe(delay(200));
    }

    const updated: Announcement = {
      ...current[index],
      isPublished: false,
      updatedAt: new Date()
    };

    const newList = [...current];
    newList[index] = updated;
    this.announcementsSubject.next(newList);

    return of(true).pipe(delay(300));
  }

  /**
   * Soft delete an announcement
   */
  deleteAnnouncement(id: number, deletedBy?: number): Observable<boolean> {
    const current = this.announcementsSubject.value;
    const index = current.findIndex(a => a.id === id);

    if (index === -1) {
      return of(false).pipe(delay(200));
    }

    const updated: Announcement = {
      ...current[index],
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: deletedBy || null
    };

    const newList = [...current];
    newList[index] = updated;
    this.announcementsSubject.next(newList);

    return of(true).pipe(delay(300));
  }

  /**
   * Restore a soft-deleted announcement
   */
  restoreAnnouncement(id: number): Observable<boolean> {
    const current = this.announcementsSubject.value;
    const index = current.findIndex(a => a.id === id);

    if (index === -1) {
      return of(false).pipe(delay(200));
    }

    const updated: Announcement = {
      ...current[index],
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    };

    const newList = [...current];
    newList[index] = updated;
    this.announcementsSubject.next(newList);

    return of(true).pipe(delay(300));
  }

  /**
   * Set featured status (ensures only one featured at a time)
   */
  setFeatured(id: number, isFeatured: boolean): Observable<boolean> {
    const current = this.announcementsSubject.value;

    // If setting as featured, unfeatured all others first
    const newList = current.map(a => {
      if (a.id === id) {
        return { ...a, isFeatured, updatedAt: new Date() };
      }
      if (isFeatured && a.isFeatured) {
        return { ...a, isFeatured: false, updatedAt: new Date() };
      }
      return a;
    });

    this.announcementsSubject.next(newList);
    return of(true).pipe(delay(300));
  }

  /**
   * Convert full announcement to summary for dashboard display
   */
  private toSummary(announcement: Announcement): AnnouncementSummary {
    return {
      id: announcement.id,
      title: announcement.title,
      subtitle: announcement.subtitle || 'Announcement',
      imagePath: announcement.imagePath || '/images/grad-card-1.jpeg',
      author: announcement.authorName || 'Admin',
      date: this.formatDate(announcement.publishedAt || announcement.createdAt),
      readTime: announcement.readTimeMinutes || 2,
      isFeatured: announcement.isFeatured
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
   * Estimate read time based on content length
   * Assumes average reading speed of 200 words per minute
   */
  private estimateReadTime(content?: string): number {
    if (!content) return 1;
    const wordCount = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  /**
   * Get unread announcement count for a user
   */
  getUnreadCount(userId: string): Observable<number> {
    return combineLatest([this.announcements$, this.readAnnouncements$]).pipe(
      map(([announcements, readMap]) => {
        const published = announcements.filter(a => a.isPublished && !a.isDeleted);
        const userReadSet = readMap.get(userId) || new Set();
        return published.filter(a => !userReadSet.has(a.id)).length;
      })
    );
  }

  /**
   * Check if a specific announcement is read by user
   */
  isAnnouncementRead(userId: string, announcementId: number): boolean {
    const readMap = this.readAnnouncementsSubject.value;
    const userReadSet = readMap.get(userId);
    return userReadSet?.has(announcementId) || false;
  }

  /**
   * Mark a single announcement as read
   */
  markAsRead(userId: string, announcementId: number): void {
    const readMap = this.readAnnouncementsSubject.value;
    const userReadSet = readMap.get(userId) || new Set<number>();
    userReadSet.add(announcementId);
    readMap.set(userId, userReadSet);
    this.readAnnouncementsSubject.next(new Map(readMap));
  }

  /**
   * Mark all current published announcements as read for user
   */
  markAllAsRead(userId: string): void {
    const announcements = this.announcementsSubject.value;
    const published = announcements.filter(a => a.isPublished && !a.isDeleted);
    const readMap = this.readAnnouncementsSubject.value;
    const userReadSet = readMap.get(userId) || new Set<number>();

    published.forEach(a => userReadSet.add(a.id));
    readMap.set(userId, userReadSet);
    this.readAnnouncementsSubject.next(new Map(readMap));
  }

  /**
   * Get published announcements with optional filters
   */
  getFilteredAnnouncements(
    searchTerm?: string,
    startDate?: Date,
    endDate?: Date
  ): Observable<AnnouncementSummary[]> {
    return this.announcements$.pipe(
      map(announcements => {
        let filtered = announcements.filter(a => a.isPublished && !a.isDeleted);

        if (searchTerm && searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          filtered = filtered.filter(a =>
            a.title.toLowerCase().includes(term) ||
            (a.subtitle?.toLowerCase().includes(term)) ||
            (a.content?.toLowerCase().includes(term)) ||
            (a.authorName?.toLowerCase().includes(term))
          );
        }

        if (startDate) {
          filtered = filtered.filter(a =>
            a.publishedAt && new Date(a.publishedAt) >= startDate
          );
        }

        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          filtered = filtered.filter(a =>
            a.publishedAt && new Date(a.publishedAt) <= endOfDay
          );
        }

        return filtered
          .sort((a, b) => {
            if (a.isFeatured && !b.isFeatured) return -1;
            if (!a.isFeatured && b.isFeatured) return 1;
            return (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0);
          })
          .map(a => this.toSummary(a));
      }),
      delay(200)
    );
  }
}
