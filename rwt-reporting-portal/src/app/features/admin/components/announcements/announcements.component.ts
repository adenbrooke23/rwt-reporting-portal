import { Component, OnInit, OnDestroy, inject, TemplateRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { AnnouncementService } from '../../../../core/services/announcement.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationNotificationService } from '../../../../core/services/confirmation.service';
import {
  Announcement,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_IMAGES
} from '../../../../core/models/announcement.model';
import {
  TableModule,
  TableModel,
  TableItem,
  TableHeaderItem,
  Table,
  ButtonModule,
  IconModule,
  IconService,
  ModalModule,
  InputModule,
  DropdownModule,
  ToggleModule,
  TagModule,
  PaginationModule,
  SearchModule,
  BreadcrumbModule
} from 'carbon-components-angular';
import ArrowLeft from '@carbon/icons/es/arrow--left/16';
import Add from '@carbon/icons/es/add/16';
import Edit from '@carbon/icons/es/edit/16';
import TrashCan from '@carbon/icons/es/trash-can/16';
import View from '@carbon/icons/es/view/16';
import Checkmark from '@carbon/icons/es/checkmark/16';
import Close from '@carbon/icons/es/close/16';
import Renew from '@carbon/icons/es/renew/16';
import Star from '@carbon/icons/es/star/16';
import StarFilled from '@carbon/icons/es/star--filled/16';
import TextBold from '@carbon/icons/es/text--bold/16';
import TextItalic from '@carbon/icons/es/text--italic/16';
import TextStrikethrough from '@carbon/icons/es/text--strikethrough/16';
import ListBulleted from '@carbon/icons/es/list--bulleted/16';
import ListNumbered from '@carbon/icons/es/list--numbered/16';
import Link from '@carbon/icons/es/link/16';
import Subtract from '@carbon/icons/es/subtract/16';

@Component({
  selector: 'app-announcements',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    IconModule,
    ModalModule,
    InputModule,
    DropdownModule,
    ToggleModule,
    TagModule,
    PaginationModule,
    SearchModule,
    BreadcrumbModule
  ],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent implements OnInit, OnDestroy {
  @ViewChild('statusTemplate') statusTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate') actionsTemplate!: TemplateRef<any>;
  @ViewChild('featuredTemplate') featuredTemplate!: TemplateRef<any>;
  @ViewChild('contentTextarea') contentTextarea!: ElementRef<HTMLTextAreaElement>;

  private authService = inject(AuthService);
  private announcementService = inject(AnnouncementService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationNotificationService);
  private router = inject(Router);
  private iconService = inject(IconService);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  currentUser = this.authService.getCurrentUser();
  announcements: Announcement[] = [];
  filteredAnnouncements: Announcement[] = [];
  isLoading = true;

  tableModel: TableModel = new TableModel();
  skeletonModel: TableModel = Table.skeletonModel(6, 5);

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  searchQuery = '';

  showModal = false;
  isEditing = false;
  editingAnnouncement: Announcement | null = null;
  isSaving = false;

  formData: CreateAnnouncementDto = {
    title: '',
    subtitle: '',
    content: '',
    imagePath: '/images/grad-card-1.jpeg',
    readTimeMinutes: 2,
    isFeatured: false,
    isPublished: false,
    authorName: ''
  };

  categories = ANNOUNCEMENT_CATEGORIES;
  images = ANNOUNCEMENT_IMAGES;

  showDeleted = false;

  ngOnInit(): void {

    const hasAdminRole = this.currentUser?.roles?.some(
      role => role.toLowerCase() === 'admin'
    );
    if (!this.currentUser || !hasAdminRole) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.iconService.registerAll([
      ArrowLeft, Add, Edit, TrashCan, View, Checkmark, Close, Renew, Star, StarFilled,
      TextBold, TextItalic, TextStrikethrough, ListBulleted, ListNumbered, Link, Subtract
    ]);

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.currentPage = 1;
      this.applyFilters();
    });

    this.loadAnnouncements();
  }

  loadAnnouncements(): void {
    this.isLoading = true;
    this.announcementService.getAllAnnouncements(this.showDeleted).subscribe({
      next: (announcements) => {
        this.announcements = announcements;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to load announcements');
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.announcements];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        (a.subtitle?.toLowerCase().includes(query)) ||
        (a.authorName?.toLowerCase().includes(query))
      );
    }

    this.totalItems = filtered.length;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.filteredAnnouncements = filtered.slice(startIndex, startIndex + this.pageSize);

    this.updateTableModel();
  }

  updateTableModel(): void {
    this.tableModel.header = [
      new TableHeaderItem({ data: 'Title' }),
      new TableHeaderItem({ data: 'Category' }),
      new TableHeaderItem({ data: 'Author' }),
      new TableHeaderItem({ data: 'Status' }),
      new TableHeaderItem({ data: 'Featured' }),
      new TableHeaderItem({ data: 'Actions' })
    ];

    this.tableModel.data = this.filteredAnnouncements.map(announcement => [
      new TableItem({ data: announcement.title }),
      new TableItem({ data: announcement.subtitle || 'Announcement' }),
      new TableItem({ data: announcement.authorName || 'Admin' }),
      new TableItem({ data: announcement, template: this.statusTemplate }),
      new TableItem({ data: announcement, template: this.featuredTemplate }),
      new TableItem({ data: announcement, template: this.actionsTemplate })
    ]);
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.applyFilters();
  }

  toggleShowDeleted(): void {
    this.showDeleted = !this.showDeleted;
    this.currentPage = 1;
    this.loadAnnouncements();
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingAnnouncement = null;
    this.formData = {
      title: '',
      subtitle: '',
      content: '',
      imagePath: '/images/grad-card-1.jpeg',
      readTimeMinutes: 2,
      isFeatured: false,
      isPublished: false,
      authorName: this.currentUser?.firstName ? `${this.currentUser.firstName} ${this.currentUser.lastName}` : 'Admin'
    };
    this.showModal = true;
  }

  openEditModal(announcement: Announcement): void {
    this.isEditing = true;
    this.editingAnnouncement = announcement;
    this.formData = {
      title: announcement.title,
      subtitle: announcement.subtitle || '',
      content: announcement.content || '',
      imagePath: announcement.imagePath || '/images/grad-card-1.jpeg',
      readTimeMinutes: announcement.readTimeMinutes || 2,
      isFeatured: announcement.isFeatured,
      isPublished: announcement.isPublished,
      authorName: announcement.authorName || ''
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingAnnouncement = null;
  }

  saveAnnouncement(): void {
    if (!this.formData.title.trim()) {
      this.notificationService.warning('Validation', 'Title is required');
      return;
    }

    this.isSaving = true;

    if (this.isEditing && this.editingAnnouncement) {
      const updateDto: UpdateAnnouncementDto = {
        title: this.formData.title,
        subtitle: this.formData.subtitle,
        content: this.formData.content,
        imagePath: this.formData.imagePath,
        readTimeMinutes: this.formData.readTimeMinutes,
        isFeatured: this.formData.isFeatured,
        authorName: this.formData.authorName
      };

      this.announcementService.updateAnnouncement(this.editingAnnouncement.id, updateDto).subscribe({
        next: () => {
          this.notificationService.success('Updated', 'Announcement updated successfully');
          this.closeModal();
          this.loadAnnouncements();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to update announcement');
          this.isSaving = false;
        }
      });
    } else {
      this.announcementService.createAnnouncement(this.formData).subscribe({
        next: () => {
          this.notificationService.success('Created', 'Announcement created successfully');
          this.closeModal();
          this.loadAnnouncements();
          this.isSaving = false;
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to create announcement');
          this.isSaving = false;
        }
      });
    }
  }

  async publishAnnouncement(announcement: Announcement): Promise<void> {
    this.announcementService.publishAnnouncement(announcement.id).subscribe({
      next: () => {
        this.notificationService.success('Published', `"${announcement.title}" is now live`);
        this.loadAnnouncements();
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to publish announcement');
      }
    });
  }

  async unpublishAnnouncement(announcement: Announcement): Promise<void> {
    const confirmed = await this.confirmationService.confirm(
      'warning',
      'Unpublish Announcement',
      `Are you sure you want to unpublish "${announcement.title}"? It will no longer be visible to users.`,
      'Unpublish'
    );

    if (confirmed) {
      this.announcementService.unpublishAnnouncement(announcement.id).subscribe({
        next: () => {
          this.notificationService.success('Unpublished', 'Announcement is now a draft');
          this.loadAnnouncements();
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to unpublish announcement');
        }
      });
    }
  }

  async deleteAnnouncement(announcement: Announcement): Promise<void> {
    const confirmed = await this.confirmationService.danger(
      'Delete Announcement',
      `Are you sure you want to delete "${announcement.title}"? You can restore it later if needed.`,
      'Delete'
    );

    if (confirmed) {
      this.announcementService.deleteAnnouncement(announcement.id).subscribe({
        next: () => {
          this.notificationService.success('Deleted', 'Announcement has been deleted');
          this.loadAnnouncements();
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to delete announcement');
        }
      });
    }
  }

  restoreAnnouncement(announcement: Announcement): void {
    this.announcementService.restoreAnnouncement(announcement.id).subscribe({
      next: () => {
        this.notificationService.success('Restored', 'Announcement has been restored');
        this.loadAnnouncements();
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to restore announcement');
      }
    });
  }

  toggleFeatured(announcement: Announcement): void {
    this.announcementService.setFeatured(announcement.id, !announcement.isFeatured).subscribe({
      next: () => {
        const message = !announcement.isFeatured
          ? 'Announcement is now featured'
          : 'Announcement is no longer featured';
        this.notificationService.success('Updated', message);
        this.loadAnnouncements();
      },
      error: () => {
        this.notificationService.error('Error', 'Failed to update featured status');
      }
    });
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  backToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  getStatusType(announcement: Announcement): 'red' | 'green' | 'gray' {
    if (announcement.isDeleted) return 'red';
    if (announcement.isPublished) return 'green';
    return 'gray';
  }

  getStatusLabel(announcement: Announcement): string {
    if (announcement.isDeleted) return 'Deleted';
    if (announcement.isPublished) return 'Published';
    return 'Draft';
  }

  formatDate(date: Date | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Markdown toolbar methods
  insertMarkdown(type: 'bold' | 'italic' | 'strikethrough' | 'bullet' | 'numbered' | 'link' | 'hr' | 'heading'): void {
    const textarea = this.contentTextarea?.nativeElement;
    if (!textarea) return;

    const content = this.formData.content || '';
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selectedText = content.substring(start, end);
    const beforeText = content.substring(0, start);
    const afterText = content.substring(end);

    let insertion = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        insertion = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? insertion.length : 2;
        break;
      case 'italic':
        insertion = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? insertion.length : 1;
        break;
      case 'strikethrough':
        insertion = `~~${selectedText || 'strikethrough text'}~~`;
        cursorOffset = selectedText ? insertion.length : 2;
        break;
      case 'bullet':
        insertion = `\n- ${selectedText || 'List item'}`;
        cursorOffset = insertion.length;
        break;
      case 'numbered':
        insertion = `\n1. ${selectedText || 'List item'}`;
        cursorOffset = insertion.length;
        break;
      case 'link':
        insertion = `[${selectedText || 'link text'}](url)`;
        cursorOffset = selectedText ? insertion.length - 1 : 1;
        break;
      case 'hr':
        insertion = `\n\n---\n\n`;
        cursorOffset = insertion.length;
        break;
      case 'heading':
        insertion = `\n## ${selectedText || 'Heading'}`;
        cursorOffset = insertion.length;
        break;
    }

    this.formData.content = beforeText + insertion + afterText;

    // Restore focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + cursorOffset;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  }
}
