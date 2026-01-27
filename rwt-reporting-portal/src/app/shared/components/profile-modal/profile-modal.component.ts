import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ModalModule, ButtonModule, IconModule, IconService } from 'carbon-components-angular';
import { AuthService } from '../../../features/auth/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AVATAR_OPTIONS, AvatarOption, getAvatarById } from '../../../core/config/avatars.config';
import { User } from '../../../features/auth/models/auth.models';
import UserAvatar from '@carbon/icons/es/user--avatar/20';
import Checkmark from '@carbon/icons/es/checkmark/16';
import Close from '@carbon/icons/es/close/20';

@Component({
  selector: 'app-profile-modal',
  imports: [CommonModule, ModalModule, ButtonModule, IconModule],
  templateUrl: './profile-modal.component.html',
  styleUrl: './profile-modal.component.scss'
})
export class ProfileModalComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private iconService = inject(IconService);

  private authSubscription?: Subscription;

  @Input() open = false;
  @Output() closeModal = new EventEmitter<void>();

  currentUser: User | null = null;
  selectedAvatarId: string | undefined;
  originalAvatarId: string | undefined;

  avatarOptions: AvatarOption[] = AVATAR_OPTIONS.slice(0, 4);

  ngOnInit(): void {
    this.iconService.registerAll([UserAvatar, Checkmark, Close]);

    this.authSubscription = this.authService.authState$.subscribe(state => {
      if (state.user) {
        this.currentUser = state.user;

        this.selectedAvatarId = state.user.avatarId || AVATAR_OPTIONS[0].id;
        this.originalAvatarId = this.selectedAvatarId;
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
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

    const displayName = this.getFullName();
    const parts = displayName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }

  getFullName(): string {
    if (!this.currentUser) return '';

    if (this.currentUser.displayName) {
      return this.currentUser.displayName;
    }

    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (this.currentUser.email) {
      return this.currentUser.email.split('@')[0];
    }

    return this.currentUser.username || 'User';
  }

  getCompany(): string {

    if (!this.currentUser) return 'Redwood Trust';

    const email = this.currentUser.email?.toLowerCase() || '';
    if (email.includes('corevest')) {
      return 'CoreVest';
    }
    if (email.includes('aspire')) {
      return 'Aspire';
    }
    return 'Redwood Trust';
  }

  hasChanges(): boolean {
    return this.selectedAvatarId !== this.originalAvatarId;
  }

  onCancel(): void {

    this.selectedAvatarId = this.originalAvatarId;
    this.closeModal.emit();
  }

  onSave(): void {
    if (!this.currentUser || !this.selectedAvatarId) return;

    const selectedAvatar = getAvatarById(this.selectedAvatarId);
    const avatarName = selectedAvatar?.name || 'Avatar';

    this.authService.updateUserPreferences({ avatarId: this.selectedAvatarId });

    this.originalAvatarId = this.selectedAvatarId;

    this.notificationService.success(
      'Profile updated',
      `Your avatar has been changed to ${avatarName}`
    );

    this.closeModal.emit();
  }

  onOverlayClick(): void {
    this.onCancel();
  }
}
