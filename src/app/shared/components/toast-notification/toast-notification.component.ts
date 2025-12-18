import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationModule } from 'carbon-components-angular';
import { NotificationService, ToastNotification } from '../../../core/services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast-notification',
  imports: [CommonModule, NotificationModule],
  templateUrl: './toast-notification.component.html',
  styleUrl: './toast-notification.component.scss'
})
export class ToastNotificationComponent implements OnInit {
  private notificationService = inject(NotificationService);

  notifications$!: Observable<ToastNotification[]>;
  removingIds = new Set<string>();

  ngOnInit(): void {
    this.notifications$ = this.notificationService.notifications$;
  }

  closeNotification(id: string): void {
    // Add removing class for exit animation
    this.removingIds.add(id);

    // Wait for animation to complete before removing
    setTimeout(() => {
      this.notificationService.remove(id);
      this.removingIds.delete(id);
    }, 200); // Match slideOut animation duration
  }

  isRemoving(id: string): boolean {
    return this.removingIds.has(id);
  }

  getNotificationObj(notification: ToastNotification): any {
    return {
      type: notification.type,
      title: notification.title,
      subtitle: notification.message || '',
      showClose: true,
      lowContrast: false
    };
  }
}
