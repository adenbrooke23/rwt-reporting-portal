/**
 * Announcement/Blog post model
 * Matches the Announcements table structure from DATABASE_TABLES.md
 */
export interface Announcement {
  id: number;
  title: string;
  subtitle: string | null;        // Category label (e.g., 'System Update', 'New Feature')
  content: string | null;         // Markdown or plain text content
  imagePath: string | null;       // Path to image in assets
  readTimeMinutes: number | null; // Estimated read time

  // Publishing
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: Date | null;

  // Authorship & Tracking
  authorId: number | null;
  authorName: string | null;      // Denormalized for display
  createdAt: Date;
  updatedAt: Date | null;
  updatedBy: number | null;

  // Soft delete
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: number | null;
}

/**
 * DTO for creating a new announcement
 */
export interface CreateAnnouncementDto {
  title: string;
  subtitle?: string;
  content?: string;
  imagePath?: string;
  readTimeMinutes?: number;
  isFeatured?: boolean;
  isPublished?: boolean;
  authorName?: string;
}

/**
 * DTO for updating an announcement
 */
export interface UpdateAnnouncementDto {
  title?: string;
  subtitle?: string;
  content?: string;
  imagePath?: string;
  readTimeMinutes?: number;
  isFeatured?: boolean;
  authorName?: string;
}

/**
 * Announcement for display on dashboard (simplified)
 */
export interface AnnouncementSummary {
  id: number;
  title: string;
  subtitle: string;
  imagePath: string;
  author: string;
  date: string;        // Formatted date string
  readTime: number;
  isFeatured: boolean;
}

/**
 * Available announcement image options
 * These images are located in the public/images folder
 */
export const ANNOUNCEMENT_IMAGES = [
  { id: 'grad-1', path: '/images/grad-card-1.jpeg', label: 'Gradient Blue' },
  { id: 'grad-2', path: '/images/grad-card-2.jpeg', label: 'Gradient Purple' }
];

/**
 * Common subtitle/category options
 */
export const ANNOUNCEMENT_CATEGORIES = [
  'System Update',
  'New Feature',
  'Performance',
  'Training',
  'Integration',
  'Security',
  'Data Update',
  'Release Notes',
  'Maintenance',
  'Announcement'
];
