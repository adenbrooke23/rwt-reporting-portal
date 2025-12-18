import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalModule, ButtonModule, IconModule, IconService } from 'carbon-components-angular';
import { AuthService } from '../../../features/auth/services/auth.service';
import { MockUserService } from '../../../features/auth/services/mock-user.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AVATAR_OPTIONS, AvatarOption, getAvatarById } from '../../../core/config/avatars.config';
import { UserProfile } from '../../../features/auth/models/user-management.models';
import UserAvatar from '@carbon/icons/es/user--avatar/20';
import Checkmark from '@carbon/icons/es/checkmark/16';
import Close from '@carbon/icons/es/close/20';

@Component({
  selector: 'app-profile-modal',
  imports: [CommonModule, ModalModule, ButtonModule, IconModule],
  templateUrl: './profile-modal.component.html',
  styleUrl: './profile-modal.component.scss'
})
export class ProfileModalComponent implements OnInit {
  private authService = inject(AuthService);
  private mockUserService = inject(MockUserService);
  private notificationService = inject(NotificationService);
  private iconService = inject(IconService);

  @Input() open = false;
  @Output() closeModal = new EventEmitter<void>();

  currentUser: UserProfile | null = null;
  selectedAvatarId: string | undefined;
  originalAvatarId: string | undefined;

  avatarOptions: AvatarOption[] = AVATAR_OPTIONS.slice(0, 4);

  ngOnInit(): void {
    this.iconService.registerAll([UserAvatar, Checkmark, Close]);
    this.loadUserData();
  }

  loadUserData(): void {
    const user = this.authService.getCurrentUser();
    if (user && 'displayName' in user) {
      this.currentUser = user as UserProfile;
      this.selectedAvatarId = this.currentUser.avatarId || AVATAR_OPTIONS[0].id;
      this.originalAvatarId = this.selectedAvatarId;
    }
  }

  getCurrentAvatar(): AvatarOption | undefined {
    return this.selectedAvatarId ? getAvatarById(this.selectedAvatarId) : undefined;
  }

  selectAvatar(avatarId: string): void {
    this.selectedAvatarId = avatarId;
  }

  isSelectedAvatar(avatarId: string): boolean {
    return this.selectedAvatarId === avatarId;
  }

  getUserInitials(): string {
    if (!this.currentUser) return '??';

    const displayName = this.currentUser.displayName ||
                       `${this.currentUser.firstName} ${this.currentUser.lastName}`;

    const parts = displayName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }

  getFullName(): string {
    if (!this.currentUser) return '';
    return this.currentUser.displayName ||
           `${this.currentUser.firstName} ${this.currentUser.lastName}`;
  }

  getCompany(): string {
    // Determine company based on user's groups or a default
    if (!this.currentUser) return 'Redwood Trust';

    // Check user's groups for company affiliation
    const groups = this.currentUser.groups || [];
    if (groups.some(g => g.toLowerCase().includes('corevest'))) {
      return 'CoreVest';
    }
    if (groups.some(g => g.toLowerCase().includes('aspire'))) {
      return 'Aspire';
    }
    return 'Redwood Trust';
  }

  hasChanges(): boolean {
    return this.selectedAvatarId !== this.originalAvatarId;
  }

  onCancel(): void {
    // Reset to original avatar
    this.selectedAvatarId = this.originalAvatarId;
    this.closeModal.emit();
  }

  onSave(): void {
    if (!this.currentUser || !this.selectedAvatarId) return;

    const selectedAvatar = getAvatarById(this.selectedAvatarId);
    const avatarName = selectedAvatar?.name || 'Avatar';

    this.mockUserService.updateUserAvatar(this.currentUser.id, this.selectedAvatarId).subscribe({
      next: () => {
        if (this.currentUser && this.selectedAvatarId) {
          this.currentUser.avatarId = this.selectedAvatarId;
          this.originalAvatarId = this.selectedAvatarId;

          this.notificationService.success(
            'Profile updated',
            `Your avatar has been changed to ${avatarName}`
          );

          this.closeModal.emit();
        }
      },
      error: (err) => {
        console.error('Failed to update avatar:', err);
        this.notificationService.error(
          'Update failed',
          'Failed to update your profile. Please try again.'
        );
      }
    });
  }

  onOverlayClick(): void {
    this.onCancel();
  }
}
