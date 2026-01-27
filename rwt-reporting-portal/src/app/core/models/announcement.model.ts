
export interface Announcement {
  id: number;
  title: string;
  subtitle: string | null;
  content: string | null;
  imagePath: string | null;
  readTimeMinutes: number | null;

  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: Date | null;

  authorId: number | null;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  updatedBy: number | null;

  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: number | null;
}

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

export interface UpdateAnnouncementDto {
  title?: string;
  subtitle?: string;
  content?: string;
  imagePath?: string;
  readTimeMinutes?: number;
  isFeatured?: boolean;
  authorName?: string;
}

export interface AnnouncementSummary {
  id: number;
  title: string;
  subtitle: string;
  imagePath: string;
  author: string;
  date: string;
  readTime: number;
  isFeatured: boolean;
}

export const ANNOUNCEMENT_IMAGES = [
  { id: 'grad-1', path: '/images/grad-card-1.jpeg', label: 'Gradient Blue' },
  { id: 'grad-2', path: '/images/grad-card-2.jpeg', label: 'Gradient Purple' }
];

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
